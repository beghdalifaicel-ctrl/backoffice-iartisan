/**
 * Devis Generation & Delivery Flow
 *
 * Orchestrates the full devis workflow on WhatsApp :
 * 1. Parse LLM response to extract devis data
 * 2. Generate PDF via pdf-lib
 * 3. Upload to Supabase Storage
 * 4. Persist snapshot in `agent_devis` (raw SQL, hors Prisma)
 * 5. Return URL — sending to artisan is handled by the orchestrator
 *
 * Pivot WhatsApp-first (01/05/2026) : les modèles Prisma BTP ont été supprimés.
 * Tous les devis générés par les agents IA vivent dans la table `agent_devis`,
 * qui supporte le versioning (Marie peut éditer un devis et créer un v2).
 */

import { createClient } from '@supabase/supabase-js';
import { callLLM } from '@/lib/agents/llm';
import { generateDevisPDF, DevisData, DevisItem } from './devis';
import { uploadDevisPDF } from './storage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── TYPES ──────────────────────────────────────────────────────────

export interface DevisGenerationRequest {
  clientId: string;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  userPhone: string;
  userMessage: string;
}

export interface DevisGenerationResult {
  success: boolean;
  documentUrl?: string;
  devisNumber?: string;
  version?: number;
  error?: string;
  message: string;
}

export interface DevisEditRequest {
  clientId: string;
  /** E.164 normalized digits-only phone of the artisan (used to find latest devis if devisNumber omitted). */
  userPhone: string;
  /** Explicit devis number (DEV-2026-XXXX). If omitted, latest devis from this user_phone is loaded. */
  devisNumber?: string;
  /** Free-form modification request from the artisan (NL). */
  modifications: string;
}

interface AgentDevisRow {
  id: string;
  client_id: string;
  devis_number: string;
  version: number;
  client_name: string;
  client_address: string | null;
  client_email: string | null;
  items: DevisItem[];
  conditions: string | null;
  tva_rate: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  pdf_url: string | null;
  source: string;
  user_phone: string;
  user_message: string | null;
  status: string;
  superseded_by_id: string | null;
  created_at: string;
}

// ─── EXTRACT DEVIS DATA FROM LLM (initial generation) ──────────────

async function extractDevisDataFromLLM(
  clientContext: any,
  userMessage: string
): Promise<{ items: DevisItem[]; conditions?: string; needsClarification?: string } | null> {
  const systemPrompt = `Tu es un assistant expert en extraction de données pour la génération de devis BTP.

Analyse le message de l'utilisateur et extrais une liste d'articles à inclure dans le devis.

Format ta réponse EXACTEMENT en JSON valide (UNIQUEMENT le JSON, pas d'autre texte).

CAS 1 — La demande contient AU MOINS UN poste explicite (description claire d'une prestation et au moins un repère de quantité ou de prix) :
{
  "items": [
    { "description": "Description précise", "quantity": 1, "unitPriceHT": 100.00, "unite": "u" }
  ],
  "conditions": "Conditions de paiement si mentionnées"
}

CAS 2 — La demande est TROP VAGUE pour produire un devis fiable (juste "fais un devis", ou un nom de client sans aucune prestation, ou transcription incohérente) :
{
  "items": [],
  "needsClarification": "Question CONCRÈTE et COURTE à poser à l'artisan pour clarifier (ex: 'Quel type de travaux ? Sur combien de m² ?')"
}

## Règles strictes (CAS 1)
- Les prix doivent être réalistes pour le métier ${clientContext.metier} en France.
- Tu ne PEUX PAS inventer de postes que l'artisan n'a PAS mentionnés. Pas de ravalement si on parle de carrelage. Pas de plomberie si on parle de peinture.
- Tu peux ajouter des opérations LOGIQUEMENT NÉCESSAIRES à la prestation demandée (ragréage avant pose carrelage, sous-couche avant peinture) avec une quantité COHÉRENTE — mais jamais des postes premium / options / extras non demandés.
- Unités : u (unité), m² (m carré), ml (mètre linéaire), h (heure), forfait.
- Arrondir aux centimes.

## ⚠️ Règle ÉPELLATIONS de noms (priorité absolue sur l'orthographe)
Si l'artisan ÉPELLE un nom dans son message — c'est-à-dire écrit/dit une suite de lettres séparées par tirets, virgules, points ou espaces (ex: "B-E-G-H-D-A-L-I", "B E G H D A L I", "B,E,G,H,D,A,L,I") — tu DOIS utiliser EXACTEMENT cette suite de lettres comme orthographe officielle du nom du client. Ignore toute version "inline" du nom qui apparaît à côté (Whisper et les LLM peuvent omettre des lettres dans la version inline).

Exemple : "fais un devis pour Mme Begdali, B-E-G-H-D-A-L-I, 100m² carrelage"
→ Le nom officiel est "Mme Beghdali" (avec H). La version "Begdali" sans H est probablement une erreur de transcription, **utilise l'épellation littérale**.

## Règles strictes (CAS 2)
- Tu utilises CAS 2 dès que :
  - L'artisan dit juste "fais un devis" sans plus
  - Tu n'identifies aucune prestation concrète (matière + opération)
  - La transcription semble incohérente ("fin de vie", "qui n'a pas faim de vie", autres absurdités hors-contexte)
  - L'artisan donne juste un nom de client sans description de chantier
- Tu NE remplis JAMAIS items avec des postes random. Mieux vaut demander que d'inventer un devis foireux.
- needsClarification doit être une question UTILE et SPÉCIFIQUE — pas "peux-tu être plus précis", mais "Quel type de travaux et combien de m² ?"`;

  try {
    const response = await callLLM({
      taskType: 'quote.generate',
      systemPrompt,
      userPrompt: `Client: ${clientContext.company} (${clientContext.metier})\n\nDemande: ${userMessage}`,
      maxTokens: 1024,
      responseFormat: 'json',
      temperature: 0.3,
    });

    const content = response.content || '{}';
    const parsed = JSON.parse(content);

    if (!parsed.items || !Array.isArray(parsed.items)) {
      console.warn('[Devis] Invalid items structure from LLM:', parsed);
      return null;
    }

    // CAS 2 : items vide + clarification demandée → on remonte ça pour que
    // Marie puisse poser la question à l'artisan au lieu de générer un PDF foireux.
    if (parsed.items.length === 0 && parsed.needsClarification) {
      return {
        items: [],
        needsClarification: String(parsed.needsClarification).slice(0, 300),
      };
    }

    if (parsed.items.length === 0) {
      // Demande totalement vide ET pas de question proposée → fallback safe
      return {
        items: [],
        needsClarification:
          "Tu peux me préciser le type de travaux et la surface concernée ?",
      };
    }

    return {
      items: parsed.items,
      conditions: parsed.conditions,
    };
  } catch (err: any) {
    console.error('[Devis] LLM extraction error:', err);
    return null;
  }
}

// ─── APPLY MODIFICATIONS TO EXISTING DEVIS (LLM edit) ──────────────

async function applyModificationsViaLLM(
  current: { items: DevisItem[]; conditions?: string; tvaRate: number },
  modifications: string,
  clientContext: { company: string; metier: string }
): Promise<{ items: DevisItem[]; conditions?: string; tvaRate: number } | null> {
  const systemPrompt = `Tu modifies un devis BTP existant à la demande d'un artisan ${clientContext.metier}.

Voici le devis ACTUEL :
${JSON.stringify({ items: current.items, conditions: current.conditions, tva_rate: current.tvaRate }, null, 2)}

Demande de modification de l'artisan (langage naturel) :
"""
${modifications}
"""

Tu dois renvoyer le nouveau devis COMPLET au format JSON strict (UNIQUEMENT le JSON) :
{
  "items": [ { "description": "...", "quantity": 1, "unitPriceHT": 100.00, "unite": "u" }, ... ],
  "conditions": "...",
  "tva_rate": 10
}

## Règles de modification

1. Conserve TOUTES les lignes que l'artisan ne touche pas explicitement.
2. Modifie ce que l'artisan demande en langage naturel (quantité, prix, désignation, ajout/retrait, TVA, conditions).
3. Format unités : u, m², ml, m³, h, forfait, kg, l.

## ⚠️ RÈGLE CRITIQUE — COHÉRENCE MÉTIER (la plus importante)

Quand l'artisan change la quantité d'une MATIÈRE PRINCIPALE (carrelage, parquet, peinture, placo, isolant, faïence, dalles, etc.), tu DOIS PROPAGER ce changement à TOUTES les lignes d'opérations qui dépendent de cette matière :

Exemples de propagation OBLIGATOIRE :
- "carrelage" → propage à : pose de carrelage, ragréage avant pose, jointoiement, finition, nettoyage après pose, primaire d'accroche, plinthes
- "parquet" → propage à : pose de parquet, dépose ancien revêtement, plinthes, ponçage, vitrification
- "peinture" → propage à : préparation murs, sous-couche, ponçage, finition
- "placo" → propage à : ossature, vissage, bandes, enduit, ponçage, peinture si liée
- "faïence" → propage à : pose, jointoiement, dépose ancien

Règle : si une ligne A est en surface (m²) et une ligne B également en surface (m²), et que B est une opération qui s'applique sur la même surface que A, alors B doit suivre la quantité de A.

Exemple concret :
Si l'artisan dit "change la quantité de carrelage à 30m²" et que le devis contient :
- Pose de carrelage 25m²
- Ragréage 25m²
- Jointoiement 25m²
- Dépose ancien revêtement 1 forfait

Alors tu DOIS produire :
- Pose de carrelage 30m² ✓
- Ragréage 30m² ✓ (suit la surface)
- Jointoiement 30m² ✓ (suit la surface)
- Dépose ancien revêtement 1 forfait (inchangé : forfait, pas surface)

## Cohérence textuelle

Si une description contient un chiffre lié à la quantité (ex: "Fourniture et pose carrelage (25m²)"), tu DOIS mettre à jour ce chiffre dans la description quand la quantité change. La description doit toujours refléter la nouvelle quantité.

## Ajouts / retraits

- "ajoute une ligne X 200€" → ajoute une ligne en bas avec quantity=1, unitPriceHT=200, unite="forfait" (ou autre unité si déductible).
- "retire/supprime la ligne X" → retire la ligne. Si X est une matière principale, propose dans la description que les lignes liées soient aussi retirées (mais retire UNIQUEMENT ce qui est demandé explicitement, pas plus — la propagation s'applique aux QUANTITÉS, pas aux suppressions).

## ⚠️ Épellations de noms
Si l'artisan épelle un nom dans sa demande (ex: "B-E-G-H-D-A-L-I"), utilise EXACTEMENT cette orthographe pour toute mention du client dans les modifications. Ignore les versions inline mal-écrites (problèmes de transcription Whisper fréquents).

## Process

Avant d'écrire le JSON, raisonne :
1. Quelle modification est demandée ?
2. Y a-t-il une matière principale impactée ?
3. Quelles autres lignes doivent suivre (propagation) ?
4. Y a-t-il des chiffres dans les descriptions à mettre à jour ?
5. Y a-t-il une épellation de nom à respecter littéralement ?
Puis écris le JSON.`;

  try {
    const response = await callLLM({
      taskType: 'quote.edit',
      systemPrompt,
      userPrompt: modifications,
      maxTokens: 1500,
      responseFormat: 'json',
      temperature: 0.2,
    });

    const content = response.content || '{}';
    const parsed = JSON.parse(content);

    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      console.warn('[Devis edit] Invalid items structure from LLM:', parsed);
      return null;
    }

    return {
      items: parsed.items,
      conditions: parsed.conditions ?? current.conditions,
      tvaRate: typeof parsed.tva_rate === 'number' ? parsed.tva_rate : current.tvaRate,
    };
  } catch (err: any) {
    console.error('[Devis edit] LLM error:', err);
    return null;
  }
}

// ─── DEVIS NUMBER GENERATION (reads from agent_devis) ──────────────

async function generateNextDevisNumber(clientId: string): Promise<string> {
  try {
    // Numéro le plus haut pour ce client cette année
    const yearPrefix = `DEV-${new Date().getFullYear()}-`;
    const { data: lastDevis } = await supabase
      .from('agent_devis')
      .select('devis_number')
      .eq('client_id', clientId)
      .like('devis_number', `${yearPrefix}%`)
      .order('created_at', { ascending: false })
      .limit(20); // ~suffisant : on parse pour trouver le plus haut numéro

    let nextNum = 1;
    if (lastDevis && lastDevis.length > 0) {
      const numbers = lastDevis
        .map((d) => {
          const m = d.devis_number.match(/^DEV-\d+-(\d+)$/);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => n > 0);
      if (numbers.length > 0) {
        nextNum = Math.max(...numbers) + 1;
      }
    }

    const year = new Date().getFullYear();
    return `DEV-${year}-${nextNum.toString().padStart(4, '0')}`;
  } catch (err: any) {
    console.error('[Devis] Error generating number:', err);
    // Fallback : timestamp
    return `DEV-${Date.now()}`;
  }
}

// ─── COMPUTE TOTALS ────────────────────────────────────────────────

function computeTotals(items: DevisItem[], tvaRate: number) {
  let totalHT = 0;
  for (const item of items) totalHT += item.quantity * item.unitPriceHT;
  const totalTVA = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + totalTVA;
  return {
    totalHT: Math.round(totalHT * 100) / 100,
    totalTVA: Math.round(totalTVA * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100,
  };
}

// ─── PERSIST DEVIS IN agent_devis ──────────────────────────────────

async function persistAgentDevis(input: {
  clientId: string;
  devisNumber: string;
  version: number;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  items: DevisItem[];
  conditions?: string;
  tvaRate: number;
  pdfUrl: string;
  source: 'photo' | 'text' | 'edit';
  userPhone: string;
  userMessage: string;
}): Promise<string | null> {
  const { totalHT, totalTVA, totalTTC } = computeTotals(input.items, input.tvaRate);
  const { data, error } = await supabase
    .from('agent_devis')
    .insert({
      client_id: input.clientId,
      devis_number: input.devisNumber,
      version: input.version,
      client_name: input.clientName,
      client_address: input.clientAddress || null,
      client_email: input.clientEmail || null,
      items: input.items,
      conditions: input.conditions || null,
      tva_rate: input.tvaRate,
      total_ht: totalHT,
      total_tva: totalTVA,
      total_ttc: totalTTC,
      pdf_url: input.pdfUrl,
      source: input.source,
      user_phone: input.userPhone,
      user_message: input.userMessage.substring(0, 5000),
      status: 'sent',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Devis] persistAgentDevis error:', error);
    return null;
  }
  return data?.id || null;
}

// ─── MAIN GENERATION FLOW (initial devis) ──────────────────────────

export async function handleDevisGeneration(
  request: DevisGenerationRequest
): Promise<DevisGenerationResult> {
  try {
    // 1. Get client context
    const { data: client } = await supabase
      .from('clients')
      .select('company, metier, ville, siret, phone, email, adresse')
      .eq('id', request.clientId)
      .single();

    if (!client) {
      return {
        success: false,
        error: 'Client not found',
        message: 'Impossible de récupérer les infos de votre entreprise.',
      };
    }

    // 2. Extract devis data from user message
    const extractedData = await extractDevisDataFromLLM(client, request.userMessage);
    if (!extractedData) {
      return {
        success: false,
        error: 'Failed to extract devis items',
        message:
          "Je n'ai pas réussi à extraire les articles du devis. Tu peux reformuler ? (ex: \"pose de carrelage 50m² à 80€/m² + dépose 1500€\")",
      };
    }

    // L'extraction a renvoyé une demande de clarification : on remonte le message
    // intact pour que Marie puisse le poser à l'artisan AVANT de générer un PDF.
    // Pas de PDF foireux quand la demande est ambiguë.
    if (extractedData.items.length === 0 && extractedData.needsClarification) {
      return {
        success: false,
        error: 'needs_clarification',
        message: extractedData.needsClarification,
      };
    }

    // 3. Generate devis number
    const devisNumber = await generateNextDevisNumber(request.clientId);
    const tvaRate = 10; // BTP rénovation par défaut

    // 4. Prepare PDF data
    const devisData: DevisData = {
      company: client.company,
      metier: client.metier,
      siret: client.siret,
      address: client.adresse,
      phone: client.phone,
      email: client.email,
      devisNumber,
      date: new Date(),
      validityDays: 30,
      clientName: request.clientName,
      clientAddress: request.clientAddress,
      clientEmail: request.clientEmail,
      items: extractedData.items,
      tvaRate,
      conditions:
        extractedData.conditions ||
        'Acompte 30% à la commande, solde à la fin des travaux.',
    };

    // 5. Generate PDF + upload
    console.log(`[Devis] Generating PDF for ${devisNumber}...`);
    const pdfBytes = await generateDevisPDF(devisData);
    const filename = `${devisNumber}.pdf`;
    const documentUrl = await uploadDevisPDF(pdfBytes, filename);

    // 6. Persist in agent_devis
    await persistAgentDevis({
      clientId: request.clientId,
      devisNumber,
      version: 1,
      clientName: request.clientName,
      clientAddress: request.clientAddress,
      clientEmail: request.clientEmail,
      items: extractedData.items,
      conditions: devisData.conditions,
      tvaRate,
      pdfUrl: documentUrl,
      source: 'text',
      userPhone: request.userPhone,
      userMessage: request.userMessage,
    });

    return {
      success: true,
      documentUrl,
      devisNumber,
      version: 1,
      message: `Devis ${devisNumber} généré avec succès.`,
    };
  } catch (err: any) {
    console.error('[Devis] Generation error:', err);
    return {
      success: false,
      error: err.message,
      message: `Erreur lors de la génération du devis : ${err.message}`,
    };
  }
}

// ─── EDIT FLOW ─────────────────────────────────────────────────────
//
// Trouve un devis existant (par numéro explicite ou par dernier de l'artisan),
// applique les modifs via LLM, crée une nouvelle version, marque l'ancienne
// comme superseded et régénère le PDF.

export async function editDevisGeneration(
  request: DevisEditRequest
): Promise<DevisGenerationResult> {
  try {
    // 1. Get client context (pour le PDF)
    const { data: client } = await supabase
      .from('clients')
      .select('company, metier, ville, siret, phone, email, adresse')
      .eq('id', request.clientId)
      .single();

    if (!client) {
      return {
        success: false,
        error: 'Client not found',
        message: "Impossible de récupérer les infos de votre entreprise.",
      };
    }

    // 2. Find target devis
    let target: AgentDevisRow | null = null;
    if (request.devisNumber) {
      // Mention explicite : on prend la dernière version de ce numéro
      const { data } = await supabase
        .from('agent_devis')
        .select('*')
        .eq('client_id', request.clientId)
        .eq('devis_number', request.devisNumber)
        .order('version', { ascending: false })
        .limit(1);
      target = data?.[0] || null;
    } else {
      // Pas de numéro : dernier devis envoyé sur ce numéro WhatsApp
      const { data } = await supabase
        .from('agent_devis')
        .select('*')
        .eq('client_id', request.clientId)
        .eq('user_phone', request.userPhone)
        .in('status', ['sent', 'accepted']) // pas de superseded
        .order('created_at', { ascending: false })
        .limit(1);
      target = data?.[0] || null;
    }

    if (!target) {
      return {
        success: false,
        error: 'Devis not found',
        message: request.devisNumber
          ? `Je ne trouve pas le devis ${request.devisNumber}. Vérifie le numéro ou demande-moi le dernier devis sans numéro précis.`
          : "Je ne trouve pas de devis récent à modifier. Tu peux m'en demander un nouveau ou me préciser le numéro (DEV-AAAA-XXXX).",
      };
    }

    // 3. Apply modifications via LLM
    const modified = await applyModificationsViaLLM(
      {
        items: target.items,
        conditions: target.conditions || undefined,
        tvaRate: target.tva_rate,
      },
      request.modifications,
      { company: client.company, metier: client.metier }
    );

    if (!modified) {
      return {
        success: false,
        error: 'LLM modification failed',
        message:
          "Je n'ai pas pu appliquer ta modification. Reformule plus simplement (ex: \"change la quantité de carrelage à 30m²\" ou \"ajoute une ligne pour le débarras 200€\").",
      };
    }

    // 4. New version number = target.version + 1, même devis_number
    const newVersion = target.version + 1;

    // 5. Generate new PDF
    const devisData: DevisData = {
      company: client.company,
      metier: client.metier,
      siret: client.siret,
      address: client.adresse,
      phone: client.phone,
      email: client.email,
      devisNumber: target.devis_number, // même numéro, version incrémentée
      date: new Date(),
      validityDays: 30,
      clientName: target.client_name,
      clientAddress: target.client_address || undefined,
      clientEmail: target.client_email || undefined,
      items: modified.items,
      tvaRate: modified.tvaRate,
      conditions:
        modified.conditions || 'Acompte 30% à la commande, solde à la fin des travaux.',
    };

    const pdfBytes = await generateDevisPDF(devisData);
    const filename = `${target.devis_number}-v${newVersion}.pdf`;
    const documentUrl = await uploadDevisPDF(pdfBytes, filename);

    // 6. Insert new version
    const newId = await persistAgentDevis({
      clientId: request.clientId,
      devisNumber: target.devis_number,
      version: newVersion,
      clientName: target.client_name,
      clientAddress: target.client_address || undefined,
      clientEmail: target.client_email || undefined,
      items: modified.items,
      conditions: modified.conditions,
      tvaRate: modified.tvaRate,
      pdfUrl: documentUrl,
      source: 'edit',
      userPhone: request.userPhone,
      userMessage: request.modifications,
    });

    // 7. Mark previous version as superseded
    if (newId) {
      await supabase
        .from('agent_devis')
        .update({
          status: 'superseded',
          superseded_by_id: newId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', target.id);
    }

    return {
      success: true,
      documentUrl,
      devisNumber: target.devis_number,
      version: newVersion,
      message: `Devis ${target.devis_number} modifié (v${newVersion}).`,
    };
  } catch (err: any) {
    console.error('[Devis edit] Error:', err);
    return {
      success: false,
      error: err.message,
      message: `Erreur lors de la modification du devis : ${err.message}`,
    };
  }
}

/**
 * Extract devis data for template/preview (used by other flows).
 * Note : ne persiste rien.
 */
export async function previewDevisData(
  clientId: string,
  userMessage: string
): Promise<DevisData | null> {
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('company, metier, ville, siret, phone, email, adresse')
      .eq('id', clientId)
      .single();

    if (!client) return null;

    const extractedData = await extractDevisDataFromLLM(client, userMessage);
    if (!extractedData) return null;

    const devisNumber = await generateNextDevisNumber(clientId);

    return {
      company: client.company,
      metier: client.metier,
      siret: client.siret,
      address: client.adresse,
      phone: client.phone,
      email: client.email,
      devisNumber,
      date: new Date(),
      validityDays: 30,
      clientName: '[Client Name]',
      items: extractedData.items,
      tvaRate: 10,
      conditions: extractedData.conditions,
    };
  } catch (err: any) {
    console.error('[Devis] Preview error:', err);
    return null;
  }
}

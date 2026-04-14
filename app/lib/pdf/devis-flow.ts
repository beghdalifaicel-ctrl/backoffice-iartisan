/**
 * Devis Generation & Delivery Flow
 *
 * Orchestrates the full devis workflow:
 * 1. Parse LLM response to extract devis data
 * 2. Generate PDF via pdf-lib
 * 3. Upload to Supabase Storage
 * 4. Send to artisan via WhatsApp as document
 * 5. Store metadata in database
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
  userMessage: string; // Original user request (from chat)
}

export interface DevisGenerationResult {
  success: boolean;
  documentUrl?: string;
  devisNumber?: string;
  error?: string;
  message: string;
}

// ─── EXTRACT DEVIS DATA FROM LLM ───────────────────────────────────

async function extractDevisDataFromLLM(
  clientContext: any,
  userMessage: string
): Promise<{ items: DevisItem[]; conditions?: string } | null> {
  /**
   * Use LLM to parse user message and extract structured devis data
   * LLM should extract:
   * - Line items (description, quantity, unit price)
   * - Payment conditions (if mentioned)
   */

  const systemPrompt = `Tu es un assistant expert en extraction de données pour la génération de devis BTP.

Analyse le message de l'utilisateur et extrais une liste d'articles à inclure dans le devis.

Format ta réponse EXACTEMENT en JSON valide (UNIQUEMENT le JSON, pas d'autre texte) :
{
  "items": [
    {
      "description": "Description de l'article",
      "quantity": 1,
      "unitPriceHT": 100.00,
      "unite": "u"
    }
  ],
  "conditions": "Conditions de paiement si mentionnées (optional)"
}

Règles:
- Les prix doivent être réalistes pour le métier ${clientContext.metier}
- Si l'utilisateur ne donne que des montants globaux, estime une répartition logique
- Utilise les unités appropriées: u (unité), m² (m carré), ml (mètre linéaire), h (heure), forfait
- Arrondir aux centimes
- Si pas assez d'info, propose une devis basique avec 2-3 postes standards`;

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

    return {
      items: parsed.items,
      conditions: parsed.conditions,
    };
  } catch (err: any) {
    console.error('[Devis] LLM extraction error:', err);
    return null;
  }
}

// ─── GENERATE NEXT DEVIS NUMBER ───────────────────────────────────

async function generateNextDevisNumber(clientId: string): Promise<string> {
  /**
   * Generate unique devis number: DEV-2026-0001
   * Based on client ID and sequential number
   */

  try {
    // Get the highest devis number for this client
    const { data: lastDevis } = await supabase
      .from('devis')
      .select('number')
      .eq('clientId', clientId)
      .order('createdAt', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastDevis && lastDevis.length > 0) {
      const lastNumber = lastDevis[0].number; // DEV-2026-0001
      const match = lastNumber.match(/DEV-(\d+)-(\d+)$/);
      if (match) {
        const year = parseInt(match[1]);
        const num = parseInt(match[2]);
        // If same year, increment; else reset to 1
        nextNum = new Date().getFullYear() === year ? num + 1 : 1;
      }
    }

    const year = new Date().getFullYear();
    const numStr = nextNum.toString().padStart(4, '0');
    return `DEV-${year}-${numStr}`;
  } catch (err: any) {
    console.error('[Devis] Error generating number:', err);
    // Fallback: use timestamp-based number
    return `DEV-${Date.now()}`;
  }
}

// ─── MAIN DEVIS GENERATION FLOW ─────────────────────────────────

export async function handleDevisGeneration(
  request: DevisGenerationRequest
): Promise<DevisGenerationResult> {
  try {
    // ─── Step 1: Get client context ─────────────────────────────

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

    // ─── Step 2: Extract devis data from user message ───────────

    const extractedData = await extractDevisDataFromLLM(client, request.userMessage);

    if (!extractedData || !extractedData.items || extractedData.items.length === 0) {
      return {
        success: false,
        error: 'Failed to extract devis items',
        message: 'Je n\'ai pas pu extraire les articles du devis. Pouvez-vous être plus détaillé ? (ex: "Pose de carrelage 50m² à 80€/m²")',
      };
    }

    // ─── Step 3: Generate devis number ──────────────────────────

    const devisNumber = await generateNextDevisNumber(request.clientId);

    // ─── Step 4: Prepare PDF data ──────────────────────────────

    const devisData: DevisData = {
      // Company (artisan)
      company: client.company,
      metier: client.metier,
      siret: client.siret,
      address: client.adresse,
      phone: client.phone,
      email: client.email,

      // Devis header
      devisNumber,
      date: new Date(),
      validityDays: 30,

      // Client
      clientName: request.clientName,
      clientAddress: request.clientAddress,
      clientEmail: request.clientEmail,

      // Items
      items: extractedData.items,

      // Rates & conditions
      tvaRate: 10, // BTP rénovation = 10%, construction = 20%
      conditions: extractedData.conditions || 'Acompte 30% à la commande, solde à la fin des travaux.',
    };

    // ─── Step 5: Generate PDF ──────────────────────────────────

    console.log(`[Devis] Generating PDF for ${devisNumber}...`);
    const pdfBytes = await generateDevisPDF(devisData);

    // ─── Step 6: Upload to Supabase Storage ────────────────────

    const filename = `${devisNumber}.pdf`;
    console.log(`[Devis] Uploading PDF to storage...`);
    const documentUrl = await uploadDevisPDF(pdfBytes, filename);

    // ─── Step 7: Store metadata in database ────────────────────

    try {
      // Calculate totals
      let totalHT = 0;
      for (const item of devisData.items) {
        totalHT += item.quantity * item.unitPriceHT;
      }
      const totalTVA = totalHT * ((devisData.tvaRate || 10) / 100);
      const totalTTC = totalHT + totalTVA;

      // Find or create customer contact
      let customerId = null;

      // Try to find existing customer by name
      const { data: existingCustomer } = await supabase
        .from('customer_contacts')
        .select('id')
        .eq('clientId', request.clientId)
        .eq('name', request.clientName)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Create new customer contact
        const { data: newCustomer, error: customerError } = await supabase
          .from('customer_contacts')
          .insert({
            clientId: request.clientId,
            name: request.clientName,
            email: request.clientEmail,
            adresse: request.clientAddress,
            type: 'PARTICULIER',
          })
          .select('id')
          .single();

        if (customerError || !newCustomer) {
          console.warn('[Devis] Could not create customer contact:', customerError);
          // Continue anyway, customer is optional
        } else {
          customerId = newCustomer.id;
        }
      }

      // Insert devis record (if customer exists)
      if (customerId) {
        const { error: devisError } = await supabase
          .from('devis')
          .insert({
            clientId: request.clientId,
            customerId,
            number: devisNumber,
            objet: extractedData.items.map((i) => i.description).join(', ').substring(0, 100),
            status: 'ENVOYE',
            conditions: devisData.conditions,
            totalHT: Math.round(totalHT * 100) / 100,
            totalTVA: Math.round(totalTVA * 100) / 100,
            totalTTC: Math.round(totalTTC * 100) / 100,
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });

        if (devisError) {
          console.warn('[Devis] Could not save devis to database:', devisError);
          // Don't fail, we still have the PDF URL
        }
      }
    } catch (dbErr: any) {
      console.error('[Devis] Database error:', dbErr);
      // Continue, the PDF is generated and uploaded
    }

    // ─── Step 8: Return success ────────────────────────────────

    return {
      success: true,
      documentUrl,
      devisNumber,
      message: `Devis ${devisNumber} généré avec succès ! Un document PDF a été créé et peut être envoyé au client.`,
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

/**
 * Extract devis data for template/preview
 * (used by WhatsApp flow to confirm before sending)
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

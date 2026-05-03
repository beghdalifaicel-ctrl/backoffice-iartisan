/**
 * Vision module — Analyse d'images via Anthropic Claude (vision native)
 *
 * Utilisé par WhatsApp (Marie) pour :
 * - Analyser une photo de chantier
 * - Identifier les travaux visibles
 * - Générer un descriptif + devis estimatif
 *
 * Migration 03/05/2026 : auparavant Mistral Pixtral, switch vers Claude Haiku 4.5
 * pour fiabilité (Mistral free tier retournait 429 en prod) et meilleure
 * compréhension contextuelle BTP en français. Signature publique inchangée.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const VISION_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

export interface VisionAnalysis {
  description: string;
  devisEstimatif: string;
  error?: string;
}

/**
 * Appel HTTP avec retry exponentiel sur 429 / 5xx (3 tentatives max).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    lastResponse = res;
    const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retriable || attempt === maxRetries) return res;
    const backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
    await new Promise((r) => setTimeout(r, backoffMs));
  }
  return lastResponse!;
}

/**
 * Analyse une image de chantier/travaux et génère un devis estimatif.
 * @param imageBase64 - Image en base64 (sans préfixe data:).
 * @param mimeType - MIME type (image/jpeg, image/png, image/webp, image/gif).
 * @param context - Contexte de l'artisan (métier, entreprise, etc.).
 */
export async function analyzeImageForQuote(
  imageBase64: string,
  mimeType: string,
  context: {
    company: string;
    metier: string;
    ville: string;
    firstName?: string;
    caption?: string; // Légende envoyée avec la photo
  }
): Promise<VisionAnalysis> {
  if (!ANTHROPIC_API_KEY) {
    return { description: '', devisEstimatif: '', error: 'Anthropic API non configurée' };
  }

  // Anthropic accepte uniquement image/jpeg, image/png, image/webp, image/gif.
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const safeMime = allowed.includes(mimeType) ? mimeType : 'image/jpeg';

  const captionInstruction = context.caption
    ? `\n\nL'artisan a ajouté ce commentaire avec la photo : "${context.caption}"`
    : '';

  const systemPrompt = `Tu es un assistant expert en estimation de travaux du bâtiment pour l'entreprise "${context.company}" (${context.metier} à ${context.ville}).

On t'envoie une photo d'un chantier ou d'un espace à rénover/construire.${captionInstruction}

Tu dois :
1. DÉCRIRE ce que tu vois (type de pièce, état actuel, dimensions estimées si visibles)
2. IDENTIFIER les travaux nécessaires (en cohérence avec le métier ${context.metier} et la demande de l'artisan s'il y en a une)
3. PROPOSER un devis estimatif avec des postes chiffrés réalistes pour ${context.ville}

Format ta réponse EXACTEMENT ainsi (texte brut, pas de Markdown) :

ANALYSE DE LA PHOTO
[Description de ce que tu vois en 3-5 lignes]

TRAVAUX IDENTIFIÉS
[Liste des travaux à réaliser, un par ligne]

DEVIS ESTIMATIF
[Tableau des postes : description, quantité, unité, prix unitaire HT, total HT]

TOTAL ESTIMÉ : [montant] EUR HT

Note : Ces estimations sont indicatives et basées sur l'analyse visuelle. Un devis définitif nécessite une visite sur place.`;

  try {
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 2048,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: safeMime,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text:
                  context.caption ||
                  'Analyse cette photo et propose un devis estimatif des travaux.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude vision API error:', response.status, errText.substring(0, 500));
      return {
        description: '',
        devisEstimatif: '',
        error: `Erreur API vision (${response.status})`,
      };
    }

    const data = await response.json();
    // Anthropic Messages API renvoie data.content[] avec des blocks de type 'text', 'tool_use', etc.
    const textBlock = (data.content || []).find((b: any) => b?.type === 'text');
    const content: string = textBlock?.text || '';

    if (!content) {
      console.warn('Claude vision: empty content', JSON.stringify(data).substring(0, 500));
      return {
        description: '',
        devisEstimatif: '',
        error: "Vision n'a renvoyé aucun contenu",
      };
    }

    // Split en deux parts : description (avant DEVIS ESTIMATIF) et devis.
    const devisIndex = content.indexOf('DEVIS ESTIMATIF');
    const description = devisIndex > 0 ? content.substring(0, devisIndex).trim() : content;
    const devisEstimatif = devisIndex > 0 ? content.substring(devisIndex).trim() : '';

    return {
      description,
      devisEstimatif: devisEstimatif || content,
    };
  } catch (err: any) {
    console.error('Claude vision error:', err);
    return { description: '', devisEstimatif: '', error: err?.message || String(err) };
  }
}

/**
 * Télécharge une image depuis une URL et la convertit en base64.
 */
export async function downloadImageAsBase64(
  url: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = res.headers.get('content-type') || 'image/jpeg';

    return { base64, mimeType };
  } catch {
    return null;
  }
}

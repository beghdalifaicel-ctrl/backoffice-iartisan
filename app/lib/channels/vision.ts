/**
 * Vision module — Analyse d'images via Mistral Pixtral
 *
 * Utilisé par Telegram et WhatsApp pour :
 * - Analyser une photo de chantier et générer un devis estimatif
 * - Identifier les travaux visibles sur une image
 */

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const PIXTRAL_MODEL = 'pixtral-large-latest';

export interface VisionAnalysis {
  description: string;
  devisEstimatif: string;
  error?: string;
}

/**
 * Analyse une image de chantier/travaux et génère un devis estimatif
 * @param imageBase64 - Image en base64
 * @param mimeType - MIME type (image/jpeg, image/png, etc.)
 * @param context - Contexte de l'artisan (métier, entreprise, etc.)
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
  if (!MISTRAL_API_KEY) {
    return { description: '', devisEstimatif: '', error: 'Mistral API non configurée' };
  }

  const captionInstruction = context.caption
    ? `\n\nL'artisan a ajouté ce commentaire avec la photo : "${context.caption}"`
    : '';

  const systemPrompt = `Tu es un assistant expert en estimation de travaux du bâtiment pour l'entreprise "${context.company}" (${context.metier} à ${context.ville}).

On t'envoie une photo d'un chantier ou d'un espace à rénover/construire.${captionInstruction}

Tu dois :
1. DÉCRIRE ce que tu vois (type de pièce, état actuel, dimensions estimées)
2. IDENTIFIER les travaux nécessaires
3. PROPOSER un devis estimatif avec des postes chiffrés

Format ta réponse EXACTEMENT ainsi (texte brut, pas de Markdown) :

ANALYSE DE LA PHOTO
[Description de ce que tu vois]

TRAVAUX IDENTIFIÉS
[Liste des travaux avec estimation]

DEVIS ESTIMATIF
[Tableau des postes avec prix unitaire et total]

TOTAL ESTIMÉ : [montant] EUR HT

Note : Ces estimations sont indicatives et basées sur l'analyse visuelle. Un devis définitif nécessite une visite sur place.`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: PIXTRAL_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: context.caption || 'Analyse cette photo et propose un devis estimatif des travaux.',
              },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Pixtral API error:', response.status, errText);
      return { description: '', devisEstimatif: '', error: `Erreur API vision (${response.status})` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Split content into description and devis parts
    const devisIndex = content.indexOf('DEVIS ESTIMATIF');
    const description = devisIndex > 0 ? content.substring(0, devisIndex).trim() : content;
    const devisEstimatif = devisIndex > 0 ? content.substring(devisIndex).trim() : '';

    return {
      description,
      devisEstimatif: devisEstimatif || content,
    };
  } catch (err: any) {
    console.error('Pixtral vision error:', err);
    return { description: '', devisEstimatif: '', error: err.message };
  }
}

/**
 * Télécharge une image depuis une URL et la convertit en base64
 */
export async function downloadImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
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

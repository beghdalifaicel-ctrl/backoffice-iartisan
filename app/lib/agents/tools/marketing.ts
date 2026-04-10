import { registerTool } from './registry';
import { Tool, AgentContext } from '../types';
import { sendEmail, isGmailConnected } from '../../integrations/gmail';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Helper: get artisan info ────────────────────
async function getArtisanInfo(clientId: string) {
  const { data } = await supabase
    .from('clients')
    .select('company, firstName, lastName, email, phone, siret, adresse, ville, codePostal, metier, plan')
    .eq('id', clientId)
    .single();
  return data;
}

// ── GBP Optimize ────────────────────────────
// Audits the Google Business Profile and generates actionable recommendations
// Since GBP API requires verification, we generate a full optimization report
// the artisan can apply manually or that we push when GBP API is connected.

const optimizeGBP: Tool = {
  name: 'optimize_google_business',
  description: 'Audite et génère des recommandations d\'optimisation pour la fiche Google Business Profile',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['audit', 'update_description', 'update_hours', 'add_services', 'full_optimization'],
        description: 'Action à effectuer',
      },
      currentDescription: { type: 'string', description: 'Description GBP actuelle (si connue)' },
      services: { type: 'array', items: { type: 'string' }, description: 'Services actuels listés' },
      keywords: { type: 'array', items: { type: 'string' }, description: 'Mots-clés cibles SEO local' },
      recommendations: { type: 'string', description: 'Recommandations générées par l\'IA' },
      optimizedDescription: { type: 'string', description: 'Description optimisée générée par l\'IA' },
      optimizedServices: { type: 'array', items: { type: 'string' }, description: 'Services optimisés suggérés' },
    },
    required: ['action'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    // Build the optimization report HTML
    const reportHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 30px; color: #333;">
      <div style="border-bottom: 3px solid #ff5c00; padding-bottom: 15px; margin-bottom: 25px;">
        <h1 style="color: #ff5c00; margin: 0;">🏪 Optimisation Google Business Profile</h1>
        <p style="color: #666; margin: 5px 0;">Action : ${params.action} — ${artisan.company}</p>
        <p style="color: #666; margin: 5px 0;">Date : ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      ${params.optimizedDescription ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #1a1a14;">📝 Description optimisée</h3>
        <div style="background: #f0fff0; border-left: 4px solid #28a745; padding: 15px; border-radius: 4px;">
          ${params.optimizedDescription}
        </div>
      </div>` : ''}

      ${params.recommendations ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #1a1a14;">✅ Recommandations</h3>
        <div style="background: #f7f4ef; padding: 15px; border-radius: 8px;">
          ${params.recommendations}
        </div>
      </div>` : ''}

      ${params.optimizedServices && params.optimizedServices.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #1a1a14;">🔧 Services à ajouter/mettre à jour</h3>
        <ul style="padding-left: 20px;">
          ${params.optimizedServices.map((s: string) => `<li style="margin: 5px 0;">${s}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${params.keywords && params.keywords.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #1a1a14;">🔑 Mots-clés à intégrer</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${params.keywords.map((k: string) => `<span style="background: #ff5c00; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 13px;">${k}</span>`).join('')}
        </div>
      </div>` : ''}

      <div style="margin-top: 25px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px;">
        Rapport généré par iArtisan — Agent Marketing pour ${artisan.company}.<br/>
        Appliquez ces modifications sur <a href="https://business.google.com" style="color: #ff5c00;">Google Business Profile</a>.
      </div>
    </div>`;

    // Log the optimization
    await supabase.from('agent_logs').insert({
      client_id: context.clientId,
      agent_type: 'MARKETING',
      action: `gbp.optimize.${params.action}`,
      tokens_used: 0,
      model_used: 'template',
      duration_ms: 0,
      cost_cents: 0,
      metadata: { action: params.action, hasDescription: !!params.optimizedDescription, serviceCount: params.optimizedServices?.length || 0 },
    });

    // Send report by email to artisan
    const gmailConnected = await isGmailConnected(context.clientId);
    if (gmailConnected && artisan.email) {
      try {
        await sendEmail(context.clientId, {
          to: artisan.email,
          subject: `[iArtisan] Optimisation GBP — ${params.action} — ${artisan.company}`,
          body: reportHtml,
        });
        return { success: true, action: params.action, sent: true, optimizedDescription: params.optimizedDescription || null };
      } catch (err: any) {
        return { success: true, action: params.action, sent: false, error: err.message, html: reportHtml };
      }
    }

    return { success: true, action: params.action, sent: false, html: reportHtml, message: 'Rapport GBP généré. Gmail non connecté — consultez le rapport ci-joint.' };
  },
};

// ── GBP Post ────────────────────────────
// Creates a Google Business post draft and sends it to the artisan for publishing

const postGBP: Tool = {
  name: 'create_gbp_post',
  description: 'Crée un post pour Google Business Profile et l\'envoie à l\'artisan pour publication',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['update', 'offer', 'event', 'before_after'], default: 'update' },
      content: { type: 'string', description: 'Contenu du post rédigé par l\'IA' },
      callToAction: { type: 'string', description: 'Appel à l\'action (ex: "Demandez un devis gratuit")' },
      ctaLink: { type: 'string', description: 'Lien pour le bouton CTA' },
      suggestedImage: { type: 'string', description: 'Description de l\'image recommandée' },
    },
    required: ['content'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const postTypes: Record<string, string> = {
      update: '📢 Actualité',
      offer: '🏷️ Offre spéciale',
      event: '📅 Événement',
      before_after: '🔄 Avant/Après',
    };

    const postHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
      <div style="border-bottom: 3px solid #ff5c00; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #ff5c00; margin: 0;">📱 Nouveau post GBP prêt à publier</h2>
        <p style="color: #666; margin: 5px 0;">${postTypes[params.type || 'update']} — ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style="background: #f7f4ef; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <p style="font-size: 16px; line-height: 1.6; margin: 0;">${params.content}</p>
      </div>

      ${params.callToAction ? `
      <div style="margin-bottom: 15px;">
        <strong>Bouton CTA :</strong> ${params.callToAction}
        ${params.ctaLink ? `<br/><strong>Lien :</strong> <a href="${params.ctaLink}" style="color: #ff5c00;">${params.ctaLink}</a>` : ''}
      </div>` : ''}

      ${params.suggestedImage ? `
      <div style="background: #e8f4fd; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <strong>📸 Image recommandée :</strong> ${params.suggestedImage}
      </div>` : ''}

      <div style="background: #fff3cd; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <strong>Comment publier :</strong><br/>
        1. Ouvrez <a href="https://business.google.com" style="color: #ff5c00;">Google Business Profile</a><br/>
        2. Cliquez "Ajouter une mise à jour"<br/>
        3. Copiez le texte ci-dessus et ajoutez votre photo<br/>
        4. Publiez !
      </div>

      <div style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
        Post généré par iArtisan — Agent Marketing pour ${artisan.company}.
      </div>
    </div>`;

    await supabase.from('agent_logs').insert({
      client_id: context.clientId,
      agent_type: 'MARKETING',
      action: 'gbp.post.created',
      tokens_used: 0,
      model_used: 'template',
      duration_ms: 0,
      cost_cents: 0,
      metadata: { type: params.type, contentLength: params.content.length, hasCTA: !!params.callToAction },
    });

    // Send to artisan by email
    const gmailConnected = await isGmailConnected(context.clientId);
    if (gmailConnected && artisan.email) {
      try {
        await sendEmail(context.clientId, {
          to: artisan.email,
          subject: `[iArtisan] Post GBP prêt — ${postTypes[params.type || 'update']}`,
          body: postHtml,
        });
        return { success: true, type: params.type, sent: true, contentPreview: params.content.substring(0, 100) };
      } catch (err: any) {
        return { success: true, sent: false, error: err.message };
      }
    }

    return { success: true, sent: false, html: postHtml, message: 'Post GBP généré. Gmail non connecté.' };
  },
};

// ── Review Respond ────────────────────────────
// Generates a professional response to a Google review and sends it to the artisan

const respondToReview: Tool = {
  name: 'respond_to_review',
  description: 'Génère une réponse professionnelle à un avis Google et l\'envoie à l\'artisan pour validation',
  parameters: {
    type: 'object',
    properties: {
      reviewerName: { type: 'string', description: 'Nom du client qui a laissé l\'avis' },
      reviewText: { type: 'string', description: 'Texte de l\'avis client' },
      rating: { type: 'number', description: 'Note (1-5)' },
      responseText: { type: 'string', description: 'Réponse rédigée par l\'IA' },
      tone: { type: 'string', enum: ['grateful', 'apologetic', 'professional', 'empathetic'], default: 'grateful' },
    },
    required: ['reviewText', 'rating', 'responseText'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const ratingStars = '⭐'.repeat(params.rating);
    const ratingColor = params.rating >= 4 ? '#28a745' : params.rating >= 3 ? '#ffc107' : '#dc3545';

    const reviewHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
      <div style="border-bottom: 3px solid #ff5c00; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #ff5c00; margin: 0;">💬 Réponse à un avis Google</h2>
        <p style="color: #666; margin: 5px 0;">${artisan.company} — ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style="background: #f8f9fa; border-left: 4px solid ${ratingColor}; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
        <div style="font-size: 18px; margin-bottom: 8px;">${ratingStars} <span style="color: ${ratingColor}; font-weight: bold;">(${params.rating}/5)</span></div>
        ${params.reviewerName ? `<p style="margin: 0 0 5px 0; font-weight: bold;">${params.reviewerName}</p>` : ''}
        <p style="margin: 0; font-style: italic; color: #555;">"${params.reviewText}"</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #1a1a14; margin-bottom: 10px;">✍️ Réponse suggérée :</h3>
        <div style="background: #f0fff0; border: 1px solid #28a745; padding: 15px; border-radius: 8px;">
          <p style="margin: 0; line-height: 1.6;">${params.responseText}</p>
        </div>
      </div>

      <div style="background: #fff3cd; padding: 12px; border-radius: 8px;">
        <strong>Pour publier cette réponse :</strong><br/>
        1. Ouvrez <a href="https://business.google.com" style="color: #ff5c00;">Google Business Profile</a><br/>
        2. Allez dans "Avis"<br/>
        3. Trouvez cet avis et cliquez "Répondre"<br/>
        4. Copiez la réponse ci-dessus (vous pouvez la modifier)
      </div>

      <div style="margin-top: 20px; font-size: 12px; color: #999;">
        Réponse générée par iArtisan — Agent Marketing.
      </div>
    </div>`;

    await supabase.from('agent_logs').insert({
      client_id: context.clientId,
      agent_type: 'MARKETING',
      action: 'review.responded',
      tokens_used: 0,
      model_used: 'template',
      duration_ms: 0,
      cost_cents: 0,
      metadata: { rating: params.rating, tone: params.tone, reviewerName: params.reviewerName },
    });

    const gmailConnected = await isGmailConnected(context.clientId);
    if (gmailConnected && artisan.email) {
      try {
        await sendEmail(context.clientId, {
          to: artisan.email,
          subject: `[iArtisan] Réponse avis Google ${ratingStars} — à valider`,
          body: reviewHtml,
        });
        return { success: true, sent: true, rating: params.rating, responsePreview: params.responseText.substring(0, 100) };
      } catch (err: any) {
        return { success: true, sent: false, error: err.message };
      }
    }

    return { success: true, sent: false, html: reviewHtml, response: params.responseText };
  },
};

// ── SEO Audit ────────────────────────────
// Generates a local SEO audit report with actionable recommendations

const auditSEO: Tool = {
  name: 'audit_local_seo',
  description: 'Génère un audit SEO local complet avec recommandations actionnables',
  parameters: {
    type: 'object',
    properties: {
      websiteUrl: { type: 'string', description: 'URL du site de l\'artisan' },
      keywords: { type: 'array', items: { type: 'string' }, description: 'Mots-clés à cibler' },
      auditResults: { type: 'string', description: 'Résultats d\'audit générés par l\'IA (HTML)' },
      score: { type: 'number', description: 'Score SEO estimé sur 100' },
      priorities: { type: 'array', items: { type: 'string' }, description: 'Actions prioritaires' },
      quickWins: { type: 'array', items: { type: 'string' }, description: 'Quick wins immédiats' },
    },
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const score = params.score || 0;
    const scoreColor = score >= 70 ? '#28a745' : score >= 40 ? '#ffc107' : '#dc3545';

    const auditHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 30px; color: #333;">
      <div style="border-bottom: 3px solid #ff5c00; padding-bottom: 15px; margin-bottom: 25px;">
        <h1 style="color: #ff5c00; margin: 0;">📊 Audit SEO Local</h1>
        <p style="color: #666; margin: 5px 0;">${artisan.company} — ${artisan.metier || 'Artisan BTP'}</p>
        <p style="color: #666; margin: 5px 0;">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 120px; height: 120px; border-radius: 50%; border: 8px solid ${scoreColor}; line-height: 104px; font-size: 36px; font-weight: bold; color: ${scoreColor};">
          ${score}
        </div>
        <p style="font-size: 18px; margin-top: 10px;">Score SEO Local</p>
      </div>

      ${params.websiteUrl ? `<p><strong>Site analysé :</strong> <a href="${params.websiteUrl}" style="color: #ff5c00;">${params.websiteUrl}</a></p>` : ''}

      ${params.keywords && params.keywords.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3>🔑 Mots-clés ciblés</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${params.keywords.map((k: string) => `<span style="background: #e9ecef; padding: 4px 12px; border-radius: 20px; font-size: 13px;">${k}</span>`).join('')}
        </div>
      </div>` : ''}

      ${params.auditResults ? `
      <div style="margin-bottom: 20px;">
        <h3>📋 Résultats détaillés</h3>
        <div style="background: #f7f4ef; padding: 20px; border-radius: 8px;">
          ${params.auditResults}
        </div>
      </div>` : ''}

      ${params.quickWins && params.quickWins.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #28a745;">⚡ Quick Wins (résultats rapides)</h3>
        <ul style="padding-left: 20px;">
          ${params.quickWins.map((w: string) => `<li style="margin: 8px 0; padding: 5px 0;">${w}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${params.priorities && params.priorities.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #ff5c00;">🎯 Priorités stratégiques</h3>
        <ol style="padding-left: 20px;">
          ${params.priorities.map((p: string) => `<li style="margin: 8px 0; padding: 5px 0;">${p}</li>`).join('')}
        </ol>
      </div>` : ''}

      <div style="margin-top: 25px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px;">
        Audit SEO local généré par iArtisan — Agent Marketing pour ${artisan.company}.
      </div>
    </div>`;

    await supabase.from('agent_logs').insert({
      client_id: context.clientId,
      agent_type: 'MARKETING',
      action: 'seo.audit.completed',
      tokens_used: 0,
      model_used: 'template',
      duration_ms: 0,
      cost_cents: 0,
      metadata: { score, keywordCount: params.keywords?.length || 0, websiteUrl: params.websiteUrl },
    });

    const gmailConnected = await isGmailConnected(context.clientId);
    if (gmailConnected && artisan.email) {
      try {
        await sendEmail(context.clientId, {
          to: artisan.email,
          subject: `[iArtisan] Audit SEO Local — Score ${score}/100`,
          body: auditHtml,
        });
        return { success: true, score, sent: true };
      } catch (err: any) {
        return { success: true, score, sent: false, error: err.message };
      }
    }

    return { success: true, score, sent: false, html: auditHtml };
  },
};

// ── Site Update ────────────────────────────
// Generates website content/copy suggestions for the artisan

const updateSite: Tool = {
  name: 'update_site_content',
  description: 'Génère du contenu optimisé pour le site web de l\'artisan (textes, meta, pages)',
  parameters: {
    type: 'object',
    properties: {
      pageType: { type: 'string', enum: ['home', 'services', 'about', 'contact', 'blog_post'], description: 'Type de page' },
      title: { type: 'string', description: 'Titre de la page ou de l\'article' },
      content: { type: 'string', description: 'Contenu HTML généré par l\'IA' },
      metaTitle: { type: 'string', description: 'Balise title SEO' },
      metaDescription: { type: 'string', description: 'Meta description SEO' },
      keywords: { type: 'array', items: { type: 'string' }, description: 'Mots-clés intégrés' },
    },
    required: ['pageType', 'content'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const pageLabels: Record<string, string> = {
      home: 'Page d\'accueil',
      services: 'Page Services',
      about: 'Page À propos',
      contact: 'Page Contact',
      blog_post: 'Article de blog',
    };

    const contentHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 30px; color: #333;">
      <div style="border-bottom: 3px solid #ff5c00; padding-bottom: 15px; margin-bottom: 25px;">
        <h1 style="color: #ff5c00; margin: 0;">🌐 Contenu site web</h1>
        <p style="color: #666; margin: 5px 0;">${pageLabels[params.pageType] || params.pageType} — ${artisan.company}</p>
      </div>

      ${params.metaTitle ? `
      <div style="background: #e8f4fd; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <strong>Balise &lt;title&gt; :</strong> ${params.metaTitle}<br/>
        ${params.metaDescription ? `<strong>Meta description :</strong> ${params.metaDescription}` : ''}
      </div>` : ''}

      <div style="margin-bottom: 20px;">
        <h3>${params.title || pageLabels[params.pageType]}</h3>
        <div style="background: #f7f4ef; padding: 20px; border-radius: 8px; line-height: 1.7;">
          ${params.content}
        </div>
      </div>

      ${params.keywords && params.keywords.length > 0 ? `
      <div style="margin-bottom: 15px;">
        <strong>Mots-clés intégrés :</strong>
        ${params.keywords.map((k: string) => `<span style="background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin: 0 3px;">${k}</span>`).join('')}
      </div>` : ''}

      <div style="background: #fff3cd; padding: 12px; border-radius: 8px;">
        <strong>Pour mettre à jour :</strong> Copiez ce contenu et remplacez le texte actuel de votre ${pageLabels[params.pageType]?.toLowerCase() || 'page'}. Si vous avez un CMS (WordPress, Wix, etc.), collez-le directement dans l'éditeur.
      </div>

      <div style="margin-top: 20px; font-size: 12px; color: #999;">
        Contenu généré par iArtisan — Agent Marketing.
      </div>
    </div>`;

    await supabase.from('agent_logs').insert({
      client_id: context.clientId,
      agent_type: 'MARKETING',
      action: `site.update.${params.pageType}`,
      tokens_used: 0,
      model_used: 'template',
      duration_ms: 0,
      cost_cents: 0,
      metadata: { pageType: params.pageType, hasMetaSEO: !!params.metaTitle },
    });

    const gmailConnected = await isGmailConnected(context.clientId);
    if (gmailConnected && artisan.email) {
      try {
        await sendEmail(context.clientId, {
          to: artisan.email,
          subject: `[iArtisan] Contenu ${pageLabels[params.pageType]} prêt — ${artisan.company}`,
          body: contentHtml,
        });
        return { success: true, pageType: params.pageType, sent: true };
      } catch (err: any) {
        return { success: true, pageType: params.pageType, sent: false, error: err.message };
      }
    }

    return { success: true, pageType: params.pageType, sent: false, html: contentHtml };
  },
};

// ── Social Post ────────────────────────────
// Generates social media posts for the artisan (Facebook, Instagram, LinkedIn)

const socialPost: Tool = {
  name: 'create_social_post',
  description: 'Génère un post pour les réseaux sociaux (Facebook, Instagram, LinkedIn)',
  parameters: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['facebook', 'instagram', 'linkedin', 'all'], default: 'all' },
      topic: { type: 'string', description: 'Sujet du post' },
      content: { type: 'string', description: 'Texte du post rédigé par l\'IA' },
      hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags recommandés' },
      suggestedImage: { type: 'string', description: 'Description de l\'image/photo recommandée' },
      bestPostingTime: { type: 'string', description: 'Meilleur moment pour publier' },
    },
    required: ['content'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const platformEmoji: Record<string, string> = {
      facebook: '📘',
      instagram: '📸',
      linkedin: '💼',
      all: '📱',
    };

    const socialHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
      <div style="border-bottom: 3px solid #ff5c00; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #ff5c00; margin: 0;">${platformEmoji[params.platform || 'all']} Post réseaux sociaux</h2>
        <p style="color: #666; margin: 5px 0;">Plateforme : ${params.platform === 'all' ? 'Toutes' : params.platform} — ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style="background: #f7f4ef; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <p style="font-size: 15px; line-height: 1.7; margin: 0; white-space: pre-wrap;">${params.content}</p>
        ${params.hashtags && params.hashtags.length > 0 ? `
        <p style="color: #1a73e8; margin: 10px 0 0 0;">${params.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')}</p>` : ''}
      </div>

      ${params.suggestedImage ? `
      <div style="background: #e8f4fd; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <strong>📸 Photo recommandée :</strong> ${params.suggestedImage}
      </div>` : ''}

      ${params.bestPostingTime ? `
      <div style="margin-bottom: 15px;">
        <strong>🕐 Meilleur moment pour publier :</strong> ${params.bestPostingTime}
      </div>` : ''}

      <div style="background: #fff3cd; padding: 12px; border-radius: 8px;">
        <strong>Conseil :</strong> Ajoutez une photo de vos chantiers pour un maximum d'engagement. Les posts avec images reçoivent 2 à 3 fois plus de visibilité.
      </div>

      <div style="margin-top: 20px; font-size: 12px; color: #999;">
        Post généré par iArtisan — Agent Marketing pour ${artisan.company}.
      </div>
    </div>`;

    await supabase.from('agent_logs').insert({
      client_id: context.clientId,
      agent_type: 'MARKETING',
      action: 'social.post.created',
      tokens_used: 0,
      model_used: 'template',
      duration_ms: 0,
      cost_cents: 0,
      metadata: { platform: params.platform, topic: params.topic, hashtagCount: params.hashtags?.length || 0 },
    });

    const gmailConnected = await isGmailConnected(context.clientId);
    if (gmailConnected && artisan.email) {
      try {
        await sendEmail(context.clientId, {
          to: artisan.email,
          subject: `[iArtisan] Post ${params.platform || 'réseaux sociaux'} prêt à publier`,
          body: socialHtml,
        });
        return { success: true, platform: params.platform, sent: true, contentPreview: params.content.substring(0, 100) };
      } catch (err: any) {
        return { success: true, sent: false, error: err.message };
      }
    }

    return { success: true, sent: false, html: socialHtml };
  },
};

// Register all marketing tools
registerTool('gbp.optimize', optimizeGBP);
registerTool('gbp.post', postGBP);
registerTool('review.respond', respondToReview);
registerTool('seo.audit', auditSEO);
registerTool('site.update', updateSite);
registerTool('social.post', socialPost);

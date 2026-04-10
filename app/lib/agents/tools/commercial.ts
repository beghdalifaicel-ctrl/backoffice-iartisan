import { registerTool } from './registry';
import { Tool, AgentContext } from '../types';
import { sendEmail, isGmailConnected, listEmails } from '../../integrations/gmail';
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

// ── Lead Scrape ────────────────────────────
// Since we can't run browser scraping in a serverless function,
// this tool generates a prospecting list based on LLM knowledge
// and stores it in the DB for the artisan to action.

const scrapeLeads: Tool = {
  name: 'scrape_directory_leads',
  description: 'Génère une liste de prospects potentiels pour l\'artisan basée sur sa zone et son métier',
  parameters: {
    type: 'object',
    properties: {
      zone: { type: 'string', description: 'Zone géographique (ville ou département)' },
      metier: { type: 'string', description: 'Métier / activité recherchée' },
      leads: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            company: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            address: { type: 'string' },
            source: { type: 'string' },
            notes: { type: 'string' },
          },
        },
        description: 'Liste de prospects générée par l\'IA',
      },
      directories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Annuaires consultés',
      },
      searchStrategy: { type: 'string', description: 'Stratégie de recherche utilisée par l\'IA' },
    },
    required: ['zone', 'metier'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const leads = params.leads || [];

    // Build HTML report
    const reportHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 30px; color: #333;">
      <div style="border-bottom: 3px solid #ff5c00; padding-bottom: 15px; margin-bottom: 25px;">
        <h1 style="color: #ff5c00; margin: 0;">🔍 Prospects identifiés</h1>
        <p style="color: #666; margin: 5px 0;">Zone : ${params.zone} — Métier : ${params.metier}</p>
        <p style="color: #666; margin: 5px 0;">${leads.length} prospect(s) trouvé(s) — ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      ${params.searchStrategy ? `
      <div style="background: #e8f4fd; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
        <strong>📋 Stratégie :</strong> ${params.searchStrategy}
      </div>` : ''}

      ${leads.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <thead>
          <tr style="background: #1a1a14; color: #fff;">
            <th style="padding: 10px; text-align: left;">Entreprise</th>
            <th style="padding: 10px; text-align: left;">Contact</th>
            <th style="padding: 10px; text-align: left;">Coordonnées</th>
            <th style="padding: 10px; text-align: left;">Source</th>
          </tr>
        </thead>
        <tbody>
          ${leads.map((l: any, i: number) => `
          <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9f9f9'}; border-bottom: 1px solid #eee;">
            <td style="padding: 10px;"><strong>${l.company || l.name}</strong>${l.notes ? `<br/><span style="font-size: 12px; color: #666;">${l.notes}</span>` : ''}</td>
            <td style="padding: 10px;">${l.name || '-'}</td>
            <td style="padding: 10px;">
              ${l.phone ? `📞 ${l.phone}<br/>` : ''}
              ${l.email ? `✉️ ${l.email}<br/>` : ''}
              ${l.address ? `📍 ${l.address}` : ''}
            </td>
            <td style="padding: 10px; font-size: 12px;">${l.source || 'IA'}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<p>Aucun prospect identifié pour cette recherche.</p>'}

      ${params.directories && params.directories.length > 0 ? `
      <div style="margin-bottom: 15px; font-size: 13px; color: #666;">
        <strong>Annuaires recommandés :</strong> ${params.directories.join(', ')}
      </div>` : ''}

      <div style="margin-top: 25px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px;">
        Rapport généré par iArtisan — Agent Commercial pour ${artisan.company}.
      </div>
    </div>`;

    // Store leads in DB
    for (const lead of leads) {
      await supabase.from('agent_logs').insert({
        client_id: context.clientId,
        agent_type: 'COMMERCIAL',
        action: 'lead.scraped',
        tokens_used: 0,
        model_used: 'template',
        duration_ms: 0,
        cost_cents: 0,
        metadata: { leadName: lead.name, leadCompany: lead.company, zone: params.zone, source: lead.source },
      });
    }

    // Send report by email
    const gmailConnected = await isGmailConnected(context.clientId);
    if (gmailConnected && artisan.email) {
      try {
        await sendEmail(context.clientId, {
          to: artisan.email,
          subject: `[iArtisan] ${leads.length} prospects trouvés — ${params.zone} — ${params.metier}`,
          body: reportHtml,
        });
        return { success: true, leadCount: leads.length, zone: params.zone, sent: true };
      } catch (err: any) {
        return { success: true, leadCount: leads.length, sent: false, error: err.message };
      }
    }

    return { success: true, leadCount: leads.length, sent: false, html: reportHtml };
  },
};

// ── Lead Qualify ────────────────────────────
// Analyzes a lead and returns a qualification score with reasoning

const qualifyLead: Tool = {
  name: 'qualify_lead',
  description: 'Qualifie un lead en analysant ses informations et attribue un score',
  parameters: {
    type: 'object',
    properties: {
      leadName: { type: 'string', description: 'Nom du prospect' },
      leadCompany: { type: 'string', description: 'Entreprise du prospect' },
      leadEmail: { type: 'string' },
      leadPhone: { type: 'string' },
      message: { type: 'string', description: 'Message ou demande du prospect' },
      source: { type: 'string', description: 'Source du lead (site, GBP, annuaire, bouche à oreille)' },
      score: { type: 'number', description: 'Score de qualification (0-100) calculé par l\'IA' },
      qualification: { type: 'string', enum: ['HOT', 'WARM', 'COLD', 'DISQUALIFIED'], description: 'Niveau de qualification' },
      reasoning: { type: 'string', description: 'Justification de la qualification par l\'IA' },
      nextAction: { type: 'string', description: 'Prochaine action recommandée' },
      budget: { type: 'string', description: 'Budget estimé si mentionné' },
      urgency: { type: 'string', enum: ['immediate', 'this_week', 'this_month', 'no_rush'], description: 'Urgence du besoin' },
    },
    required: ['leadName', 'message', 'score', 'qualification'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const qualColors: Record<string, string> = {
      HOT: '#dc3545',
      WARM: '#ffc107',
      COLD: '#17a2b8',
      DISQUALIFIED: '#6c757d',
    };
    const qualLabels: Record<string, string> = {
      HOT: '🔥 CHAUD — À contacter immédiatement',
      WARM: '☀️ TIÈDE — À relancer sous 48h',
      COLD: '❄️ FROID — À nurturiser',
      DISQUALIFIED: '❌ Disqualifié',
    };

    const qualHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
      <div style="border-bottom: 3px solid #ff5c00; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #ff5c00; margin: 0;">📊 Qualification Lead</h2>
        <p style="color: #666; margin: 5px 0;">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style="background: ${qualColors[params.qualification]}15; border-left: 4px solid ${qualColors[params.qualification]}; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
        <h3 style="margin: 0; color: ${qualColors[params.qualification]};">${qualLabels[params.qualification]}</h3>
        <p style="margin: 5px 0; font-size: 24px; font-weight: bold;">Score : ${params.score}/100</p>
      </div>

      <div style="margin-bottom: 15px;">
        <strong>Prospect :</strong> ${params.leadName}${params.leadCompany ? ` — ${params.leadCompany}` : ''}<br/>
        ${params.leadEmail ? `<strong>Email :</strong> ${params.leadEmail}<br/>` : ''}
        ${params.leadPhone ? `<strong>Tél :</strong> ${params.leadPhone}<br/>` : ''}
        ${params.source ? `<strong>Source :</strong> ${params.source}<br/>` : ''}
        ${params.urgency ? `<strong>Urgence :</strong> ${params.urgency}<br/>` : ''}
        ${params.budget ? `<strong>Budget :</strong> ${params.budget}<br/>` : ''}
      </div>

      <div style="margin-bottom: 15px;">
        <strong>Demande :</strong><br/>
        <div style="background: #f7f4ef; padding: 12px; border-radius: 8px; font-style: italic;">${params.message}</div>
      </div>

      ${params.reasoning ? `
      <div style="margin-bottom: 15px;">
        <strong>Analyse :</strong><br/>
        <p style="line-height: 1.6;">${params.reasoning}</p>
      </div>` : ''}

      ${params.nextAction ? `
      <div style="background: #d4edda; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <strong>➡️ Prochaine action :</strong> ${params.nextAction}
      </div>` : ''}

      <div style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
        Qualification par iArtisan — Agent Commercial.
      </div>
    </div>`;

    // Log qualification
    await supabase.from('agent_logs').insert({
      client_id: context.clientId,
      agent_type: 'COMMERCIAL',
      action: 'lead.qualified',
      tokens_used: 0,
      model_used: 'template',
      duration_ms: 0,
      cost_cents: 0,
      metadata: {
        leadName: params.leadName,
        score: params.score,
        qualification: params.qualification,
        source: params.source,
        urgency: params.urgency,
      },
    });

    // Send to artisan
    const gmailConnected = await isGmailConnected(context.clientId);
    if (gmailConnected && artisan.email) {
      try {
        await sendEmail(context.clientId, {
          to: artisan.email,
          subject: `[iArtisan] Lead ${params.qualification} — ${params.leadName} (${params.score}/100)`,
          body: qualHtml,
        });
        return { success: true, score: params.score, qualification: params.qualification, sent: true, nextAction: params.nextAction };
      } catch (err: any) {
        return { success: true, score: params.score, qualification: params.qualification, sent: false, error: err.message };
      }
    }

    return { success: true, score: params.score, qualification: params.qualification, sent: false, html: qualHtml };
  },
};

// ── Lead Respond ────────────────────────────
// Responds to an incoming lead with a personalized email

const respondToLead: Tool = {
  name: 'respond_to_lead',
  description: 'Envoie une réponse personnalisée à un lead entrant (demande de devis, contact site, etc.)',
  parameters: {
    type: 'object',
    properties: {
      leadEmail: { type: 'string', description: 'Email du prospect' },
      leadName: { type: 'string', description: 'Nom du prospect' },
      originalMessage: { type: 'string', description: 'Message original du prospect' },
      responseSubject: { type: 'string', description: 'Objet de la réponse' },
      responseBody: { type: 'string', description: 'Corps de la réponse rédigé par l\'IA (HTML)' },
      replyToMessageId: { type: 'string', description: 'ID du message original pour répondre dans le thread' },
      threadId: { type: 'string', description: 'ID du thread Gmail' },
    },
    required: ['leadEmail', 'leadName', 'responseSubject', 'responseBody'],
  },
  execute: async (params, context) => {
    const connected = await isGmailConnected(context.clientId);
    if (!connected) {
      return {
        error: 'Gmail non connecté',
        draftResponse: { subject: params.responseSubject, body: params.responseBody, to: params.leadEmail },
      };
    }

    try {
      const result = await sendEmail(context.clientId, {
        to: params.leadEmail,
        subject: params.responseSubject,
        body: params.responseBody,
        replyToMessageId: params.replyToMessageId,
        threadId: params.threadId,
      });

      await supabase.from('agent_logs').insert({
        client_id: context.clientId,
        agent_type: 'COMMERCIAL',
        action: 'lead.responded',
        tokens_used: 0,
        model_used: 'template',
        duration_ms: 0,
        cost_cents: 0,
        metadata: { leadName: params.leadName, leadEmail: params.leadEmail },
      });

      return { sent: true, messageId: result.id, threadId: result.threadId, to: params.leadEmail };
    } catch (err: any) {
      return { error: `Erreur envoi: ${err.message}` };
    }
  },
};

// ── Prospect Email ────────────────────────────
// Sends a cold outreach email to a potential prospect

const prospectEmail: Tool = {
  name: 'send_prospect_email',
  description: 'Envoie un email de prospection personnalisé à un prospect identifié',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Email du prospect' },
      prospectName: { type: 'string', description: 'Nom du prospect' },
      prospectCompany: { type: 'string', description: 'Entreprise du prospect' },
      subject: { type: 'string', description: 'Objet de l\'email' },
      body: { type: 'string', description: 'Corps du message personnalisé (HTML)' },
      angle: { type: 'string', description: 'Angle d\'approche (nouveau chantier, avis en ligne, partenariat, etc.)' },
    },
    required: ['to', 'prospectName', 'subject', 'body'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const connected = await isGmailConnected(context.clientId);
    if (!connected) {
      return {
        error: 'Gmail non connecté',
        draft: { to: params.to, subject: params.subject, body: params.body },
        message: 'Email de prospection prêt mais Gmail non connecté.',
      };
    }

    try {
      const result = await sendEmail(context.clientId, {
        to: params.to,
        subject: params.subject,
        body: params.body,
      });

      await supabase.from('agent_logs').insert({
        client_id: context.clientId,
        agent_type: 'COMMERCIAL',
        action: 'prospect.email.sent',
        tokens_used: 0,
        model_used: 'template',
        duration_ms: 0,
        cost_cents: 0,
        metadata: {
          prospectName: params.prospectName,
          prospectCompany: params.prospectCompany,
          angle: params.angle,
          to: params.to,
        },
      });

      return { sent: true, messageId: result.id, to: params.to, prospectName: params.prospectName };
    } catch (err: any) {
      return { error: `Erreur envoi: ${err.message}` };
    }
  },
};

// ── Invoice Collect ────────────────────────────
// Sends payment reminder emails with escalating tone

const collectInvoice: Tool = {
  name: 'collect_unpaid_invoice',
  description: 'Envoie une relance de paiement pour facture impayée avec ton adapté au niveau de relance',
  parameters: {
    type: 'object',
    properties: {
      clientEmail: { type: 'string', description: 'Email du débiteur' },
      clientName: { type: 'string', description: 'Nom du client' },
      invoiceNumber: { type: 'string', description: 'Numéro de la facture' },
      amount: { type: 'number', description: 'Montant en euros TTC' },
      dueDate: { type: 'string', description: 'Date d\'échéance initiale' },
      relanceLevel: { type: 'number', description: '1=amicale, 2=ferme, 3=mise en demeure', default: 1 },
      subject: { type: 'string', description: 'Objet de l\'email de relance' },
      body: { type: 'string', description: 'Corps du message rédigé par l\'IA (HTML)' },
    },
    required: ['clientEmail', 'amount', 'subject', 'body'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const connected = await isGmailConnected(context.clientId);
    if (!connected) {
      return {
        error: 'Gmail non connecté',
        draft: { to: params.clientEmail, subject: params.subject, body: params.body },
      };
    }

    const relanceLabels = ['', 'Relance amicale', 'Relance ferme', 'Mise en demeure'];
    const level = params.relanceLevel || 1;

    try {
      const result = await sendEmail(context.clientId, {
        to: params.clientEmail,
        subject: params.subject,
        body: params.body,
      });

      await supabase.from('agent_logs').insert({
        client_id: context.clientId,
        agent_type: 'COMMERCIAL',
        action: `invoice.collect.level${level}`,
        tokens_used: 0,
        model_used: 'template',
        duration_ms: 0,
        cost_cents: 0,
        metadata: {
          clientEmail: params.clientEmail,
          clientName: params.clientName,
          invoiceNumber: params.invoiceNumber,
          amount: params.amount,
          relanceLevel: level,
          relanceType: relanceLabels[level],
        },
      });

      return {
        sent: true,
        messageId: result.id,
        relanceLevel: level,
        relanceType: relanceLabels[level],
        amount: params.amount,
        to: params.clientEmail,
      };
    } catch (err: any) {
      return { error: `Erreur envoi: ${err.message}` };
    }
  },
};

// ── Directory Enroll ────────────────────────────
// Generates directory listing content and sends instructions to the artisan

const enrollDirectory: Tool = {
  name: 'enroll_in_directory',
  description: 'Prépare l\'inscription de l\'artisan sur un annuaire professionnel et envoie les instructions',
  parameters: {
    type: 'object',
    properties: {
      directory: { type: 'string', description: 'Nom de l\'annuaire (PagesJaunes, Houzz, Habitatpresto, etc.)' },
      directoryUrl: { type: 'string', description: 'URL d\'inscription de l\'annuaire' },
      profileContent: { type: 'string', description: 'Texte de profil optimisé rédigé par l\'IA' },
      services: { type: 'array', items: { type: 'string' }, description: 'Services à lister' },
      keywords: { type: 'array', items: { type: 'string' }, description: 'Mots-clés pour le référencement' },
      instructions: { type: 'string', description: 'Instructions étape par étape pour l\'inscription' },
    },
    required: ['directory'],
  },
  execute: async (params, context) => {
    const artisan = await getArtisanInfo(context.clientId);
    if (!artisan) return { error: 'Client artisan non trouvé' };

    const enrollHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 30px; color: #333;">
      <div style="border-bottom: 3px solid #ff5c00; padding-bottom: 15px; margin-bottom: 25px;">
        <h1 style="color: #ff5c00; margin: 0;">📋 Inscription annuaire</h1>
        <p style="color: #666; margin: 5px 0;">${params.directory} — ${artisan.company}</p>
        <p style="color: #666; margin: 5px 0;">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      ${params.directoryUrl ? `
      <div style="background: #d4edda; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
        <strong>🔗 Lien d'inscription :</strong> <a href="${params.directoryUrl}" style="color: #ff5c00;">${params.directoryUrl}</a>
      </div>` : ''}

      <div style="margin-bottom: 20px;">
        <h3>📝 Informations de votre entreprise</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Entreprise</td><td style="padding: 8px;">${artisan.company}</td></tr>
          <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Gérant</td><td style="padding: 8px;">${artisan.firstName} ${artisan.lastName}</td></tr>
          <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Métier</td><td style="padding: 8px;">${artisan.metier || 'Artisan BTP'}</td></tr>
          <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Téléphone</td><td style="padding: 8px;">${artisan.phone || '-'}</td></tr>
          <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Email</td><td style="padding: 8px;">${artisan.email || '-'}</td></tr>
          ${artisan.siret ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">SIRET</td><td style="padding: 8px;">${artisan.siret}</td></tr>` : ''}
          ${artisan.adresse ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Adresse</td><td style="padding: 8px;">${artisan.adresse}, ${artisan.codePostal || ''} ${artisan.ville || ''}</td></tr>` : ''}
        </table>
      </div>

      ${params.profileContent ? `
      <div style="margin-bottom: 20px;">
        <h3>✍️ Description de profil optimisée</h3>
        <div style="background: #f0fff0; border: 1px solid #28a745; padding: 15px; border-radius: 8px;">
          ${params.profileContent}
        </div>
        <p style="font-size: 12px; color: #666; margin-top: 5px;">Copiez ce texte dans le champ "Description" ou "À propos" de l'annuaire.</p>
      </div>` : ''}

      ${params.services && params.services.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3>🔧 Services à lister</h3>
        <ul style="padding-left: 20px;">
          ${params.services.map((s: string) => `<li style="margin: 5px 0;">${s}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${params.keywords && params.keywords.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3>🔑 Mots-clés à intégrer</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${params.keywords.map((k: string) => `<span style="background: #ff5c00; color: #fff; padding: 3px 10px; border-radius: 15px; font-size: 12px;">${k}</span>`).join('')}
        </div>
      </div>` : ''}

      ${params.instructions ? `
      <div style="margin-bottom: 20px;">
        <h3>📖 Étapes d'inscription</h3>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px;">
          ${params.instructions}
        </div>
      </div>` : ''}

      <div style="margin-top: 25px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px;">
        Guide d'inscription généré par iArtisan — Agent Commercial pour ${artisan.company}.
      </div>
    </div>`;

    await supabase.from('agent_logs').insert({
      client_id: context.clientId,
      agent_type: 'COMMERCIAL',
      action: 'directory.enroll.prepared',
      tokens_used: 0,
      model_used: 'template',
      duration_ms: 0,
      cost_cents: 0,
      metadata: { directory: params.directory, directoryUrl: params.directoryUrl, serviceCount: params.services?.length || 0 },
    });

    const gmailConnected = await isGmailConnected(context.clientId);
    if (gmailConnected && artisan.email) {
      try {
        await sendEmail(context.clientId, {
          to: artisan.email,
          subject: `[iArtisan] Inscription ${params.directory} — guide prêt`,
          body: enrollHtml,
        });
        return { success: true, directory: params.directory, sent: true };
      } catch (err: any) {
        return { success: true, directory: params.directory, sent: false, error: err.message };
      }
    }

    return { success: true, directory: params.directory, sent: false, html: enrollHtml };
  },
};

// Register all commercial tools
registerTool('lead.scrape', scrapeLeads);
registerTool('lead.qualify', qualifyLead);
registerTool('lead.respond', respondToLead);
registerTool('prospect.email', prospectEmail);
registerTool('invoice.collect', collectInvoice);
registerTool('directory.enroll', enrollDirectory);

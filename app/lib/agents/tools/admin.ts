import { registerTool } from './registry';
import { Tool, AgentContext } from '../types';
import { listEmails, sendEmail, isGmailConnected } from '../../integrations/gmail';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Email Tools ────────────────────────────

const emailRead: Tool = {
  name: 'read_emails',
  description: 'Lit les derniers emails non lus du client artisan',
  parameters: {
    type: 'object',
    properties: {
      maxResults: { type: 'number', description: 'Nombre max d\'emails à lire', default: 10 },
      filter: { type: 'string', description: 'Filtre optionnel (ex: "devis", "urgent")' },
      unreadOnly: { type: 'boolean', description: 'Ne lire que les non lus', default: true },
    },
  },
  execute: async (params, context) => {
    const connected = await isGmailConnected(context.clientId);
    if (!connected) return { error: 'Gmail non connecté. L\'artisan doit d\'abord autoriser l\'accès.' };

    try {
      const emails = await listEmails(context.clientId, {
        maxResults: params.maxResults || 10,
        query: params.filter,
        unreadOnly: params.unreadOnly !== false,
      });

      return {
        count: emails.length,
        emails: emails.map(e => ({
          id: e.id,
          threadId: e.threadId,
          from: e.from,
          subject: e.subject,
          body: e.body.substring(0, 2000),
          date: e.date,
          isUnread: e.isUnread,
        })),
      };
    } catch (err: any) {
      return { error: `Erreur Gmail: ${err.message}` };
    }
  },
};

const emailReply: Tool = {
  name: 'send_email',
  description: 'Envoie un email au nom de l\'artisan',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Adresse email du destinataire' },
      subject: { type: 'string', description: 'Objet de l\'email' },
      body: { type: 'string', description: 'Corps du message (HTML supporté)' },
      replyToMessageId: { type: 'string', description: 'ID du message auquel répondre (optionnel)' },
      threadId: { type: 'string', description: 'ID du thread pour garder la conversation groupée' },
    },
    required: ['to', 'subject', 'body'],
  },
  execute: async (params, context) => {
    const connected = await isGmailConnected(context.clientId);
    if (!connected) return { error: 'Gmail non connecté' };

    try {
      const result = await sendEmail(context.clientId, {
        to: params.to,
        subject: params.subject,
        body: params.body,
        replyToMessageId: params.replyToMessageId,
        threadId: params.threadId,
      });

      return { sent: true, messageId: result.id, threadId: result.threadId };
    } catch (err: any) {
      return { error: `Erreur envoi: ${err.message}` };
    }
  },
};

// ── Quote Tool ────────────────────────────

const generateQuote: Tool = {
  name: 'generate_quote',
  description: 'Génère un devis professionnel HTML et l\'envoie par email au client',
  parameters: {
    type: 'object',
    properties: {
      clientName: { type: 'string', description: 'Nom du client' },
      clientEmail: { type: 'string', description: 'Email du client' },
      clientPhone: { type: 'string', description: 'Téléphone du client' },
      clientAddress: { type: 'string', description: 'Adresse du client' },
      description: { type: 'string', description: 'Description des travaux' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'number' },
            unit: { type: 'string', description: 'unité (m², ml, h, forfait)' },
          },
        },
        description: 'Lignes du devis',
      },
      validityDays: { type: 'number', default: 30 },
      notes: { type: 'string', description: 'Conditions ou notes supplémentaires' },
    },
    required: ['clientName', 'description', 'items'],
  },
  execute: async (params, context) => {
    // Get artisan info
    const { data: client } = await supabase
      .from('clients')
      .select('company, firstName, lastName, email, phone, siret, adresse, ville, codePostal, metier')
      .eq('id', context.clientId)
      .single();

    if (!client) return { error: 'Client artisan non trouvé' };

    const quoteNumber = `DEV-${Date.now().toString(36).toUpperCase()}`;
    const today = new Date().toLocaleDateString('fr-FR');
    const validUntil = new Date(Date.now() + (params.validityDays || 30) * 86400000).toLocaleDateString('fr-FR');

    // Calculate totals
    const lines = (params.items || []).map((item: any) => ({
      label: item.label,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      unit: item.unit || 'forfait',
      total: (item.quantity || 1) * (item.unitPrice || 0),
    }));
    const totalHT = lines.reduce((sum: number, l: any) => sum + l.total, 0);
    const tva = totalHT * 0.20;
    const totalTTC = totalHT + tva;

    // Generate professional HTML quote
    const quoteHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333;">
      <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #ff5c00; padding-bottom: 20px; margin-bottom: 30px;">
        <div>
          <h1 style="color: #ff5c00; margin: 0; font-size: 28px;">DEVIS</h1>
          <p style="margin: 5px 0; color: #666;">N° ${quoteNumber}</p>
          <p style="margin: 5px 0; color: #666;">Date : ${today}</p>
          <p style="margin: 5px 0; color: #666;">Valide jusqu'au : ${validUntil}</p>
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0; color: #1a1a14;">${client.company}</h2>
          <p style="margin: 3px 0; font-size: 14px;">${client.firstName} ${client.lastName}</p>
          ${client.adresse ? `<p style="margin: 3px 0; font-size: 14px;">${client.adresse}</p>` : ''}
          ${client.ville ? `<p style="margin: 3px 0; font-size: 14px;">${client.codePostal || ''} ${client.ville}</p>` : ''}
          ${client.siret ? `<p style="margin: 3px 0; font-size: 14px;">SIRET : ${client.siret}</p>` : ''}
          <p style="margin: 3px 0; font-size: 14px;">${client.phone || ''}</p>
        </div>
      </div>

      <div style="background: #f7f4ef; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 5px 0;">Client : ${params.clientName}</h3>
        ${params.clientAddress ? `<p style="margin: 3px 0; font-size: 14px;">${params.clientAddress}</p>` : ''}
        ${params.clientEmail ? `<p style="margin: 3px 0; font-size: 14px;">${params.clientEmail}</p>` : ''}
        ${params.clientPhone ? `<p style="margin: 3px 0; font-size: 14px;">${params.clientPhone}</p>` : ''}
      </div>

      <p style="margin-bottom: 20px;"><strong>Objet :</strong> ${params.description}</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <thead>
          <tr style="background: #1a1a14; color: #fff;">
            <th style="padding: 10px; text-align: left;">Désignation</th>
            <th style="padding: 10px; text-align: center; width: 80px;">Qté</th>
            <th style="padding: 10px; text-align: center; width: 80px;">Unité</th>
            <th style="padding: 10px; text-align: right; width: 100px;">PU HT</th>
            <th style="padding: 10px; text-align: right; width: 100px;">Total HT</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map((l: any, i: number) => `
          <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9f9f9'}; border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${l.label}</td>
            <td style="padding: 10px; text-align: center;">${l.quantity}</td>
            <td style="padding: 10px; text-align: center;">${l.unit}</td>
            <td style="padding: 10px; text-align: right;">${l.unitPrice.toFixed(2)} €</td>
            <td style="padding: 10px; text-align: right;">${l.total.toFixed(2)} €</td>
          </tr>`).join('')}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end;">
        <table style="width: 250px;">
          <tr><td style="padding: 5px;">Total HT</td><td style="padding: 5px; text-align: right; font-weight: bold;">${totalHT.toFixed(2)} €</td></tr>
          <tr><td style="padding: 5px;">TVA (20%)</td><td style="padding: 5px; text-align: right;">${tva.toFixed(2)} €</td></tr>
          <tr style="border-top: 2px solid #ff5c00;"><td style="padding: 8px 5px; font-weight: bold; font-size: 18px;">Total TTC</td><td style="padding: 8px 5px; text-align: right; font-weight: bold; font-size: 18px; color: #ff5c00;">${totalTTC.toFixed(2)} €</td></tr>
        </table>
      </div>

      ${params.notes ? `<div style="margin-top: 25px; padding: 15px; background: #f7f4ef; border-radius: 8px; font-size: 13px;"><strong>Conditions :</strong><br/>${params.notes}</div>` : ''}

      <div style="margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px;">
        <p>Devis généré automatiquement par iArtisan pour ${client.company}.</p>
        <p>Pour accepter ce devis, merci de répondre à cet email avec la mention "Bon pour accord".</p>
      </div>
    </div>`;

    // Store quote in DB
    const quoteId = `quote-${Date.now()}`;
    await supabase.from('agent_logs').insert({
      client_id: context.clientId,
      agent_type: 'ADMIN',
      action: 'quote.generated',
      tokens_used: 0,
      model_used: 'template',
      duration_ms: 0,
      cost_cents: 0,
      metadata: {
        quoteNumber,
        clientName: params.clientName,
        clientEmail: params.clientEmail,
        totalHT,
        totalTTC,
        items: lines,
      },
    });

    // Send by email if client email provided and Gmail connected
    if (params.clientEmail) {
      const gmailConnected = await isGmailConnected(context.clientId);
      if (gmailConnected) {
        try {
          await sendEmail(context.clientId, {
            to: params.clientEmail,
            subject: `Devis ${quoteNumber} — ${client.company}`,
            body: quoteHtml,
          });
          return { quoteId: quoteNumber, sent: true, totalHT, totalTTC, clientEmail: params.clientEmail };
        } catch (err: any) {
          return { quoteId: quoteNumber, sent: false, error: err.message, totalHT, totalTTC, html: quoteHtml };
        }
      }
    }

    return { quoteId: quoteNumber, sent: false, totalHT, totalTTC, html: quoteHtml, message: 'Devis généré. Gmail non connecté — envoi manuel nécessaire.' };
  },
};

// ── Invoice Tool ────────────────────────────

const generateInvoice: Tool = {
  name: 'generate_invoice',
  description: 'Génère une facture professionnelle HTML et l\'envoie par email',
  parameters: {
    type: 'object',
    properties: {
      clientName: { type: 'string' },
      clientEmail: { type: 'string' },
      clientAddress: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'number' },
            unit: { type: 'string' },
          },
        },
      },
      dueDate: { type: 'string', description: 'Date d\'échéance (YYYY-MM-DD)' },
      paymentMethod: { type: 'string', description: 'Mode de paiement (virement, chèque, CB)', default: 'virement' },
    },
    required: ['clientName', 'items'],
  },
  execute: async (params, context) => {
    const { data: client } = await supabase
      .from('clients')
      .select('company, firstName, lastName, siret, adresse, ville, codePostal, phone')
      .eq('id', context.clientId)
      .single();

    if (!client) return { error: 'Client artisan non trouvé' };

    const invoiceNumber = `FA-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    const today = new Date().toLocaleDateString('fr-FR');
    const dueDate = params.dueDate ? new Date(params.dueDate).toLocaleDateString('fr-FR') : new Date(Date.now() + 30 * 86400000).toLocaleDateString('fr-FR');

    const lines = (params.items || []).map((item: any) => ({
      label: item.label,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      unit: item.unit || 'forfait',
      total: (item.quantity || 1) * (item.unitPrice || 0),
    }));
    const totalHT = lines.reduce((sum: number, l: any) => sum + l.total, 0);
    const tva = totalHT * 0.20;
    const totalTTC = totalHT + tva;

    const invoiceHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333;">
      <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #ff5c00; padding-bottom: 20px; margin-bottom: 30px;">
        <div>
          <h1 style="color: #ff5c00; margin: 0; font-size: 28px;">FACTURE</h1>
          <p style="margin: 5px 0;">N° ${invoiceNumber}</p>
          <p style="margin: 5px 0;">Date : ${today}</p>
          <p style="margin: 5px 0;">Échéance : ${dueDate}</p>
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0;">${client.company}</h2>
          <p style="margin: 3px 0; font-size: 14px;">${client.firstName} ${client.lastName}</p>
          ${client.siret ? `<p style="margin: 3px 0; font-size: 14px;">SIRET : ${client.siret}</p>` : ''}
          ${client.adresse ? `<p style="margin: 3px 0; font-size: 14px;">${client.adresse}, ${client.codePostal || ''} ${client.ville || ''}</p>` : ''}
        </div>
      </div>
      <div style="background: #f7f4ef; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 5px 0;">Facturé à : ${params.clientName}</h3>
        ${params.clientAddress ? `<p style="margin: 3px 0; font-size: 14px;">${params.clientAddress}</p>` : ''}
        ${params.clientEmail ? `<p style="margin: 3px 0; font-size: 14px;">${params.clientEmail}</p>` : ''}
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <thead><tr style="background: #1a1a14; color: #fff;">
          <th style="padding: 10px; text-align: left;">Désignation</th>
          <th style="padding: 10px; text-align: center; width: 80px;">Qté</th>
          <th style="padding: 10px; text-align: center; width: 80px;">Unité</th>
          <th style="padding: 10px; text-align: right; width: 100px;">PU HT</th>
          <th style="padding: 10px; text-align: right; width: 100px;">Total HT</th>
        </tr></thead>
        <tbody>${lines.map((l: any, i: number) => `
          <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9f9f9'}; border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${l.label}</td>
            <td style="padding: 10px; text-align: center;">${l.quantity}</td>
            <td style="padding: 10px; text-align: center;">${l.unit}</td>
            <td style="padding: 10px; text-align: right;">${l.unitPrice.toFixed(2)} €</td>
            <td style="padding: 10px; text-align: right;">${l.total.toFixed(2)} €</td>
          </tr>`).join('')}</tbody>
      </table>
      <div style="display: flex; justify-content: flex-end;">
        <table style="width: 250px;">
          <tr><td style="padding: 5px;">Total HT</td><td style="padding: 5px; text-align: right; font-weight: bold;">${totalHT.toFixed(2)} €</td></tr>
          <tr><td style="padding: 5px;">TVA (20%)</td><td style="padding: 5px; text-align: right;">${tva.toFixed(2)} €</td></tr>
          <tr style="border-top: 2px solid #ff5c00;"><td style="padding: 8px 5px; font-weight: bold; font-size: 18px;">Total TTC</td><td style="padding: 8px 5px; text-align: right; font-weight: bold; font-size: 18px; color: #ff5c00;">${totalTTC.toFixed(2)} €</td></tr>
        </table>
      </div>
      <div style="margin-top: 25px; padding: 15px; background: #f7f4ef; border-radius: 8px; font-size: 13px;">
        <strong>Paiement :</strong> ${params.paymentMethod || 'Virement bancaire'}<br/>
        <strong>Échéance :</strong> ${dueDate}<br/>
        En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40€ pour frais de recouvrement.
      </div>
      <div style="margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px;">
        Facture générée par iArtisan pour ${client.company}.
      </div>
    </div>`;

    // Store invoice in DB
    // Store invoice in DB (ignore errors if table schema differs)
    try {
      await supabase.from('invoices').insert({
        id: `inv-${Date.now()}`,
        number: invoiceNumber,
        amount: Math.round(totalTTC * 100),
        status: 'PENDING',
        clientId: context.clientId,
      });
    } catch (_) { /* table may not exist yet */ }

    // Send by email
    if (params.clientEmail) {
      const gmailConnected = await isGmailConnected(context.clientId);
      if (gmailConnected) {
        try {
          await sendEmail(context.clientId, {
            to: params.clientEmail,
            subject: `Facture ${invoiceNumber} — ${client.company}`,
            body: invoiceHtml,
          });
          return { invoiceNumber, sent: true, totalHT, totalTTC };
        } catch (err: any) {
          return { invoiceNumber, sent: false, error: err.message, totalHT, totalTTC };
        }
      }
    }

    return { invoiceNumber, sent: false, totalHT, totalTTC, html: invoiceHtml };
  },
};

// ── Follow-up Tool ────────────────────────────

const followUpClient: Tool = {
  name: 'follow_up_client',
  description: 'Envoie une relance automatique à un client (devis en attente, RDV, satisfaction)',
  parameters: {
    type: 'object',
    properties: {
      clientEmail: { type: 'string' },
      clientName: { type: 'string' },
      reason: { type: 'string', description: 'Raison: devis_pending, rdv_reminder, satisfaction, payment_reminder' },
      subject: { type: 'string', description: 'Objet de l\'email de relance' },
      body: { type: 'string', description: 'Corps du message de relance généré par l\'IA' },
      context: { type: 'string', description: 'Contexte additionnel' },
    },
    required: ['clientEmail', 'reason', 'subject', 'body'],
  },
  execute: async (params, context) => {
    const connected = await isGmailConnected(context.clientId);
    if (!connected) return { error: 'Gmail non connecté', followUp: { subject: params.subject, body: params.body } };

    try {
      const result = await sendEmail(context.clientId, {
        to: params.clientEmail,
        subject: params.subject,
        body: params.body,
      });

      await supabase.from('agent_logs').insert({
        client_id: context.clientId,
        agent_type: 'ADMIN',
        action: `followup.${params.reason}`,
        tokens_used: 0,
        model_used: 'template',
        duration_ms: 0,
        cost_cents: 0,
        metadata: { clientEmail: params.clientEmail, reason: params.reason },
      });

      return { sent: true, messageId: result.id, reason: params.reason, to: params.clientEmail };
    } catch (err: any) {
      return { error: `Erreur envoi: ${err.message}` };
    }
  },
};

// ── Weekly Report Tool ─────────────────────
const weeklyReport: Tool = {
  name: 'generate_weekly_report',
  description: 'Génère un rapport hebdomadaire d\'activité pour l\'artisan',
  parameters: {
    type: 'object',
    properties: {
      weekStart: { type: 'string', description: 'Date de début de semaine (YYYY-MM-DD)' },
    },
  },
  execute: async (params, context) => {
    const now = new Date();
    const weekStart = params.weekStart
      ? new Date(params.weekStart)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch data for the week
    const [tasksRes, logsRes] = await Promise.all([
      supabase
        .from('agent_tasks')
        .select('id, agent_type, task_type, status, created_at, completed_at')
        .eq('client_id', context.clientId)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString()),
      supabase
        .from('agent_logs')
        .select('action, tokens_used, cost_cents, duration_ms')
        .eq('client_id', context.clientId)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString()),
    ]);

    const tasks = tasksRes.data || [];
    const logs = logsRes.data || [];

    const completed = tasks.filter((t: any) => t.status === 'COMPLETED').length;
    const failed = tasks.filter((t: any) => t.status === 'FAILED').length;
    const totalTokens = logs.reduce((s: number, l: any) => s + (l.tokens_used || 0), 0);
    const totalCost = logs.reduce((s: number, l: any) => s + (l.cost_cents || 0), 0);

    // Group tasks by type
    const byType: Record<string, number> = {};
    tasks.forEach((t: any) => { byType[t.task_type] = (byType[t.task_type] || 0) + 1; });

    const taskRows = Object.entries(byType)
      .map(([type, count]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e0d8">${type.replace(/\\./g, ' → ')}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e0d8;text-align:center;font-weight:700">${count}</td></tr>`)
      .join('');

    const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#1a1a14;margin-bottom:4px">📊 Rapport hebdomadaire</h2>
        <p style="color:#7a7a6a;font-size:13px;margin-top:0">${fmtDate(weekStart)} — ${fmtDate(weekEnd)}</p>
        <div style="display:flex;gap:12px;margin:16px 0">
          <div style="flex:1;background:#fff;border:1px solid #e5e0d8;border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800">${tasks.length}</div>
            <div style="font-size:11px;color:#7a7a6a">Tâches total</div>
          </div>
          <div style="flex:1;background:#fff;border:1px solid #e5e0d8;border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#2d6a4f">${completed}</div>
            <div style="font-size:11px;color:#7a7a6a">Terminées</div>
          </div>
          <div style="flex:1;background:#fff;border:1px solid #e5e0d8;border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#dc2626">${failed}</div>
            <div style="font-size:11px;color:#7a7a6a">Échouées</div>
          </div>
        </div>
        ${taskRows ? `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e0d8;border-radius:10px;overflow:hidden;margin:16px 0">
          <tr style="background:#f7f4ef"><th style="padding:8px 12px;text-align:left;font-size:12px">Type de tâche</th><th style="padding:8px 12px;text-align:center;font-size:12px">Nombre</th></tr>
          ${taskRows}
        </table>` : '<p style="color:#7a7a6a;font-size:13px">Aucune tâche cette semaine.</p>'}
        <div style="background:#f7f4ef;border-radius:10px;padding:12px 16px;margin-top:16px;font-size:12px;color:#7a7a6a">
          Tokens utilisés: <strong>${totalTokens.toLocaleString('fr-FR')}</strong> · Coût estimé: <strong>${(totalCost / 100).toFixed(2)} €</strong>
        </div>
      </div>`;

    // Send via email if Gmail connected
    const connected = await isGmailConnected(context.clientId);
    if (connected) {
      try {
        await sendEmail(context.clientId, {
          to: 'me',
          subject: `Rapport iArtisan - Semaine du ${fmtDate(weekStart)}`,
          body: html,
        });
      } catch { /* email optional */ }
    }

    return {
      success: true,
      period: { start: weekStart.toISOString(), end: weekEnd.toISOString() },
      summary: { total: tasks.length, completed, failed, tokens: totalTokens, costCents: totalCost },
      byType,
      html,
    };
  },
};

// Register all admin tools
registerTool('email.read', emailRead);
registerTool('email.summarize', emailRead);
registerTool('email.reply', emailReply);
registerTool('quote.generate', generateQuote);
registerTool('invoice.generate', generateInvoice);
registerTool('invoice.followup', followUpClient);
registerTool('client.followup', followUpClient);
registerTool('report.weekly', weeklyReport);

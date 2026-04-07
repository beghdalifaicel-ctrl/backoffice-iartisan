import { registerTool } from './registry';
import { Tool, AgentContext } from '../types';
import { listEmails, sendEmail, isGmailConnected } from '../../integrations/gmail';

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
          body: e.body.substring(0, 2000), // Limit body size for LLM context
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

// ── Quote/Invoice Tools ────────────────────

const generateQuote: Tool = {
  name: 'generate_quote',
  description: 'Génère un devis professionnel pour l\'artisan',
  parameters: {
    type: 'object',
    properties: {
      clientName: { type: 'string', description: 'Nom du client' },
      clientEmail: { type: 'string', description: 'Email du client' },
      clientPhone: { type: 'string', description: 'Téléphone du client' },
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
    },
    required: ['clientName', 'description', 'items'],
  },
  execute: async (params, context) => {
    // TODO: Generate PDF quote using template
    return { quoteId: null, message: 'Quote generation pending implementation' };
  },
};

const generateInvoice: Tool = {
  name: 'generate_invoice',
  description: 'Génère une facture à partir d\'un devis validé',
  parameters: {
    type: 'object',
    properties: {
      quoteId: { type: 'string', description: 'ID du devis source (optionnel)' },
      clientName: { type: 'string' },
      items: { type: 'array', items: { type: 'object' } },
      dueDate: { type: 'string', description: 'Date d\'échéance (YYYY-MM-DD)' },
    },
    required: ['clientName', 'items'],
  },
  execute: async (params, context) => {
    // TODO: Generate PDF invoice
    return { invoiceId: null, message: 'Invoice generation pending implementation' };
  },
};

const followUpClient: Tool = {
  name: 'follow_up_client',
  description: 'Envoie une relance automatique à un client (devis en attente, RDV, etc.)',
  parameters: {
    type: 'object',
    properties: {
      clientEmail: { type: 'string' },
      reason: { type: 'string', description: 'Raison de la relance (devis_pending, rdv_reminder, satisfaction)' },
      context: { type: 'string', description: 'Contexte additionnel pour personnaliser le message' },
    },
    required: ['clientEmail', 'reason'],
  },
  execute: async (params, context) => {
    const connected = await isGmailConnected(context.clientId);
    if (!connected) return { error: 'Gmail non connecté' };

    // The LLM will generate the follow-up content, then call send_email
    return { ready: true, message: 'Use send_email tool with the generated follow-up content' };
  },
};

// Register all admin tools
registerTool('email.read', emailRead);
registerTool('email.summarize', emailRead); // Reuse read, LLM does the summarization
registerTool('email.reply', emailReply);
registerTool('quote.generate', generateQuote);
registerTool('invoice.generate', generateInvoice);
registerTool('invoice.followup', followUpClient);
registerTool('client.followup', followUpClient);

import { registerTool } from './registry';
import { Tool, AgentContext } from '../types';

const scrapeLeads: Tool = {
  name: 'scrape_directory_leads',
  description: 'Scrape des annuaires pour trouver des prospects potentiels',
  parameters: {
    type: 'object',
    properties: {
      directories: {
        type: 'array',
        items: { type: 'string', enum: ['pagesjaunes', 'houzz', 'habitatpresto', 'quotatis'] },
        description: 'Annuaires à scraper',
      },
      zone: { type: 'string', description: 'Zone géographique (ville ou département)' },
      metier: { type: 'string', description: 'Métier recherché' },
      maxResults: { type: 'number', default: 50 },
    },
    required: ['zone', 'metier'],
  },
  execute: async (params, context) => {
    // TODO: Implement scraping with Playwright
    return { leads: [], message: 'Lead scraping pending implementation' };
  },
};

const qualifyLead: Tool = {
  name: 'qualify_lead',
  description: 'Qualifie un lead en analysant ses informations',
  parameters: {
    type: 'object',
    properties: {
      leadName: { type: 'string' },
      leadEmail: { type: 'string' },
      leadPhone: { type: 'string' },
      message: { type: 'string', description: 'Message/demande du lead' },
      source: { type: 'string' },
    },
    required: ['leadName', 'message'],
  },
  execute: async (params, context) => {
    // LLM handles qualification via the system prompt
    return { qualified: true, score: 0, message: 'Qualification done by LLM' };
  },
};

const prospectEmail: Tool = {
  name: 'send_prospect_email',
  description: 'Envoie un email de prospection personnalisé',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string' },
      prospectName: { type: 'string' },
      prospectCompany: { type: 'string' },
      angle: { type: 'string', description: 'Angle d\'approche (ex: nouveau chantier, avis en ligne, etc.)' },
    },
    required: ['to', 'prospectName'],
  },
  execute: async (params, context) => {
    return { sent: false, message: 'Prospect email pending implementation' };
  },
};

const collectInvoice: Tool = {
  name: 'collect_unpaid_invoice',
  description: 'Envoie une relance pour facture impayée',
  parameters: {
    type: 'object',
    properties: {
      invoiceId: { type: 'string' },
      clientEmail: { type: 'string' },
      amount: { type: 'number', description: 'Montant en euros' },
      dueDate: { type: 'string' },
      relanceLevel: { type: 'number', description: '1=amicale, 2=ferme, 3=mise en demeure', default: 1 },
    },
    required: ['clientEmail', 'amount'],
  },
  execute: async (params, context) => {
    return { sent: false, message: 'Invoice collection pending implementation' };
  },
};

const enrollDirectory: Tool = {
  name: 'enroll_in_directory',
  description: 'Inscrit l\'artisan sur un annuaire/plateforme en ligne',
  parameters: {
    type: 'object',
    properties: {
      directory: { type: 'string', description: 'Nom de l\'annuaire' },
      artisanData: { type: 'object', description: 'Données de l\'artisan à inscrire' },
    },
    required: ['directory', 'artisanData'],
  },
  execute: async (params, context) => {
    return { enrolled: false, message: 'Directory enrollment pending implementation' };
  },
};

// Register commercial tools
registerTool('lead.scrape', scrapeLeads);
registerTool('lead.qualify', qualifyLead);
registerTool('lead.respond', qualifyLead); // Reuse qualify + LLM generates response
registerTool('prospect.email', prospectEmail);
registerTool('invoice.collect', collectInvoice);
registerTool('directory.enroll', enrollDirectory);

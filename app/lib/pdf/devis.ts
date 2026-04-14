/**
 * PDF Devis Generation Module
 *
 * Generates professional PDF quotes using pdf-lib (pure JS, Vercel-compatible)
 * All text in French, professional BTP formatting
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ─── TYPES ──────────────────────────────────────────────────────────────

export interface DevisItem {
  description: string;
  quantity: number;
  unitPriceHT: number;
  unite?: string; // "u", "m²", "ml", "h", etc.
}

export interface DevisData {
  // Company info (artisan)
  company: string;
  metier: string;
  siret?: string;
  address?: string;
  phone?: string;
  email?: string;

  // Devis header
  devisNumber: string;
  date: Date;
  validityDays?: number;

  // Client info
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;

  // Items
  items: DevisItem[];

  // Totals
  tvaRate?: number; // Default 10% (BTP rénovation), alternative 20%
  conditions?: string; // Payment conditions
  notes?: string; // Internal notes (not shown on PDF)
}

interface PDFState {
  y: number;
  page: any;
  document: any; font: any; boldFont: any;
}

// ─── UTILITIES ──────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  const euros = cents / 100;
  return euros.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function addLine(state: PDFState, y?: number) {
  if (y !== undefined) state.y = y;
  state.page.drawLine({
    start: { x: 50, y: state.y },
    end: { x: 550, y: state.y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  state.y -= 12;
}

function addText(
  state: PDFState,
  text: string,
  options: {
    x?: number;
    fontSize?: number;
    bold?: boolean;
    gray?: boolean;
    spacing?: number;
  } = {}
) {
  const {
    x = 50,
    fontSize = 10,
    bold = false,
    gray = false,
    spacing = 14,
  } = options;

  const font = bold ? state.boldFont : state.font;
  state.page.drawText(text, {
    x,
    y: state.y,
    size: fontSize,
    font,
    color: gray ? rgb(0.4, 0.4, 0.4) : rgb(0, 0, 0),
    maxWidth: 500,
    lineHeight: spacing,
    wordBreaks: [' '],
  });

  // Estimate height
  const lines = Math.ceil(text.length / 80);
  state.y -= spacing * lines;
}

function newPage(document: any, font?: any, boldFont?: any) {
  const page = document.addPage([595, 842]); // A4
  return { page, y: 800, document, font, boldFont };
}

// ─── MAIN FUNCTION ──────────────────────────────────────────────────────

export async function generateDevisPDF(data: DevisData): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const helvetica = await document.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await document.embedFont(StandardFonts.HelveticaBold);


  const tvaRate = data.tvaRate || 10;
  const validityDays = data.validityDays || 30;
  const validUntil = new Date(data.date);
  validUntil.setDate(validUntil.getDate() + validityDays);

  // Calculate totals
  let totalHT = 0;
  for (const item of data.items) {
    totalHT += item.quantity * item.unitPriceHT;
  }
  const totalTVA = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + totalTVA;

  // ─── PAGE 1 ───────────────────────────────────────────────────────

  let state = newPage(document, helvetica, helveticaBold);
  state = { ...state, y: 750 };

  // Header: Company name
  state.page.drawText(data.company, {
    x: 50,
    y: state.y,
    size: 24,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  state.y -= 30;

  // Company details
  const companyDetails = [
    data.metier ? `${data.metier.charAt(0).toUpperCase() + data.metier.slice(1)}` : '',
    data.siret ? `SIRET: ${data.siret}` : '',
    data.address || '',
    data.phone ? `Tél: ${data.phone}` : '',
    data.email ? `Email: ${data.email}` : '',
  ]
    .filter(Boolean)
    .join(' • ');

  state.page.drawText(companyDetails, {
    x: 50,
    y: state.y,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  state.y -= 20;

  // Devis title
  state.page.drawText('DEVIS', {
    x: 50,
    y: state.y,
    size: 32,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  state.y -= 35;

  // Devis number, date, validity
  state.page.drawText(`N° ${data.devisNumber}`, {
    x: 50,
    y: state.y,
    size: 14,
    font: helveticaBold,
    color: rgb(0.2, 0.4, 0.6),
  });
  state.y -= 18;

  const dateStr = data.date.toLocaleDateString('fr-FR');
  const validStr = validUntil.toLocaleDateString('fr-FR');
  state.page.drawText(`Date: ${dateStr} | Validité jusqu'au: ${validStr}`, {
    x: 50,
    y: state.y,
    size: 10,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  state.y -= 25;

  addLine(state);
  state.y -= 10;

  // Client section
  state.page.drawText('CLIENT', {
    x: 50,
    y: state.y,
    size: 11,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  state.y -= 15;

  state.page.drawText(data.clientName, {
    x: 50,
    y: state.y,
    size: 10,
    font: helvetica,
  });
  state.y -= 14;

  if (data.clientAddress) {
    state.page.drawText(data.clientAddress, {
      x: 50,
      y: state.y,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    state.y -= 14;
  }

  if (data.clientEmail) {
    state.page.drawText(data.clientEmail, {
      x: 50,
      y: state.y,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    state.y -= 18;
  }

  addLine(state);
  state.y -= 10;

  // Items table header
  const colX = [50, 250, 380, 480];
  const headerY = state.y;

  state.page.drawText('Description', {
    x: colX[0],
    y: headerY,
    size: 10,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  state.page.drawText('Qté', {
    x: colX[1],
    y: headerY,
    size: 10,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  state.page.drawText('P.U. HT', {
    x: colX[2],
    y: headerY,
    size: 10,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  state.page.drawText('Total HT', {
    x: colX[3],
    y: headerY,
    size: 10,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  state.y -= 14;
  addLine(state);
  state.y -= 8;

  // Items rows
  for (const item of data.items) {
    const itemTotal = item.quantity * item.unitPriceHT;
    const itemTotalStr = formatCurrency(itemTotal);
    const priceStr = formatCurrency(item.unitPriceHT);

    // Description + unite
    const descWithUnit = `${item.description}${item.unite ? ` (${item.unite})` : ''}`;
    state.page.drawText(descWithUnit, {
      x: colX[0],
      y: state.y,
      size: 9,
      font: helvetica,
      maxWidth: 180,
    });

    // Quantity
    state.page.drawText(item.quantity.toString(), {
      x: colX[1],
      y: state.y,
      size: 9,
      font: helvetica,
      maxWidth: 100,
    });

    // Unit price
    state.page.drawText(priceStr, {
      x: colX[2],
      y: state.y,
      size: 9,
      font: helvetica,
      maxWidth: 80,
    });

    // Total
    state.page.drawText(itemTotalStr, {
      x: colX[3],
      y: state.y,
      size: 9,
      font: helveticaBold,
      maxWidth: 70,
    });

    state.y -= 14;
  }

  state.y -= 8;
  addLine(state);
  state.y -= 15;

  // Totals section
  const rightCol = 480;
  const labelCol = 380;

  // Total HT
  state.page.drawText('TOTAL HT', {
    x: labelCol,
    y: state.y,
    size: 10,
    font: helveticaBold,
  });
  state.page.drawText(formatCurrency(totalHT), {
    x: rightCol,
    y: state.y,
    size: 10,
    font: helveticaBold,
  });
  state.y -= 16;

  // TVA
  state.page.drawText(`TVA (${tvaRate}%)`, {
    x: labelCol,
    y: state.y,
    size: 10,
    font: helvetica,
  });
  state.page.drawText(formatCurrency(totalTVA), {
    x: rightCol,
    y: state.y,
    size: 10,
    font: helvetica,
  });
  state.y -= 18;

  // Total TTC
  state.page.drawRectangle({
    x: labelCol - 10,
    y: state.y - 10,
    width: 190,
    height: 22,
    color: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  });

  state.page.drawText('TOTAL TTC', {
    x: labelCol,
    y: state.y,
    size: 11,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  state.page.drawText(formatCurrency(totalTTC), {
    x: rightCol,
    y: state.y,
    size: 11,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  state.y -= 30;

  // Payment conditions
  if (data.conditions) {
    addLine(state);
    state.y -= 10;

    state.page.drawText('Conditions de paiement', {
      x: 50,
      y: state.y,
      size: 10,
      font: helveticaBold,
    });
    state.y -= 14;

    state.page.drawText(data.conditions, {
      x: 50,
      y: state.y,
      size: 9,
      font: helvetica,
      maxWidth: 450,
      lineHeight: 12,
      wordBreaks: [' '],
    });
  }

  // Footer
  state.y = 40;
  addLine(state, 50);

  const footerText =
    'Ce devis est valable ' +
    validityDays +
    ' jours. Devis non accepté ou non signé passé ce délai sera annulé. ' +
    'Tout travail commencé avant signature du devis sera facturé. ' +
    'Garantie légale de conformité et de bon fonctionnement. ' +
    'RCS ' +
    (data.siret || '');

  state.page.drawText(footerText, {
    x: 50,
    y: state.y,
    size: 7,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
    maxWidth: 500,
    lineHeight: 10,
    wordBreaks: [' '],
  });

  // ─── SERIALIZE ──────────────────────────────────────────────────

  const pdfBytes = await document.save();
  return pdfBytes;
}

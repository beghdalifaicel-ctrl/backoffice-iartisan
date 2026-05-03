/**
 * Devis Excel (.xlsx) Generation
 *
 * Génère un fichier Excel modifiable du devis pour que l'artisan puisse :
 *  - Bricoler les prix dans son tableur préféré
 *  - Réutiliser les chiffres dans ses propres calculs
 *  - Importer dans son outil habituel
 *
 * Layout : 1 feuille "Devis" avec en-tête entreprise, infos client, items
 * détaillés, totaux et conditions. Pas de fioritures de mise en page —
 * structure tabulaire pure pour faciliter la copie/collage.
 */

import ExcelJS from 'exceljs';
import { DevisData } from './devis';

export async function generateDevisXLSX(data: DevisData): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'iArtisan — Marie';
  wb.created = new Date();

  const ws = wb.addWorksheet('Devis', {
    views: [{ state: 'normal', showGridLines: false }],
  });

  // Largeurs colonnes
  ws.columns = [
    { width: 45 }, // Description
    { width: 10 }, // Quantité
    { width: 8 }, // Unité
    { width: 14 }, // P.U. HT
    { width: 14 }, // Total HT
  ];

  // ─── En-tête entreprise ──────────────────────────────────────
  const companyRow = ws.addRow([data.company]);
  companyRow.font = { size: 18, bold: true };
  companyRow.height = 24;
  ws.mergeCells(`A${companyRow.number}:E${companyRow.number}`);

  const detailsParts = [
    data.metier ? `${data.metier.charAt(0).toUpperCase() + data.metier.slice(1)}` : '',
    data.siret ? `SIRET: ${data.siret}` : '',
    data.address || '',
    data.phone ? `Tél: ${data.phone}` : '',
    data.email ? `Email: ${data.email}` : '',
  ].filter(Boolean);
  if (detailsParts.length > 0) {
    const detailsRow = ws.addRow([detailsParts.join(' • ')]);
    detailsRow.font = { size: 10, color: { argb: 'FF666666' } };
    ws.mergeCells(`A${detailsRow.number}:E${detailsRow.number}`);
  }

  ws.addRow([]); // espace

  // ─── Titre devis ────────────────────────────────────────────
  const titleRow = ws.addRow(['DEVIS']);
  titleRow.font = { size: 22, bold: true };
  titleRow.height = 28;
  ws.mergeCells(`A${titleRow.number}:E${titleRow.number}`);

  const numRow = ws.addRow([`N° ${data.devisNumber}`]);
  numRow.font = { size: 13, bold: true, color: { argb: 'FF0F4C81' } };
  ws.mergeCells(`A${numRow.number}:E${numRow.number}`);

  const validityDays = data.validityDays || 30;
  const validUntil = new Date(data.date);
  validUntil.setDate(validUntil.getDate() + validityDays);
  const dateRow = ws.addRow([
    `Date: ${data.date.toLocaleDateString('fr-FR')} | Validité jusqu'au: ${validUntil.toLocaleDateString('fr-FR')}`,
  ]);
  dateRow.font = { size: 10, color: { argb: 'FF666666' } };
  ws.mergeCells(`A${dateRow.number}:E${dateRow.number}`);

  ws.addRow([]); // espace

  // ─── Client ─────────────────────────────────────────────────
  const clientLabel = ws.addRow(['CLIENT']);
  clientLabel.font = { size: 11, bold: true };
  ws.mergeCells(`A${clientLabel.number}:E${clientLabel.number}`);

  const clientName = ws.addRow([data.clientName]);
  clientName.font = { size: 11 };
  ws.mergeCells(`A${clientName.number}:E${clientName.number}`);

  if (data.clientAddress) {
    const r = ws.addRow([data.clientAddress]);
    r.font = { size: 10, color: { argb: 'FF666666' } };
    ws.mergeCells(`A${r.number}:E${r.number}`);
  }
  if (data.clientEmail) {
    const r = ws.addRow([data.clientEmail]);
    r.font = { size: 10, color: { argb: 'FF666666' } };
    ws.mergeCells(`A${r.number}:E${r.number}`);
  }

  ws.addRow([]); // espace

  // ─── En-tête tableau ────────────────────────────────────────
  const headerRow = ws.addRow(['Description', 'Quantité', 'Unité', 'P.U. HT (€)', 'Total HT (€)']);
  headerRow.font = { size: 11, bold: true };
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: 'medium' } };
  });

  // ─── Items ──────────────────────────────────────────────────
  let totalHT = 0;
  for (const item of data.items) {
    const lineTotal = item.quantity * item.unitPriceHT;
    totalHT += lineTotal;

    const row = ws.addRow([
      item.description,
      item.quantity,
      item.unite || 'u',
      item.unitPriceHT,
      lineTotal,
    ]);
    // Format alignement et nombres
    row.getCell(2).alignment = { horizontal: 'right' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(5).font = { bold: true };
    // Wrap descriptions longues
    row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  }

  ws.addRow([]); // espace

  // ─── Totaux (avec formules pour bricolage) ──────────────────
  const tvaRate = data.tvaRate || 10;
  const totalTVA = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + totalTVA;

  const totalHTRow = ws.addRow(['', '', '', 'TOTAL HT', totalHT]);
  totalHTRow.getCell(4).font = { bold: true };
  totalHTRow.getCell(5).font = { bold: true };
  totalHTRow.getCell(5).numFmt = '#,##0.00 €';
  totalHTRow.getCell(5).alignment = { horizontal: 'right' };

  const tvaRow = ws.addRow(['', '', '', `TVA (${tvaRate}%)`, totalTVA]);
  tvaRow.getCell(5).numFmt = '#,##0.00 €';
  tvaRow.getCell(5).alignment = { horizontal: 'right' };

  const totalTTCRow = ws.addRow(['', '', '', 'TOTAL TTC', totalTTC]);
  totalTTCRow.getCell(4).font = { bold: true, size: 12 };
  totalTTCRow.getCell(5).font = { bold: true, size: 12 };
  totalTTCRow.getCell(5).numFmt = '#,##0.00 €';
  totalTTCRow.getCell(5).alignment = { horizontal: 'right' };
  totalTTCRow.eachCell((cell, colNumber) => {
    cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
    if (colNumber >= 4) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  });

  ws.addRow([]); // espace
  ws.addRow([]); // espace

  // ─── Conditions de paiement ─────────────────────────────────
  if (data.conditions) {
    const condLabel = ws.addRow(['Conditions de paiement']);
    condLabel.font = { size: 11, bold: true };
    ws.mergeCells(`A${condLabel.number}:E${condLabel.number}`);

    const cond = ws.addRow([data.conditions]);
    cond.font = { size: 10 };
    cond.alignment = { wrapText: true, vertical: 'top' };
    ws.mergeCells(`A${cond.number}:E${cond.number}`);
    cond.height = 30;
  }

  ws.addRow([]); // espace

  // ─── Footer ─────────────────────────────────────────────────
  const footer = ws.addRow([
    `Ce devis est valable ${validityDays} jours. Devis non accepté ou non signé passé ce délai sera annulé. ` +
      'Tout travail commencé avant signature du devis sera facturé. ' +
      'Garantie légale de conformité et de bon fonctionnement.',
  ]);
  footer.font = { size: 9, color: { argb: 'FF888888' }, italic: true };
  footer.alignment = { wrapText: true, vertical: 'top' };
  ws.mergeCells(`A${footer.number}:E${footer.number}`);
  footer.height = 40;

  // Buffer Uint8Array
  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

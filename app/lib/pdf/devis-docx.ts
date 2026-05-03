/**
 * Devis Word (.docx) Generation
 *
 * Génère un fichier Word modifiable du devis pour que l'artisan puisse :
 *  - Personnaliser la mise en page (logo, couleurs, polices)
 *  - Modifier le texte conditionnel
 *  - Finaliser dans son template habituel
 *
 * Layout : entête entreprise, titre devis, infos client, tableau items,
 * totaux, conditions de paiement et footer légal.
 */

import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
} from 'docx';
import { DevisData, DevisItem } from './devis';

function fmtMoney(n: number): string {
  return n
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/ /g, ' ')
    .replace(/ /g, ' ');
}

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; spacingAfter?: number } = {}) {
  return new Paragraph({
    spacing: { after: opts.spacingAfter ?? 80 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size ? opts.size * 2 : undefined, // docx uses half-points
        color: opts.color,
      }),
    ],
  });
}

function cell(text: string, opts: { bold?: boolean; align?: AlignmentType; width?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, bold: opts.bold })],
      }),
    ],
  });
}

function buildItemsTable(items: DevisItem[]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell('Description', { bold: true, width: 50 }),
      cell('Qté', { bold: true, align: AlignmentType.CENTER, width: 10 }),
      cell('Unité', { bold: true, align: AlignmentType.CENTER, width: 10 }),
      cell('P.U. HT (€)', { bold: true, align: AlignmentType.RIGHT, width: 15 }),
      cell('Total HT (€)', { bold: true, align: AlignmentType.RIGHT, width: 15 }),
    ],
  });

  const itemRows = items.map((item) => {
    const lineTotal = item.quantity * item.unitPriceHT;
    return new TableRow({
      children: [
        cell(item.description),
        cell(String(item.quantity), { align: AlignmentType.CENTER }),
        cell(item.unite || 'u', { align: AlignmentType.CENTER }),
        cell(fmtMoney(item.unitPriceHT), { align: AlignmentType.RIGHT }),
        cell(fmtMoney(lineTotal), { align: AlignmentType.RIGHT, bold: true }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...itemRows],
  });
}

function buildTotalsTable(totalHT: number, tvaRate: number, totalTVA: number, totalTTC: number) {
  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const totalsRow = (label: string, value: string, bold = false) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, borders: noBorder, children: [new Paragraph('')] }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: noBorder,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: label, bold })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: noBorder,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: value, bold })],
            }),
          ],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      totalsRow('TOTAL HT', fmtMoney(totalHT) + ' €', true),
      totalsRow(`TVA (${tvaRate}%)`, fmtMoney(totalTVA) + ' €'),
      totalsRow('TOTAL TTC', fmtMoney(totalTTC) + ' €', true),
    ],
  });
}

export async function generateDevisDOCX(data: DevisData): Promise<Uint8Array> {
  // Calculs totaux
  let totalHT = 0;
  for (const item of data.items) totalHT += item.quantity * item.unitPriceHT;
  const tvaRate = data.tvaRate || 10;
  const totalTVA = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + totalTVA;

  const validityDays = data.validityDays || 30;
  const validUntil = new Date(data.date);
  validUntil.setDate(validUntil.getDate() + validityDays);

  const detailsParts = [
    data.metier ? `${data.metier.charAt(0).toUpperCase() + data.metier.slice(1)}` : '',
    data.siret ? `SIRET: ${data.siret}` : '',
    data.address || '',
    data.phone ? `Tél: ${data.phone}` : '',
    data.email ? `Email: ${data.email}` : '',
  ].filter(Boolean);

  const children: Array<Paragraph | Table> = [
    // Entête entreprise
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: data.company, bold: true, size: 36 })],
    }),
  ];

  if (detailsParts.length > 0) {
    children.push(p(detailsParts.join(' • '), { size: 9, color: '666666' }));
  }

  children.push(p(''));

  // Titre DEVIS
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'DEVIS', bold: true, size: 44 })],
    }),
    p(`N° ${data.devisNumber}`, { bold: true, size: 13, color: '0F4C81' }),
    p(
      `Date: ${data.date.toLocaleDateString('fr-FR')} | Validité jusqu'au: ${validUntil.toLocaleDateString('fr-FR')}`,
      { size: 9, color: '666666' }
    ),
    p('')
  );

  // Client
  children.push(
    p('CLIENT', { bold: true, size: 11 }),
    p(data.clientName, { size: 11 })
  );
  if (data.clientAddress) children.push(p(data.clientAddress, { size: 9, color: '666666' }));
  if (data.clientEmail) children.push(p(data.clientEmail, { size: 9, color: '666666' }));
  children.push(p(''));

  // Tableau items
  children.push(buildItemsTable(data.items));
  children.push(p(''));

  // Tableau totaux
  children.push(buildTotalsTable(totalHT, tvaRate, totalTVA, totalTTC));
  children.push(p(''));

  // Conditions
  if (data.conditions) {
    children.push(p('Conditions de paiement', { bold: true, size: 11 }), p(data.conditions, { size: 10 }), p(''));
  }

  // Footer légal
  children.push(
    p(
      `Ce devis est valable ${validityDays} jours. Devis non accepté ou non signé passé ce délai sera annulé. ` +
        'Tout travail commencé avant signature du devis sera facturé. ' +
        'Garantie légale de conformité et de bon fonctionnement.',
      { size: 8, color: '888888' }
    )
  );

  const doc = new Document({
    creator: 'iArtisan — Marie',
    title: `Devis ${data.devisNumber}`,
    description: `Devis pour ${data.clientName}`,
    sections: [
      {
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

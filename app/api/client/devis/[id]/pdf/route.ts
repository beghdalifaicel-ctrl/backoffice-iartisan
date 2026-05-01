export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

function fmtMoney(n: number) { return n.toFixed(2).replace(".", ",") + " €"; }
function fmtDate(d: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d)); }

const STATUS_MAP: Record<string, string> = {
  BROUILLON: "Brouillon", ENVOYE: "Envoyé", ACCEPTE: "Accepté", REFUSE: "Refusé", EXPIRE: "Expiré",
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    const [devis, artisan] = await Promise.all([
      prisma.devis.findFirst({
        where: { id: params.id, clientId },
        include: {
          customer: true,
          lots: { include: { lignes: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } },
        },
      }),
      prisma.client.findUnique({ where: { id: clientId }, select: { company: true, firstName: true, lastName: true, adresse: true, codePostal: true, ville: true, siret: true, phone: true, email: true, metier: true } }),
    ]);

    if (!devis || !artisan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Build HTML for PDF
    const lotsHTML = devis.lots.map((lot: any) => {
      const lignesRows = lot.lignes.map((l: any) => {
        const totalLigne = l.quantite * l.prixUnitHT;
        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${l.designation}${l.description ? `<br><small style="color:#888">${l.description}</small>` : ""}</td>
          <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee">${l.quantite}</td>
          <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee">${l.unite}</td>
          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee">${fmtMoney(l.prixUnitHT)}</td>
          <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee">${l.tauxTVA}%</td>
          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;font-weight:600">${fmtMoney(totalLigne)}</td>
        </tr>`;
      }).join("");

      return `<tr><td colspan="6" style="background:#f5f5f0;padding:8px 10px;font-weight:700;font-size:13px;border-bottom:2px solid #ddd">${lot.titre}</td></tr>${lignesRows}`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Devis ${devis.number}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; font-size:12px; color:#1a1a14; padding:40px; max-width:800px; margin:0 auto; }
  .header { display:flex; justify-content:space-between; margin-bottom:32px; }
  .artisan { font-size:11px; line-height:1.7; }
  .artisan .company { font-size:16px; font-weight:700; color:#ff5c00; margin-bottom:4px; }
  .client-box { background:#f7f4ef; border-radius:8px; padding:16px; min-width:240px; }
  .client-box .label { font-size:10px; text-transform:uppercase; color:#888; font-weight:600; margin-bottom:6px; }
  .client-box .name { font-size:14px; font-weight:700; margin-bottom:4px; }
  .devis-info { display:flex; gap:24px; margin-bottom:24px; padding:12px 16px; background:#fff5ef; border-radius:8px; border:1px solid #ffe0cc; }
  .devis-info div { font-size:11px; }
  .devis-info .val { font-weight:700; font-size:13px; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; font-size:11px; }
  th { background:#1a1a14; color:#fff; padding:8px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; }
  th:nth-child(2), th:nth-child(3), th:nth-child(5) { text-align:center; }
  th:nth-child(4), th:nth-child(6) { text-align:right; }
  .totals { float:right; width:260px; font-size:12px; }
  .totals .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee; }
  .totals .total { font-size:16px; font-weight:700; color:#ff5c00; border-top:2px solid #1a1a14; padding-top:8px; border-bottom:none; }
  .footer { clear:both; margin-top:60px; padding-top:16px; border-top:1px solid #ddd; font-size:10px; color:#888; line-height:1.8; }
  .badge { display:inline-block; padding:3px 10px; border-radius:4px; font-size:10px; font-weight:700; }
</style></head><body>
  <div class="header">
    <div class="artisan">
      <div class="company">${artisan.company}</div>
      ${artisan.firstName} ${artisan.lastName}<br>
      ${artisan.adresse || ""}${artisan.codePostal ? `, ${artisan.codePostal}` : ""} ${artisan.ville || ""}<br>
      ${artisan.phone || ""} — ${artisan.email}<br>
      ${artisan.siret ? `SIRET : ${artisan.siret}` : ""}
    </div>
    <div class="client-box">
      <div class="label">Client</div>
      <div class="name">${devis.customer.name}</div>
      ${devis.customer.adresse || ""}${devis.customer.codePostal ? `, ${devis.customer.codePostal}` : ""} ${devis.customer.ville || ""}<br>
      ${devis.customer.email || ""} ${devis.customer.phone ? `— ${devis.customer.phone}` : ""}
      ${devis.customer.siret ? `<br>SIRET : ${devis.customer.siret}` : ""}
    </div>
  </div>

  <div class="devis-info">
    <div>Devis N°<br><span class="val">${devis.number}</span></div>
    <div>Date<br><span class="val">${fmtDate(devis.createdAt)}</span></div>
    <div>Valide jusqu'au<br><span class="val">${devis.validUntil ? fmtDate(devis.validUntil) : "—"}</span></div>
    <div>Statut<br><span class="val">${STATUS_MAP[devis.status] || devis.status}</span></div>
  </div>

  <h2 style="font-size:15px;margin-bottom:12px">${devis.objet}</h2>

  <table>
    <thead><tr>
      <th style="width:40%">Désignation</th><th>Qté</th><th>Unité</th><th>P.U. HT</th><th>TVA</th><th>Total HT</th>
    </tr></thead>
    <tbody>${lotsHTML}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Total HT</span><span>${fmtMoney(devis.totalHT)}</span></div>
    ${devis.remisePercent > 0 ? `<div class="row"><span>Remise (${devis.remisePercent}%)</span><span>-${fmtMoney(devis.totalHT * devis.remisePercent / (100 - devis.remisePercent))}</span></div>` : ""}
    <div class="row"><span>Total TVA</span><span>${fmtMoney(devis.totalTVA)}</span></div>
    <div class="row total"><span>Total TTC</span><span>${fmtMoney(devis.totalTTC)}</span></div>
  </div>

  <div class="footer">
    ${devis.conditions ? `<strong>Conditions :</strong> ${devis.conditions}<br>` : ""}
    <strong>Mentions légales :</strong> Devis valable ${devis.validUntil ? "jusqu'au " + fmtDate(devis.validUntil) : "30 jours"}.
    TVA non applicable si auto-entrepreneur (art. 293B du CGI). En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée,
    ainsi qu'une indemnité forfaitaire de 40€ pour frais de recouvrement.<br>
    <br>
    <div style="margin-top:24px">
      <div style="float:left;width:48%">
        <strong>Signature du client</strong><br>(précédée de la mention "Bon pour accord")<br><br><br><br>
      </div>
      <div style="float:right;width:48%;text-align:right">
        <strong>Date :</strong> ___ / ___ / ______
      </div>
    </div>
  </div>
</body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

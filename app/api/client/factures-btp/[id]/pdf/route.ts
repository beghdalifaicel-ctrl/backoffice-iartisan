export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

function fmtMoney(n: number) { return n.toFixed(2).replace(".", ",") + " €"; }
function fmtDate(d: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d)); }

const TYPE_MAP: Record<string, string> = { FACTURE: "Facture", ACOMPTE: "Acompte", SITUATION: "Situation", AVOIR: "Avoir" };
const STATUS_MAP: Record<string, string> = { EN_ATTENTE: "En attente", PAYEE: "Payée", EN_RETARD: "En retard", ANNULEE: "Annulée" };

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    const [facture, artisan] = await Promise.all([
      prisma.facture.findFirst({
        where: { id: params.id, clientId },
        include: { customer: true, lignes: { orderBy: { position: "asc" } }, devis: { select: { number: true } } },
      }),
      prisma.client.findUnique({ where: { id: clientId }, select: { company: true, firstName: true, lastName: true, adresse: true, codePostal: true, ville: true, siret: true, phone: true, email: true } }),
    ]);

    if (!facture || !artisan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Group lignes by lot
    const groups: Record<string, typeof facture.lignes> = {};
    for (const l of facture.lignes) {
      const key = l.lotTitre || "Prestations";
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    }

    const lotsHTML = Object.entries(groups).map(([titre, lignes]) => {
      const rows = lignes.map((l: any) => {
        const total = l.quantite * l.prixUnitHT;
        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${l.designation}${l.description ? `<br><small style="color:#888">${l.description}</small>` : ""}</td>
          <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee">${l.quantite}</td>
          <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee">${l.unite}</td>
          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee">${fmtMoney(l.prixUnitHT)}</td>
          <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee">${l.tauxTVA}%</td>
          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;font-weight:600">${fmtMoney(total)}</td>
        </tr>`;
      }).join("");
      return `<tr><td colspan="6" style="background:#f5f5f0;padding:8px 10px;font-weight:700;font-size:13px;border-bottom:2px solid #ddd">${titre}</td></tr>${rows}`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${TYPE_MAP[facture.type]} ${facture.number}</title>
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
  .info { display:flex; gap:24px; margin-bottom:24px; padding:12px 16px; background:#fff5ef; border-radius:8px; border:1px solid #ffe0cc; }
  .info div { font-size:11px; }
  .info .val { font-weight:700; font-size:13px; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; font-size:11px; }
  th { background:#1a1a14; color:#fff; padding:8px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; }
  th:nth-child(2), th:nth-child(3), th:nth-child(5) { text-align:center; }
  th:nth-child(4), th:nth-child(6) { text-align:right; }
  .totals { float:right; width:260px; font-size:12px; }
  .totals .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee; }
  .totals .total { font-size:16px; font-weight:700; color:#ff5c00; border-top:2px solid #1a1a14; padding-top:8px; border-bottom:none; }
  .footer { clear:both; margin-top:60px; padding-top:16px; border-top:1px solid #ddd; font-size:10px; color:#888; line-height:1.8; }
  .paid-badge { background:#2d6a4f; color:#fff; padding:4px 12px; border-radius:4px; font-size:11px; font-weight:700; display:inline-block; }
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
      <div class="name">${facture.customer.name}</div>
      ${facture.customer.adresse || ""}${facture.customer.codePostal ? `, ${facture.customer.codePostal}` : ""} ${facture.customer.ville || ""}<br>
      ${facture.customer.email || ""} ${facture.customer.phone ? `— ${facture.customer.phone}` : ""}
      ${facture.customer.siret ? `<br>SIRET : ${facture.customer.siret}` : ""}
    </div>
  </div>

  <div class="info">
    <div>${TYPE_MAP[facture.type]} N°<br><span class="val">${facture.number}</span></div>
    <div>Date<br><span class="val">${fmtDate(facture.createdAt)}</span></div>
    <div>Échéance<br><span class="val">${facture.echeance ? fmtDate(facture.echeance) : "—"}</span></div>
    <div>Statut<br><span class="val">${STATUS_MAP[facture.status] || facture.status}</span></div>
    ${facture.devis ? `<div>Devis réf.<br><span class="val">${facture.devis.number}</span></div>` : ""}
  </div>

  <h2 style="font-size:15px;margin-bottom:12px">${facture.objet}</h2>

  <table>
    <thead><tr>
      <th style="width:40%">Désignation</th><th>Qté</th><th>Unité</th><th>P.U. HT</th><th>TVA</th><th>Total HT</th>
    </tr></thead>
    <tbody>${lotsHTML}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Total HT</span><span>${fmtMoney(facture.totalHT)}</span></div>
    <div class="row"><span>Total TVA</span><span>${fmtMoney(facture.totalTVA)}</span></div>
    <div class="row total"><span>Total TTC</span><span>${fmtMoney(facture.totalTTC)}</span></div>
    ${facture.montantPaye > 0 ? `<div class="row"><span>Déjà payé</span><span>${fmtMoney(facture.montantPaye)}</span></div><div class="row" style="font-weight:700"><span>Reste à payer</span><span>${fmtMoney(facture.totalTTC - facture.montantPaye)}</span></div>` : ""}
  </div>

  <div class="footer">
    ${facture.conditions ? `<strong>Conditions :</strong> ${facture.conditions}<br>` : ""}
    <strong>Mentions légales :</strong> En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée,
    ainsi qu'une indemnité forfaitaire de 40€ pour frais de recouvrement (art. L.441-10 C. com.).
    TVA non applicable si auto-entrepreneur (art. 293B du CGI).
  </div>
</body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

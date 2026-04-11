import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { sendFactureEmail } from "@/lib/email";

// POST — convert devis to facture
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;
    const body = await req.json().catch(() => ({}));

    const devis = await prisma.devis.findFirst({
      where: { id: params.id, clientId },
      include: { lots: { include: { lignes: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } } },
    });
    if (!devis) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Generate facture number
    const year = new Date().getFullYear();
    const count = await prisma.facture.count({ where: { clientId, number: { startsWith: `FAC-${year}` } } });
    const number = `FAC-${year}-${String(count + 1).padStart(4, "0")}`;

    // Determine type (acompte = partial amount)
    const type = body.type || "FACTURE";
    const pourcentage = body.pourcentage || 100;

    const factor = pourcentage / 100;
    const totalHT = Math.round(devis.totalHT * factor * 100) / 100;
    const totalTVA = Math.round(devis.totalTVA * factor * 100) / 100;
    const totalTTC = Math.round(devis.totalTTC * factor * 100) / 100;

    // Flatten lots into facture lignes
    const lignes: any[] = [];
    let pos = 0;
    for (const lot of devis.lots) {
      for (const l of lot.lignes) {
        lignes.push({
          position: pos++,
          lotTitre: lot.titre,
          designation: l.designation,
          description: l.description,
          quantite: type === "ACOMPTE" ? l.quantite * factor : l.quantite,
          unite: l.unite,
          prixUnitHT: l.prixUnitHT,
          tauxTVA: l.tauxTVA,
        });
      }
    }

    const facture = await prisma.facture.create({
      data: {
        clientId,
        number,
        type: type as any,
        objet: type === "ACOMPTE" ? `Acompte ${pourcentage}% — ${devis.objet}` : devis.objet,
        customerId: devis.customerId,
        devisId: devis.id,
        echeance: new Date(Date.now() + 30 * 86400000),
        conditions: devis.conditions,
        remisePercent: devis.remisePercent,
        totalHT,
        totalTVA,
        totalTTC,
        lignes: { create: lignes },
      },
      include: { customer: true, lignes: true },
    });

    // Update devis status to ACCEPTE if not already
    if (devis.status === "BROUILLON" || devis.status === "ENVOYE") {
      await prisma.devis.update({ where: { id: devis.id }, data: { status: "ACCEPTE" } });
    }

    // Envoyer email facture au client final
    if (facture.customer?.email) {
      const artisan = await prisma.client.findUnique({ where: { id: clientId }, select: { company: true } });
      const fmtDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d));
      sendFactureEmail(facture.customer.email, {
        clientName: facture.customer.name,
        artisanCompany: artisan?.company || "Votre artisan",
        factureNumber: facture.number,
        totalTTC: facture.totalTTC.toFixed(2).replace(".", ","),
        echeance: facture.echeance ? fmtDate(facture.echeance) : undefined,
        pdfUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.iartisan.io"}/api/client/factures-btp/${facture.id}/pdf`,
      }).catch(err => console.error("Email facture error:", err));
    }

    return NextResponse.json(facture);
  } catch (e: any) {
    console.error("Convert error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

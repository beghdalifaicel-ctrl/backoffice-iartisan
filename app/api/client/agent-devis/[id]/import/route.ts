import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireClient();
    const body = await req.json().catch(() => ({}));
    const agentDevisId = params.id;

    // Récupérer le devis agent via raw SQL
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, client_id as "clientId", prospect_name as "prospectName",
              prospect_phone as "prospectPhone", prospect_email as "prospectEmail",
              prospect_adresse as "prospectAdresse", prospect_ville as "prospectVille",
              objet, lignes, total_ht_estime as "totalHtEstime",
              total_ttc_estime as "totalTtcEstime", ai_notes as "aiNotes", status
       FROM agent_devis WHERE id = $1`,
      agentDevisId
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Devis agent non trouvé" }, { status: 404 });
    }

    const ad = rows[0];

    if (ad.clientId !== session.clientId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (ad.status === "IMPORTE") {
      return NextResponse.json({ error: "Déjà importé" }, { status: 400 });
    }

    // Créer ou utiliser un CustomerContact existant
    let customerId = body.customerId;

    if (!customerId) {
      const newCustomer = await prisma.customerContact.create({
        data: {
          clientId: session.clientId!,
          name: ad.prospectName,
          email: ad.prospectEmail || undefined,
          phone: ad.prospectPhone || undefined,
          adresse: ad.prospectAdresse || undefined,
          ville: ad.prospectVille || undefined,
          type: "PARTICULIER",
        },
      });
      customerId = newCustomer.id;
    }

    // Générer numéro de devis
    const countResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as c FROM devis WHERE client_id = $1`,
      session.clientId
    );
    const count = (countResult[0]?.c || 0) + 1;
    const number = `DEV-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;

    // Parser les lignes
    const lignesData = Array.isArray(ad.lignes) ? ad.lignes : [];

    // Regrouper par lot
    const lotsMap: Record<string, any[]> = {};
    for (const l of lignesData) {
      const lotName = l.lot || "Lot 1";
      if (!lotsMap[lotName]) lotsMap[lotName] = [];
      lotsMap[lotName].push(l);
    }

    // Calculer totaux
    let totalHT = 0;
    let totalTVA = 0;
    for (const l of lignesData) {
      const lht = (l.quantite || 1) * (l.prixUnitHT || 0);
      totalHT += lht;
      totalTVA += lht * ((l.tauxTVA || 20) / 100);
    }
    const totalTTC = totalHT + totalTVA;

    // Créer le devis avec lots et lignes via Prisma (ces models existent déjà)
    const devis = await prisma.devis.create({
      data: {
        number,
        clientId: session.clientId!,
        customerId,
        objet: ad.objet,
        status: "BROUILLON",
        totalHT: Math.round(totalHT * 100) / 100,
        totalTVA: Math.round(totalTVA * 100) / 100,
        totalTTC: Math.round(totalTTC * 100) / 100,
        notes: ad.aiNotes || undefined,
        lots: {
          create: Object.entries(lotsMap).map(([titre, lignes], lotIdx) => ({
            titre,
            position: lotIdx,
            lignes: {
              create: (lignes as any[]).map((l: any, lIdx: number) => ({
                position: lIdx,
                designation: l.designation || "",
                description: l.description || undefined,
                quantite: l.quantite || 1,
                unite: l.unite || "u",
                prixUnitHT: l.prixUnitHT || 0,
                tauxTVA: l.tauxTVA || 20,
              })),
            },
          })),
        },
      },
    });

    // Mettre à jour le statut de l'agent devis
    await prisma.$executeRawUnsafe(
      `UPDATE agent_devis SET status = 'IMPORTE'::agent_devis_status, imported_devis_id = $1, updated_at = now() WHERE id = $2`,
      devis.id,
      agentDevisId
    );

    return NextResponse.json({
      success: true,
      devisId: devis.id,
      devisNumber: number,
    });
  } catch (e: any) {
    console.error("Erreur import agent-devis:", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}

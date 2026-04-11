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

    // Créer ou utiliser un CustomerContact existant — raw SQL
    let customerId = body.customerId;

    if (!customerId) {
      const custRows: any[] = await prisma.$queryRawUnsafe(
        `INSERT INTO customer_contacts (id, created_at, updated_at, type, name, email, phone, adresse, ville, client_id)
         VALUES (gen_random_uuid()::text, now(), now(), 'PARTICULIER', $1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ad.prospectName,
        ad.prospectEmail || null,
        ad.prospectPhone || null,
        ad.prospectAdresse || null,
        ad.prospectVille || null,
        session.clientId
      );
      customerId = custRows[0].id;
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

    // Calculer totaux
    let totalHT = 0;
    let totalTVA = 0;
    for (const l of lignesData) {
      const lht = (l.quantite || 1) * (l.prixUnitHT || 0);
      totalHT += lht;
      totalTVA += lht * ((l.tauxTVA || 20) / 100);
    }
    const totalTTC = totalHT + totalTVA;

    // Créer le devis — raw SQL
    const devisRows: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO devis (id, created_at, updated_at, number, objet, status, remise_percent, total_ht, total_tva, total_ttc, notes, customer_id, client_id)
       VALUES (gen_random_uuid()::text, now(), now(), $1, $2, 'BROUILLON', 0, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      number,
      ad.objet,
      Math.round(totalHT * 100) / 100,
      Math.round(totalTVA * 100) / 100,
      Math.round(totalTTC * 100) / 100,
      ad.aiNotes || null,
      customerId,
      session.clientId
    );
    const devisId = devisRows[0].id;

    // Regrouper lignes par lot
    const lotsMap: Record<string, any[]> = {};
    for (const l of lignesData) {
      const lotName = l.lot || "Lot 1";
      if (!lotsMap[lotName]) lotsMap[lotName] = [];
      lotsMap[lotName].push(l);
    }

    // Créer lots et lignes
    let lotPos = 0;
    for (const [titre, lignes] of Object.entries(lotsMap)) {
      const lotRows: any[] = await prisma.$queryRawUnsafe(
        `INSERT INTO devis_lots (id, position, titre, devis_id)
         VALUES (gen_random_uuid()::text, $1, $2, $3)
         RETURNING id`,
        lotPos,
        titre,
        devisId
      );
      const lotId = lotRows[0].id;

      for (let i = 0; i < (lignes as any[]).length; i++) {
        const l = (lignes as any[])[i];
        await prisma.$executeRawUnsafe(
          `INSERT INTO devis_lignes (id, position, designation, description, quantite, unite, prix_unit_ht, taux_tva, lot_id)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8)`,
          i,
          l.designation || "",
          l.description || null,
          l.quantite || 1,
          l.unite || "u",
          l.prixUnitHT || 0,
          l.tauxTVA || 20,
          lotId
        );
      }
      lotPos++;
    }

    // Mettre à jour le statut agent devis
    await prisma.$executeRawUnsafe(
      `UPDATE agent_devis SET status = 'IMPORTE'::agent_devis_status, imported_devis_id = $1, updated_at = now() WHERE id = $2`,
      devisId,
      agentDevisId
    );

    return NextResponse.json({
      success: true,
      devisId,
      devisNumber: number,
    });
  } catch (e: any) {
    console.error("Erreur import agent-devis:", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}

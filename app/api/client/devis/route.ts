import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

// ─── HELPERS ────────────────────────────────────────────────────────────────

function computeTotals(lots: any[], remisePercent: number) {
  let totalHT = 0;
  let totalTVA = 0;
  for (const lot of lots) {
    for (const l of lot.lignes || []) {
      const lineHT = (l.quantite || 1) * (l.prixUnitHT || 0);
      totalHT += lineHT;
      totalTVA += lineHT * ((l.tauxTVA || 20) / 100);
    }
  }
  if (remisePercent > 0) {
    const remise = totalHT * (remisePercent / 100);
    totalHT -= remise;
    totalTVA -= totalTVA * (remisePercent / 100);
  }
  return { totalHT: Math.round(totalHT * 100) / 100, totalTVA: Math.round(totalTVA * 100) / 100, totalTTC: Math.round((totalHT + totalTVA) * 100) / 100 };
}

async function generateDevisNumber(clientId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.devis.count({
    where: { clientId, number: { startsWith: `DEV-${year}` } },
  });
  return `DEV-${year}-${String(count + 1).padStart(4, "0")}`;
}

// ─── GET — list devis ───────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await requireClient();
    const devis = await prisma.devis.findMany({
      where: { clientId: session.clientId! },
      include: {
        customer: { select: { id: true, name: true, ville: true } },
        _count: { select: { factures: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(devis);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// ─── POST — create devis ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;
    const body = await req.json();

    const number = await generateDevisNumber(clientId);
    const { totalHT, totalTVA, totalTTC } = computeTotals(body.lots || [], body.remisePercent || 0);

    const devis = await prisma.devis.create({
      data: {
        clientId,
        number,
        objet: body.objet || "Sans objet",
        customerId: body.customerId,
        validUntil: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 30 * 86400000),
        status: body.status || "BROUILLON",
        conditions: body.conditions || null,
        notes: body.notes || null,
        remisePercent: body.remisePercent || 0,
        totalHT,
        totalTVA,
        totalTTC,
        lots: {
          create: (body.lots || []).map((lot: any, lotIdx: number) => ({
            position: lotIdx,
            titre: lot.titre || `Lot ${lotIdx + 1}`,
            lignes: {
              create: (lot.lignes || []).map((l: any, lIdx: number) => ({
                position: lIdx,
                designation: l.designation || "",
                description: l.description || null,
                quantite: l.quantite || 1,
                unite: l.unite || "u",
                prixUnitHT: l.prixUnitHT || 0,
                tauxTVA: l.tauxTVA ?? 20,
              })),
            },
          })),
        },
      },
      include: {
        customer: true,
        lots: { include: { lignes: true }, orderBy: { position: "asc" } },
      },
    });

    return NextResponse.json(devis);
  } catch (e: any) {
    console.error("Devis create error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

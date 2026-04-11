import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

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

// GET — single devis with lots & lignes
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const devis = await prisma.devis.findFirst({
      where: { id: params.id, clientId: session.clientId! },
      include: {
        customer: true,
        lots: {
          include: { lignes: { orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        },
        factures: { select: { id: true, number: true, status: true, totalTTC: true } },
      },
    });
    if (!devis) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(devis);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// PUT — update devis (full replace of lots/lignes)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const body = await req.json();

    // Verify ownership
    const existing = await prisma.devis.findFirst({
      where: { id: params.id, clientId: session.clientId! },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { totalHT, totalTVA, totalTTC } = computeTotals(body.lots || [], body.remisePercent || 0);

    // Delete old lots (cascades to lignes)
    await prisma.devisLot.deleteMany({ where: { devisId: params.id } });

    const devis = await prisma.devis.update({
      where: { id: params.id },
      data: {
        objet: body.objet ?? existing.objet,
        customerId: body.customerId ?? existing.customerId,
        validUntil: body.validUntil ? new Date(body.validUntil) : existing.validUntil,
        status: body.status ?? existing.status,
        conditions: body.conditions !== undefined ? body.conditions : existing.conditions,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        remisePercent: body.remisePercent ?? existing.remisePercent,
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
    console.error("Devis update error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — delete devis
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const existing = await prisma.devis.findFirst({
      where: { id: params.id, clientId: session.clientId! },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.devis.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

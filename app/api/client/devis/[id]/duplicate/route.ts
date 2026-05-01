export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    const original = await prisma.devis.findFirst({
      where: { id: params.id, clientId },
      include: { lots: { include: { lignes: true }, orderBy: { position: "asc" } } },
    });
    if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const year = new Date().getFullYear();
    const count = await prisma.devis.count({ where: { clientId, number: { startsWith: `DEV-${year}` } } });
    const number = `DEV-${year}-${String(count + 1).padStart(4, "0")}`;

    const duplicate = await prisma.devis.create({
      data: {
        clientId,
        number,
        objet: `${original.objet} (copie)`,
        customerId: original.customerId,
        validUntil: new Date(Date.now() + 30 * 86400000),
        status: "BROUILLON",
        conditions: original.conditions,
        notes: original.notes,
        remisePercent: original.remisePercent,
        totalHT: original.totalHT,
        totalTVA: original.totalTVA,
        totalTTC: original.totalTTC,
        lots: {
          create: original.lots.map((lot: any) => ({
            position: lot.position,
            titre: lot.titre,
            lignes: {
              create: lot.lignes.map((l: any) => ({
                position: l.position,
                designation: l.designation,
                description: l.description,
                quantite: l.quantite,
                unite: l.unite,
                prixUnitHT: l.prixUnitHT,
                tauxTVA: l.tauxTVA,
              })),
            },
          })),
        },
      },
      include: { customer: true, lots: { include: { lignes: true } } },
    });

    return NextResponse.json(duplicate);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

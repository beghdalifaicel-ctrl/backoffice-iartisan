export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

// GET — single facture with lignes
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const facture = await prisma.facture.findFirst({
      where: { id: params.id, clientId: session.clientId! },
      include: {
        customer: true,
        lignes: { orderBy: { position: "asc" } },
        devis: { select: { id: true, number: true } },
      },
    });
    if (!facture) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(facture);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// PUT — update facture status
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const body = await req.json();

    const existing = await prisma.facture.findFirst({
      where: { id: params.id, clientId: session.clientId! },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: any = {};
    if (body.status) {
      data.status = body.status;
      if (body.status === "PAYEE") data.paidAt = new Date();
    }
    if (body.montantPaye !== undefined) data.montantPaye = body.montantPaye;
    if (body.echeance) data.echeance = new Date(body.echeance);
    if (body.notes !== undefined) data.notes = body.notes;

    const facture = await prisma.facture.update({
      where: { id: params.id },
      data,
      include: { customer: true, lignes: true },
    });

    return NextResponse.json(facture);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const existing = await prisma.facture.findFirst({
      where: { id: params.id, clientId: session.clientId! },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.facture.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

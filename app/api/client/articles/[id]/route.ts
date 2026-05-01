export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const body = await req.json();
    const existing = await prisma.article.findFirst({
      where: { id: params.id, clientId: session.clientId! },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const article = await prisma.article.update({
      where: { id: params.id },
      data: {
        categorie: body.categorie !== undefined ? body.categorie : existing.categorie,
        designation: body.designation ?? existing.designation,
        description: body.description !== undefined ? body.description : existing.description,
        unite: body.unite ?? existing.unite,
        prixUnitHT: body.prixUnitHT ?? existing.prixUnitHT,
        tauxTVA: body.tauxTVA ?? existing.tauxTVA,
      },
    });
    return NextResponse.json(article);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const existing = await prisma.article.findFirst({
      where: { id: params.id, clientId: session.clientId! },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.article.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireClient();
    const articles = await prisma.article.findMany({
      where: { clientId: session.clientId! },
      orderBy: [{ categorie: "asc" }, { designation: "asc" }],
    });
    return NextResponse.json(articles);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireClient();
    const body = await req.json();
    const article = await prisma.article.create({
      data: {
        clientId: session.clientId!,
        categorie: body.categorie || null,
        designation: body.designation,
        description: body.description || null,
        unite: body.unite || "u",
        prixUnitHT: body.prixUnitHT || 0,
        tauxTVA: body.tauxTVA ?? 20,
      },
    });
    return NextResponse.json(article);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

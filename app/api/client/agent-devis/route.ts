import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireClient();
    const searchParams = req.nextUrl.searchParams;

    const status = searchParams.get("status");
    const source = searchParams.get("source");

    // Build where clause
    const where: any = {
      clientId: session.clientId!,
    };

    if (status) {
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    const agentDevis = await prisma.agentDevis.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      agentDevis,
    });
  } catch (e: any) {
    console.error(
      "Erreur lors de la récupération des devis agents:",
      e
    );
    return NextResponse.json(
      { error: e.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireClient();
    const body = await req.json();

    const agentDevis = await prisma.agentDevis.create({
      data: {
        clientId: (await session).clientId!,
        source: body.source || "MANUEL",
        prospectName: body.prospectName,
        prospectPhone: body.prospectPhone || null,
        prospectEmail: body.prospectEmail || null,
        prospectAdresse: body.prospectAdresse || null,
        prospectVille: body.prospectVille || null,
        objet: body.objet,
        lignes: body.lignes || [],
        totalHtEstime: body.totalHtEstime || 0,
        totalTtcEstime: body.totalTtcEstime || 0,
        confidenceScore: body.confidenceScore || 0,
        aiNotes: body.aiNotes || null,
        conversationId: body.conversationId || null,
        messageExtract: body.messageExtract || null,
        status: "A_VALIDER",
      },
    });

    return NextResponse.json(
      { agentDevis },
      { status: 201 }
    );
  } catch (e: any) {
    console.error(
      "Erreur lors de la création du devis agent:",
      e
    );
    return NextResponse.json(
      { error: e.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

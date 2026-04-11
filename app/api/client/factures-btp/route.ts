import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireClient();
    const factures = await prisma.facture.findMany({
      where: { clientId: session.clientId! },
      include: {
        customer: { select: { id: true, name: true, ville: true } },
        devis: { select: { id: true, number: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(factures);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

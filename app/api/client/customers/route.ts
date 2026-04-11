import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

// GET — list customer contacts
export async function GET() {
  try {
    const session = await requireClient();
    const customers = await prisma.customerContact.findMany({
      where: { clientId: session.clientId! },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(customers);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// POST — create customer contact
export async function POST(req: NextRequest) {
  try {
    const session = await requireClient();
    const body = await req.json();
    const customer = await prisma.customerContact.create({
      data: {
        clientId: session.clientId!,
        type: body.type || "PARTICULIER",
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        adresse: body.adresse || null,
        codePostal: body.codePostal || null,
        ville: body.ville || null,
        siret: body.siret || null,
        tvaIntra: body.tvaIntra || null,
      },
    });
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

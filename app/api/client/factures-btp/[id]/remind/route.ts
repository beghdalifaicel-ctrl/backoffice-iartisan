export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { sendPaymentReminderEmail } from "@/lib/email";

// POST — envoyer un rappel de paiement par email
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    const facture = await prisma.facture.findFirst({
      where: { id: params.id, clientId },
      include: { customer: true },
    });

    if (!facture) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!facture.customer?.email) return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 400 });
    if (facture.status === "PAYEE") return NextResponse.json({ error: "Cette facture est déjà payée" }, { status: 400 });

    const artisan = await prisma.client.findUnique({
      where: { id: clientId },
      select: { company: true, phone: true },
    });

    const fmtDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d));
    const daysOverdue = facture.echeance
      ? Math.max(0, Math.floor((Date.now() - new Date(facture.echeance).getTime()) / 86400000))
      : 0;

    const result = await sendPaymentReminderEmail(facture.customer.email, {
      clientName: facture.customer.name,
      artisanCompany: artisan?.company || "Votre artisan",
      factureNumber: facture.number,
      totalTTC: facture.totalTTC.toFixed(2).replace(".", ","),
      echeance: facture.echeance ? fmtDate(facture.echeance) : "Non spécifiée",
      daysOverdue: Math.max(daysOverdue, 1),
      pdfUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.iartisan.io"}/api/client/factures-btp/${facture.id}/pdf`,
      artisanPhone: artisan?.phone || undefined,
    });

    return NextResponse.json({ success: true, emailSent: result.success });
  } catch (e: any) {
    console.error("Remind error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

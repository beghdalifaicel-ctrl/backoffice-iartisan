import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

interface ImportDevisBody {
  customerId?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireClient();
    const body: ImportDevisBody = await req.json();
    const agentDevisId = params.id;

    // Récupérer le devis agent
    const agentDevis = await prisma.agentDevis.findUnique({
      where: { id: agentDevisId },
    });

    if (!agentDevis) {
      return NextResponse.json(
        { error: "Devis agent non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier que le devis appartient au client authentifié
    if (agentDevis.clientId !== session.clientId) {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    let customerId = body.customerId;

    // Si pas de customerId fourni, créer un nouveau client
    if (!customerId) {
      const newCustomer = await prisma.customerContact.create({
        data: {
          clientId: session.clientId!,
          nom: agentDevis.prospectName,
          email: agentDevis.prospectEmail || undefined,
          telephone: agentDevis.prospectPhone || undefined,
          adresse: agentDevis.prospectAdresse || undefined,
          ville: agentDevis.prospectVille || undefined,
        },
      });
      customerId = newCustomer.id;
    }

    // Créer le devis réel avec lots et lignes
    const devis = await prisma.devis.create({
      data: {
        clientId: session.clientId!,
        customerContactId: customerId,
        objet: agentDevis.objet,
        statut: "BROUILLON",
        dateCreation: new Date(),
        montantHTEstime: agentDevis.totalHtEstime,
        montantTTCEstime: agentDevis.totalTtcEstime,
        notes: agentDevis.aiNotes || undefined,
      },
    });

    // Si des lignes existent, créer un lot par défaut et ajouter les lignes
    if (agentDevis.lignes && Array.isArray(agentDevis.lignes) && agentDevis.lignes.length > 0) {
      const lot = await prisma.devisLot.create({
        data: {
          devisId: devis.id,
          titre: "Lot 1",
          ordre: 1,
        },
      });

      // Créer les lignes du devis
      const lignesData = (agentDevis.lignes as any[]).map((ligne, index) => ({
        devisLotId: lot.id,
        designation: ligne.designation || "",
        quantite: ligne.quantite || 1,
        prixUnitHT: ligne.prixUnitHT || 0,
        tauxTVA: ligne.tauxTVA || 20,
        ordre: index + 1,
      }));

      await prisma.devisLigne.createMany({
        data: lignesData,
      });
    }

    // Mettre à jour le devis agent : marquer comme IMPORTE
    const updatedAgentDevis = await prisma.agentDevis.update({
      where: { id: agentDevisId },
      data: {
        status: "IMPORTE",
        importedDevisId: devis.id,
      },
    });

    return NextResponse.json({
      success: true,
      agentDevis: updatedAgentDevis,
      devis: {
        id: devis.id,
        objet: devis.objet,
        statut: devis.statut,
      },
    });
  } catch (e: any) {
    console.error("Erreur lors de l'import du devis agent:", e);
    return NextResponse.json(
      { error: e.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

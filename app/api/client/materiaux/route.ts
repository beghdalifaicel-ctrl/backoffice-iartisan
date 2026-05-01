export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get("q") || "";
    const categorie = searchParams.get("categorie") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: string[] = ["is_active = true"];
    const params: any[] = [];
    let paramIdx = 1;

    if (q) {
      conditions.push(`(designation ILIKE $${paramIdx} OR description ILIKE $${paramIdx} OR categorie ILIKE $${paramIdx})`);
      params.push(`%${q}%`);
      paramIdx++;
    }

    if (categorie) {
      conditions.push(`categorie = $${paramIdx}`);
      params.push(categorie);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count
    const countResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM materiaux_btp ${whereClause}`,
      ...params
    );
    const total = countResult[0]?.total || 0;

    // Get materiaux
    const materiaux: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, categorie, sous_categorie as "sousCategorie", designation, description,
              unite, prix_unitaire_ht as "prixUnitaireHt", taux_tva as "tauxTva",
              prix_min as "prixMin", prix_max as "prixMax", source, marque
       FROM materiaux_btp ${whereClause}
       ORDER BY categorie ASC, designation ASC
       LIMIT ${limit} OFFSET ${offset}`,
      ...params
    );

    // Get distinct categories
    const catResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT categorie FROM materiaux_btp WHERE is_active = true ORDER BY categorie ASC`
    );
    const categories = catResult.map((c: any) => c.categorie);

    return NextResponse.json({
      materiaux,
      total,
      categories,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e: any) {
    console.error("Erreur matériaux:", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}

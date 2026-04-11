import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireClient();
    const searchParams = req.nextUrl.searchParams;

    const q = searchParams.get("q") || "";
    const categorie = searchParams.get("categorie") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (q) {
      where.designation = {
        mode: "insensitive" as const,
        contains: q,
      };
    }

    if (categorie) {
      where.categorie = categorie;
    }

    // Get total count
    const total = await prisma.materiauxBtp.count({ where });

    // Get materiaux with pagination
    const materiaux = await prisma.materiauxBtp.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { designation: "asc" },
    });

    // Get all distinct categories for filtering
    const categoriesResult = await prisma.materiauxBtp.findMany({
      distinct: ["categorie"],
      select: { categorie: true },
      orderBy: { categorie: "asc" },
    });

    const categories = categoriesResult
      .map((item) => item.categorie)
      .filter((cat) => cat !== null) as string[];

    return NextResponse.json({
      materiaux,
      total,
      categories,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des matériaux:", e);
    return NextResponse.json(
      { error: e.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

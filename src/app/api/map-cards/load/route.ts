import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mapId = searchParams.get("mapId");

    if (!mapId) {
      return NextResponse.json({ error: "mapId required" }, { status: 400 });
    }

    const [cards, connections] = await Promise.all([
      prisma.mapCard.findMany({
        where: { mapId, softDeletedAt: null },
        orderBy: { createdAt: "asc" }
      }),
      prisma.cardConnection.findMany({
        where: { mapId, softDeletedAt: null },
        orderBy: { createdAt: "asc" }
      })
    ]);

    return NextResponse.json({ cards, connections });
  } catch (error) {
    console.error("Error loading map cards:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

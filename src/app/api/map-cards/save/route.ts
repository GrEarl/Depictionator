import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, mapId, cards, connections } = body;

    if (!workspaceId || !mapId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Delete existing cards and connections for this map
    await prisma.cardConnection.deleteMany({ where: { mapId } });
    await prisma.mapCard.deleteMany({ where: { mapId } });

    // Create new cards
    if (cards && cards.length > 0) {
      await prisma.mapCard.createMany({
        data: cards.map((card: any) => ({
          workspaceId,
          mapId,
          type: card.type,
          title: card.title,
          content: card.content || null,
          x: card.x,
          y: card.y,
          entityId: card.entityId || null,
          articleId: card.articleId || null,
          eventId: card.eventId || null
        }))
      });
    }

    // Create connections (need to map IDs)
    if (connections && connections.length > 0) {
      const createdCards = await prisma.mapCard.findMany({
        where: { mapId },
        select: { id: true, title: true, type: true, eventId: true, entityId: true }
      });

      const connectionsToCreate = connections
        .map((conn: any) => {
          // Find matching cards by comparing properties
          const fromCard = createdCards.find(c =>
            (conn.fromCardId.includes('event') && c.eventId) ||
            (conn.fromCardId.includes('entity') && c.entityId) ||
            c.id === conn.fromCardId
          );
          const toCard = createdCards.find(c =>
            (conn.toCardId.includes('event') && c.eventId) ||
            (conn.toCardId.includes('entity') && c.entityId) ||
            c.id === conn.toCardId
          );

          if (!fromCard || !toCard) return null;

          return {
            workspaceId,
            mapId,
            fromCardId: fromCard.id,
            toCardId: toCard.id,
            type: conn.type,
            label: conn.label || null
          };
        })
        .filter(Boolean);

      if (connectionsToCreate.length > 0) {
        await prisma.cardConnection.createMany({
          data: connectionsToCreate as any[]
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving map cards:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const mapId = String(searchParams.get("mapId") ?? "").trim();
  if (!mapId) return apiError("mapId required", 400);

  const map = await prisma.map.findFirst({
    where: { id: mapId, softDeletedAt: null },
    select: { id: true, workspaceId: true }
  });
  if (!map) return apiError("Map not found", 404);

  try {
    await requireWorkspaceAccess(session.userId, map.workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const [cards, connections] = await Promise.all([
    prisma.mapCard.findMany({
      where: { mapId, workspaceId: map.workspaceId, softDeletedAt: null },
      select: {
        id: true,
        x: true,
        y: true,
        type: true,
        title: true,
        content: true,
        entityId: true,
        articleId: true,
        eventId: true
      }
    }),
    prisma.cardConnection.findMany({
      where: { mapId, workspaceId: map.workspaceId, softDeletedAt: null },
      select: {
        id: true,
        fromCardId: true,
        toCardId: true,
        type: true,
        label: true
      }
    })
  ]);

  return NextResponse.json({ cards, connections });
}

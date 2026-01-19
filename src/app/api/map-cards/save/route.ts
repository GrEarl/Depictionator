import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardConnectionType, MapCardType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

type CardPayload = {
  id: string;
  x: number;
  y: number;
  type: string;
  title: string;
  content?: string;
  entityId?: string;
  articleId?: string;
  eventId?: string;
  assetId?: string;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  data?: unknown;
};

type ConnectionPayload = {
  id: string;
  fromCardId: string;
  toCardId: string;
  type?: string;
  label?: string;
  style?: string;
  data?: unknown;
};

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const workspaceId = String(body?.workspaceId ?? "");
  const mapId = String(body?.mapId ?? "");
  const cards = Array.isArray(body?.cards) ? (body.cards as CardPayload[]) : [];
  const connections = Array.isArray(body?.connections) ? (body.connections as ConnectionPayload[]) : [];

  if (!workspaceId || !mapId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const map = await prisma.map.findFirst({
    where: { id: mapId, workspaceId, softDeletedAt: null },
    select: { id: true }
  });
  if (!map) {
    return apiError("Map not found", 404);
  }

  const incomingCardIds = cards.map((card) => String(card.id || "")).filter(Boolean);
  const incomingConnectionIds = connections.map((conn) => String(conn.id || "")).filter(Boolean);
  const now = new Date();

  if (incomingCardIds.length) {
    const existingCards = await prisma.mapCard.findMany({
      where: { id: { in: incomingCardIds } },
      select: { id: true, mapId: true, workspaceId: true }
    });
    const mismatch = existingCards.find((card) => card.mapId !== mapId || card.workspaceId !== workspaceId);
    if (mismatch) {
      return apiError("Card mismatch", 409);
    }
  }

  if (incomingConnectionIds.length) {
    const existingConnections = await prisma.cardConnection.findMany({
      where: { id: { in: incomingConnectionIds } },
      select: { id: true, mapId: true, workspaceId: true }
    });
    const mismatch = existingConnections.find((conn) => conn.mapId !== mapId || conn.workspaceId !== workspaceId);
    if (mismatch) {
      return apiError("Connection mismatch", 409);
    }
  }

  const operations: any[] = [];

  operations.push(
    prisma.mapCard.updateMany({
      where: {
        mapId,
        workspaceId,
        softDeletedAt: null,
        id: incomingCardIds.length ? { notIn: incomingCardIds } : undefined
      },
      data: { softDeletedAt: now }
    })
  );

  operations.push(
    prisma.cardConnection.updateMany({
      where: {
        mapId,
        workspaceId,
        softDeletedAt: null,
        id: incomingConnectionIds.length ? { notIn: incomingConnectionIds } : undefined
      },
      data: { softDeletedAt: now }
    })
  );

  const cardTypeValues = Object.values(MapCardType) as string[];
  for (const card of cards) {
    const id = String(card.id || "");
    if (!id) continue;
    const typeValue = String(card.type || "note").toLowerCase();
    const type = cardTypeValues.includes(typeValue) ? (typeValue as MapCardType) : MapCardType.note;
    const x = Number(card.x ?? 0);
    const y = Number(card.y ?? 0);
    const title = String(card.title || "").trim() || "Untitled";

    operations.push(
      prisma.mapCard.upsert({
        where: { id },
        create: {
          id,
          workspaceId,
          mapId,
          type,
          title,
          content: card.content ? String(card.content) : null,
          x,
          y,
          width: card.width ?? null,
          height: card.height ?? null,
          rotation: card.rotation ?? null,
          zIndex: card.zIndex ?? null,
          entityId: card.entityId ?? null,
          articleId: card.articleId ?? null,
          eventId: card.eventId ?? null,
          assetId: card.assetId ?? null,
          data: card.data ?? null,
          softDeletedAt: null
        },
        update: {
          type,
          title,
          content: card.content ? String(card.content) : null,
          x,
          y,
          width: card.width ?? null,
          height: card.height ?? null,
          rotation: card.rotation ?? null,
          zIndex: card.zIndex ?? null,
          entityId: card.entityId ?? null,
          articleId: card.articleId ?? null,
          eventId: card.eventId ?? null,
          assetId: card.assetId ?? null,
          data: card.data ?? null,
          softDeletedAt: null
        }
      })
    );
  }

  const connectionTypeValues = Object.values(CardConnectionType) as string[];
  const validCardIds = new Set(incomingCardIds);
  for (const conn of connections) {
    const id = String(conn.id || "");
    const fromCardId = String(conn.fromCardId || "");
    const toCardId = String(conn.toCardId || "");
    if (!id || !fromCardId || !toCardId) continue;
    if (validCardIds.size && (!validCardIds.has(fromCardId) || !validCardIds.has(toCardId))) continue;
    const typeValue = String(conn.type || "timeline").toLowerCase();
    const type = connectionTypeValues.includes(typeValue)
      ? (typeValue as CardConnectionType)
      : CardConnectionType.timeline;

    operations.push(
      prisma.cardConnection.upsert({
        where: { id },
        create: {
          id,
          workspaceId,
          mapId,
          fromCardId,
          toCardId,
          type,
          label: conn.label ? String(conn.label) : null,
          style: conn.style ? String(conn.style) : null,
          data: conn.data ?? null,
          softDeletedAt: null
        },
        update: {
          type,
          label: conn.label ? String(conn.label) : null,
          style: conn.style ? String(conn.style) : null,
          data: conn.data ?? null,
          softDeletedAt: null
        }
      })
    );
  }

  if (operations.length) {
    await prisma.$transaction(operations);
  }

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "map",
    targetId: mapId
  });

  return NextResponse.json({ ok: true });
}

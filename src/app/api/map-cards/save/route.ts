import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MapCardType, CardConnectionType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { randomUUID } from "node:crypto";

type CardInput = {
  id?: string;
  x?: number;
  y?: number;
  type?: string;
  title?: string;
  content?: string;
  entityId?: string | null;
  articleId?: string | null;
  eventId?: string | null;
  data?: unknown;
};

type ConnectionInput = {
  id?: string;
  fromCardId?: string;
  toCardId?: string;
  type?: string;
  label?: string | null;
  style?: string | null;
  data?: unknown;
};

function normalizeCardType(value?: string) {
  const raw = String(value ?? "note").trim().toLowerCase();
  return (Object.values(MapCardType) as string[]).includes(raw)
    ? (raw as MapCardType)
    : MapCardType.note;
}

function normalizeConnectionType(value?: string) {
  const raw = String(value ?? "timeline").trim().toLowerCase();
  return (Object.values(CardConnectionType) as string[]).includes(raw)
    ? (raw as CardConnectionType)
    : CardConnectionType.timeline;
}

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

  const workspaceId = String(body?.workspaceId ?? "").trim();
  const mapId = String(body?.mapId ?? "").trim();
  const cards: CardInput[] = Array.isArray(body?.cards) ? body.cards : [];
  const connections: ConnectionInput[] = Array.isArray(body?.connections) ? body.connections : [];

  if (!workspaceId || !mapId) return apiError("Missing fields", 400);

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const map = await prisma.map.findFirst({
    where: { id: mapId, workspaceId, softDeletedAt: null },
    select: { id: true }
  });
  if (!map) return apiError("Map not found", 404);

  const now = new Date();

  const existingCards = await prisma.mapCard.findMany({
    where: { mapId, workspaceId },
    select: { id: true }
  });
  const incomingCardIds = cards
    .map((card) => String(card?.id ?? "").trim())
    .filter(Boolean);

  await prisma.mapCard.updateMany({
    where: {
      mapId,
      workspaceId,
      softDeletedAt: null,
      ...(incomingCardIds.length ? { id: { notIn: incomingCardIds } } : {})
    },
    data: { softDeletedAt: now }
  });

  for (const card of cards) {
    const id = String(card?.id ?? "").trim() || randomUUID();
    const x = Number(card?.x);
    const y = Number(card?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const data = {
      workspaceId,
      mapId,
      type: normalizeCardType(card?.type),
      title: String(card?.title ?? "").trim() || "Untitled",
      content: card?.content ? String(card.content) : null,
      x,
      y,
      entityId: card?.entityId ? String(card.entityId) : null,
      articleId: card?.articleId ? String(card.articleId) : null,
      eventId: card?.eventId ? String(card.eventId) : null,
      data: card?.data ?? undefined,
      softDeletedAt: null
    };

    await prisma.mapCard.upsert({
      where: { id },
      create: { id, ...data },
      update: data
    });
  }

  const existingConnections = await prisma.cardConnection.findMany({
    where: { mapId, workspaceId },
    select: { id: true }
  });
  const incomingConnectionIds = connections
    .map((conn) => String(conn?.id ?? "").trim())
    .filter(Boolean);

  await prisma.cardConnection.updateMany({
    where: {
      mapId,
      workspaceId,
      softDeletedAt: null,
      ...(incomingConnectionIds.length ? { id: { notIn: incomingConnectionIds } } : {})
    },
    data: { softDeletedAt: now }
  });

  for (const conn of connections) {
    const id = String(conn?.id ?? "").trim() || randomUUID();
    const fromCardId = String(conn?.fromCardId ?? "").trim();
    const toCardId = String(conn?.toCardId ?? "").trim();
    if (!fromCardId || !toCardId) continue;

    const data = {
      workspaceId,
      mapId,
      fromCardId,
      toCardId,
      type: normalizeConnectionType(conn?.type),
      label: conn?.label ? String(conn.label) : null,
      style: conn?.style ? String(conn.style) : null,
      data: conn?.data ?? undefined,
      softDeletedAt: null
    };

    await prisma.cardConnection.upsert({
      where: { id },
      create: { id, ...data },
      update: data
    });
  }

  return NextResponse.json({ ok: true });
}

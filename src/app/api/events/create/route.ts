import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { EventType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { parseOptionalFloat, parseOptionalInt, parseCsv } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const timelineId = String(form.get("timelineId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const eventTypeValue = String(form.get("eventType") ?? "other").trim().toLowerCase();
  const eventType = (Object.values(EventType) as string[]).includes(eventTypeValue)
    ? (eventTypeValue as EventType)
    : EventType.other;
  const worldStart = String(form.get("worldStart") ?? "").trim();
  const worldEnd = String(form.get("worldEnd") ?? "").trim();
  const storyOrder = parseOptionalInt(form.get("storyOrder"));
  const storyChapterId = String(form.get("storyChapterId") ?? "").trim();
  const summaryMd = String(form.get("summaryMd") ?? "").trim();
  const locationMapId = String(form.get("locationMapId") ?? "").trim();
  const locationPinId = String(form.get("locationPinId") ?? "").trim();
  const locationX = parseOptionalFloat(form.get("locationX"));
  const locationY = parseOptionalFloat(form.get("locationY"));
  const markerStyleId = String(form.get("markerStyleId") ?? "").trim();
  const involvedEntityIds = parseCsv(form.get("involvedEntityIds"));

  if (!workspaceId || !timelineId || !title) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const timeline = await prisma.timeline.findFirst({
    where: { id: timelineId, workspaceId, softDeletedAt: null }
  });
  if (!timeline) {
    return apiError("Timeline not found", 404);
  }

  if (involvedEntityIds.length) {
    const count = await prisma.entity.count({
      where: { id: { in: involvedEntityIds }, workspaceId, softDeletedAt: null }
    });
    if (count !== involvedEntityIds.length) {
      return apiError("Involved entities not found", 404);
    }
  }

  if (storyChapterId) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: storyChapterId, workspaceId, softDeletedAt: null }
    });
    if (!chapter) {
      return apiError("Story chapter not found", 404);
    }
  }

  if (markerStyleId) {
    const markerStyle = await prisma.markerStyle.findFirst({
      where: { id: markerStyleId, workspaceId, softDeletedAt: null }
    });
    if (!markerStyle) {
      return apiError("Marker style not found", 404);
    }
  }

  let locationMap: { id: string } | null = null;
  if (locationMapId) {
    locationMap = await prisma.map.findFirst({
      where: { id: locationMapId, workspaceId, softDeletedAt: null }
    });
    if (!locationMap) {
      return apiError("Location map not found", 404);
    }
  }

  let resolvedLocationMapId = locationMap?.id ?? null;
  let locationPinMapId: string | null = null;
  if (locationPinId) {
    const pin = await prisma.pin.findFirst({
      where: { id: locationPinId, workspaceId, softDeletedAt: null }
    });
    if (!pin) {
      return apiError("Location pin not found", 404);
    }
    locationPinMapId = pin.mapId;
    if (resolvedLocationMapId && pin.mapId !== resolvedLocationMapId) {
      return apiError("Location pin does not belong to map", 400);
    }
  }
  if (!resolvedLocationMapId && locationPinMapId) {
    resolvedLocationMapId = locationPinMapId;
  }

  const event = await prisma.event.create({
    data: {
      workspaceId,
      timelineId,
      title,
      eventType,
      worldStart: worldStart || null,
      worldEnd: worldEnd || null,
      storyOrder: storyOrder ?? null,
      storyChapterId: storyChapterId || null,
      summaryMd: summaryMd || null,
      involvedEntityIds,
      locationMapId: resolvedLocationMapId,
      locationPinId: locationPinId || null,
      locationX: locationX ?? null,
      locationY: locationY ?? null,
      markerStyleId: markerStyleId || null,
      createdById: session.userId,
      updatedById: session.userId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "event",
    targetId: event.id
  });

  await notifyWatchers({
    workspaceId,
    targetType: "timeline",
    targetId: timelineId,
    type: "event_created",
    payload: { eventId: event.id, timelineId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/timeline"));
}



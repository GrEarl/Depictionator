import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { EventType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import {
  parseOptionalFloat,
  parseOptionalInt,
  parseOptionalString,
  parseCsv
} from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const eventId = String(form.get("eventId") ?? "");

  if (!workspaceId || !eventId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const existing = await prisma.event.findFirst({
    where: { id: eventId, workspaceId }
  });
  if (!existing) {
    return apiError("Event not found", 404);
  }

  const data: Record<string, unknown> = {};
  const timelineId = parseOptionalString(form.get("timelineId"));
  if (timelineId !== null) {
    const timeline = await prisma.timeline.findFirst({
      where: { id: timelineId, workspaceId, softDeletedAt: null }
    });
    if (!timeline) {
      return apiError("Timeline not found", 404);
    }
    data.timelineId = timelineId;
  }

  const title = parseOptionalString(form.get("title"));
  if (title !== null) data.title = title;
  const eventType = parseOptionalString(form.get("eventType"));
  if (eventType !== null) {
    const eventTypeValue = eventType.trim().toLowerCase();
    data.eventType = (Object.values(EventType) as string[]).includes(eventTypeValue)
      ? (eventTypeValue as EventType)
      : EventType.other;
  }
  const markerStyleId = parseOptionalString(form.get("markerStyleId"));
  if (markerStyleId !== null) {
    if (markerStyleId) {
      const markerStyle = await prisma.markerStyle.findFirst({
        where: { id: markerStyleId, workspaceId, softDeletedAt: null }
      });
      if (!markerStyle) {
        return apiError("Marker style not found", 404);
      }
      data.markerStyleId = markerStyleId;
    } else {
      data.markerStyleId = null;
    }
  }
  const worldStart = parseOptionalString(form.get("worldStart"));
  if (worldStart !== null) data.worldStart = worldStart;
  const worldEnd = parseOptionalString(form.get("worldEnd"));
  if (worldEnd !== null) data.worldEnd = worldEnd;
  const storyOrder = parseOptionalInt(form.get("storyOrder"));
  if (storyOrder !== null) data.storyOrder = storyOrder;
  const storyChapterId = parseOptionalString(form.get("storyChapterId"));
  if (storyChapterId !== null) {
    if (storyChapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: storyChapterId, workspaceId, softDeletedAt: null }
      });
      if (!chapter) {
        return apiError("Story chapter not found", 404);
      }
      data.storyChapterId = storyChapterId;
    } else {
      data.storyChapterId = null;
    }
  }
  const summaryMd = parseOptionalString(form.get("summaryMd"));
  if (summaryMd !== null) data.summaryMd = summaryMd;
  const locationMapId = parseOptionalString(form.get("locationMapId"));
  let resolvedLocationMapId: string | null | undefined;
  if (locationMapId !== null) {
    if (locationMapId) {
      const map = await prisma.map.findFirst({
        where: { id: locationMapId, workspaceId, softDeletedAt: null }
      });
      if (!map) {
        return apiError("Location map not found", 404);
      }
      resolvedLocationMapId = locationMapId;
      data.locationMapId = locationMapId;
    } else {
      resolvedLocationMapId = null;
      data.locationMapId = null;
    }
  }
  const locationPinId = parseOptionalString(form.get("locationPinId"));
  if (locationPinId !== null) {
    if (locationPinId) {
      const pin = await prisma.pin.findFirst({
        where: { id: locationPinId, workspaceId, softDeletedAt: null }
      });
      if (!pin) {
        return apiError("Location pin not found", 404);
      }
      const effectiveMapId =
        resolvedLocationMapId !== undefined ? resolvedLocationMapId : existing.locationMapId;
      if (effectiveMapId && pin.mapId !== effectiveMapId) {
        return apiError("Location pin does not belong to map", 400);
      }
      if (effectiveMapId === null) {
        data.locationMapId = pin.mapId;
      }
      data.locationPinId = locationPinId;
    } else {
      data.locationPinId = null;
    }
  }
  const locationX = parseOptionalFloat(form.get("locationX"));
  if (locationX !== null) data.locationX = locationX;
  const locationY = parseOptionalFloat(form.get("locationY"));
  if (locationY !== null) data.locationY = locationY;
  const involvedEntityIds = form.get("involvedEntityIds");
  if (involvedEntityIds !== null && String(involvedEntityIds).trim()) {
    const parsedIds = parseCsv(involvedEntityIds);
    if (parsedIds.length) {
      const count = await prisma.entity.count({
        where: { id: { in: parsedIds }, workspaceId, softDeletedAt: null }
      });
      if (count !== parsedIds.length) {
        return apiError("Involved entities not found", 404);
      }
    }
    data.involvedEntityIds = parsedIds;
  }
  data.updatedById = session.userId;

  await prisma.event.update({ where: { id: eventId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "event",
    targetId: eventId
  });

  await notifyWatchers({
    workspaceId,
    targetType: "event",
    targetId: eventId,
    type: "event_updated",
    payload: { eventId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/timeline"));
}



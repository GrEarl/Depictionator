import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
  if (eventType !== null) data.eventType = eventType;
  const markerStyleId = parseOptionalString(form.get("markerStyleId"));
  if (markerStyleId !== null) data.markerStyleId = markerStyleId;
  const worldStart = parseOptionalString(form.get("worldStart"));
  if (worldStart !== null) data.worldStart = worldStart;
  const worldEnd = parseOptionalString(form.get("worldEnd"));
  if (worldEnd !== null) data.worldEnd = worldEnd;
  const storyOrder = parseOptionalInt(form.get("storyOrder"));
  if (storyOrder !== null) data.storyOrder = storyOrder;
  const storyChapterId = parseOptionalString(form.get("storyChapterId"));
  if (storyChapterId !== null) data.storyChapterId = storyChapterId;
  const summaryMd = parseOptionalString(form.get("summaryMd"));
  if (summaryMd !== null) data.summaryMd = summaryMd;
  const locationMapId = parseOptionalString(form.get("locationMapId"));
  if (locationMapId !== null) data.locationMapId = locationMapId;
  const locationPinId = parseOptionalString(form.get("locationPinId"));
  if (locationPinId !== null) data.locationPinId = locationPinId;
  const locationX = parseOptionalFloat(form.get("locationX"));
  if (locationX !== null) data.locationX = locationX;
  const locationY = parseOptionalFloat(form.get("locationY"));
  if (locationY !== null) data.locationY = locationY;
  const involvedEntityIds = form.get("involvedEntityIds");
  if (involvedEntityIds !== null && String(involvedEntityIds).trim()) {
    data.involvedEntityIds = parseCsv(involvedEntityIds);
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

  return NextResponse.redirect(new URL("/timeline", request.url));
}

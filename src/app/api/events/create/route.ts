import { NextResponse } from "next/server";
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
      locationMapId: locationMapId || null,
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

  return NextResponse.redirect(new URL("/timeline", request.url));
}

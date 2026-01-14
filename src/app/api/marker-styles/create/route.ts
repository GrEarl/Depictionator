import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { EventType, LocationType, MarkerShape, MarkerTarget } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const targetValue = String(form.get("target") ?? "").trim().toLowerCase();
  const target = (Object.values(MarkerTarget) as string[]).includes(targetValue)
    ? (targetValue as MarkerTarget)
    : null;
  const eventTypeValue = String(form.get("eventType") ?? "").trim().toLowerCase();
  const locationTypeValue = String(form.get("locationType") ?? "").trim().toLowerCase();
  const eventType = (Object.values(EventType) as string[]).includes(eventTypeValue)
    ? (eventTypeValue as EventType)
    : null;
  const locationType = (Object.values(LocationType) as string[]).includes(locationTypeValue)
    ? (locationTypeValue as LocationType)
    : null;
  const shapeValue = String(form.get("shape") ?? "").trim().toLowerCase();
  const shape = (Object.values(MarkerShape) as string[]).includes(shapeValue)
    ? (shapeValue as MarkerShape)
    : MarkerShape.circle;
  const color = String(form.get("color") ?? "#4b6ea8");
  const iconKey = String(form.get("iconKey") ?? "").trim();

  if (!workspaceId || !name || !target || !shape) {
    return apiError("Missing required fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const style = await prisma.markerStyle.create({
    data: {
      workspaceId,
      name,
      target,
      eventType: eventType || null,
      locationType: locationType || null,
      shape,
      color,
      iconKey: iconKey || null
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "marker_style",
    targetId: style.id,
    meta: { name, target }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/maps"));
}



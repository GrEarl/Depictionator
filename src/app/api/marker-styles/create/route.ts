import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EventType, LocationType } from "@prisma/client";
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
  const target = String(form.get("target") ?? "") as "event" | "location" | "path";
  const eventTypeValue = String(form.get("eventType") ?? "").trim().toLowerCase();
  const locationTypeValue = String(form.get("locationType") ?? "").trim().toLowerCase();
  const eventType = (Object.values(EventType) as string[]).includes(eventTypeValue)
    ? (eventTypeValue as EventType)
    : null;
  const locationType = (Object.values(LocationType) as string[]).includes(locationTypeValue)
    ? (locationTypeValue as LocationType)
    : null;
  const shape = String(form.get("shape") ?? "");
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

  return NextResponse.redirect(new URL("/maps", request.url));
}

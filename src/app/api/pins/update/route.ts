import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { LocationType, MarkerShape, TruthFlag } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { parseOptionalFloat, parseOptionalString } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const pinId = String(form.get("pinId") ?? "");

  if (!workspaceId || !pinId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const data: Record<string, unknown> = {};
  const x = parseOptionalFloat(form.get("x"));
  const y = parseOptionalFloat(form.get("y"));
  if (x !== null) data.x = x;
  if (y !== null) data.y = y;
  const label = parseOptionalString(form.get("label"));
  if (label !== null) data.label = label;
  const entityId = parseOptionalString(form.get("entityId"));
  if (entityId !== null) data.entityId = entityId;
  const locationType = parseOptionalString(form.get("locationType"));
  if (locationType !== null) {
    const locationValue = locationType.trim().toLowerCase();
    data.locationType = (Object.values(LocationType) as string[]).includes(locationValue)
      ? (locationValue as LocationType)
      : LocationType.other;
  }
  const markerStyleId = parseOptionalString(form.get("markerStyleId"));
  if (markerStyleId !== null) data.markerStyleId = markerStyleId;
  const markerShape = parseOptionalString(form.get("markerShape"));
  if (markerShape !== null) {
    const shapeValue = markerShape.trim().toLowerCase();
    data.markerShape = (Object.values(MarkerShape) as string[]).includes(shapeValue)
      ? (shapeValue as MarkerShape)
      : null;
  }
  const markerColor = parseOptionalString(form.get("markerColor"));
  if (markerColor !== null) data.markerColor = markerColor;
  const worldFrom = parseOptionalString(form.get("worldFrom"));
  if (worldFrom !== null) data.worldFrom = worldFrom;
  const worldTo = parseOptionalString(form.get("worldTo"));
  if (worldTo !== null) data.worldTo = worldTo;
  const storyFrom = parseOptionalString(form.get("storyFromChapterId"));
  if (storyFrom !== null) data.storyFromChapterId = storyFrom;
  const storyTo = parseOptionalString(form.get("storyToChapterId"));
  if (storyTo !== null) data.storyToChapterId = storyTo;
  const viewpointId = parseOptionalString(form.get("viewpointId"));
  if (viewpointId !== null) data.viewpointId = viewpointId;
  const truthFlag = parseOptionalString(form.get("truthFlag"));
  if (truthFlag !== null) {
    const truthValue = truthFlag.trim().toLowerCase();
    data.truthFlag = (Object.values(TruthFlag) as string[]).includes(truthValue)
      ? (truthValue as TruthFlag)
      : TruthFlag.canonical;
  }

  await prisma.pin.update({ where: { id: pinId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "pin",
    targetId: pinId
  });

  await notifyWatchers({
    workspaceId,
    targetType: "pin",
    targetId: pinId,
    type: "pin_updated",
    payload: { pinId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/maps"));
}



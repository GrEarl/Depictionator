import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { LocationType, MarkerShape, TruthFlag } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { parseOptionalFloat } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const mapId = String(form.get("mapId") ?? "");
  const x = parseOptionalFloat(form.get("x"));
  const y = parseOptionalFloat(form.get("y"));
  const label = String(form.get("label") ?? "").trim();
  const entityId = String(form.get("entityId") ?? "").trim();
  const locationValue = String(form.get("locationType") ?? "other")
    .trim()
    .toLowerCase();
  const locationType = (Object.values(LocationType) as string[]).includes(locationValue)
    ? (locationValue as LocationType)
    : LocationType.other;
  const markerStyleId = String(form.get("markerStyleId") ?? "").trim();
  const markerShapeValue = String(form.get("markerShape") ?? "").trim().toLowerCase();
  const markerShape = (Object.values(MarkerShape) as string[]).includes(markerShapeValue)
    ? (markerShapeValue as MarkerShape)
    : null;
  const markerColor = String(form.get("markerColor") ?? "").trim();
  const worldFrom = String(form.get("worldFrom") ?? "").trim();
  const worldTo = String(form.get("worldTo") ?? "").trim();
  const storyFromChapterId = String(form.get("storyFromChapterId") ?? "").trim();
  const storyToChapterId = String(form.get("storyToChapterId") ?? "").trim();
  const viewpointId = String(form.get("viewpointId") ?? "").trim();
  const truthValue = String(form.get("truthFlag") ?? "canonical")
    .trim()
    .toLowerCase();
  const truthFlag = (Object.values(TruthFlag) as string[]).includes(truthValue)
    ? (truthValue as TruthFlag)
    : TruthFlag.canonical;

  if (!workspaceId || !mapId || x === null || y === null) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const map = await prisma.map.findFirst({ where: { id: mapId, workspaceId, softDeletedAt: null } });
  if (!map) {
    return apiError("Map not found", 404);
  }

  const pin = await prisma.pin.create({
    data: {
      workspaceId,
      mapId,
      x,
      y,
      entityId: entityId || null,
      label: label || null,
      locationType,
      truthFlag,
      markerStyleId: markerStyleId || null,
      markerShape: markerShape || null,
      markerColor: markerColor || null,
      worldFrom: worldFrom || null,
      worldTo: worldTo || null,
      storyFromChapterId: storyFromChapterId || null,
      storyToChapterId: storyToChapterId || null,
      viewpointId: viewpointId || null
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "pin",
    targetId: pin.id
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: mapId,
    type: "pin_created",
    payload: { pinId: pin.id, mapId }
  });

  if (pin.entityId) {
    await notifyWatchers({
      workspaceId,
      targetType: "entity",
      targetId: pin.entityId,
      type: "pin_created",
      payload: { pinId: pin.id }
    });
  }

  return NextResponse.redirect(toRedirectUrl(request, "/maps"));
}



import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TruthFlag } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import {
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
  const pathId = String(form.get("pathId") ?? "");

  if (!workspaceId || !pathId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const data: Record<string, unknown> = {};
  const polylineRaw = parseOptionalString(form.get("polyline"));
  if (polylineRaw !== null) {
    try {
      data.polyline = JSON.parse(polylineRaw) as object;
    } catch {
      return apiError("Invalid polyline JSON", 400);
    }
  }

  const arrowStyle = parseOptionalString(form.get("arrowStyle"));
  if (arrowStyle !== null) data.arrowStyle = arrowStyle;
  const truthFlag = parseOptionalString(form.get("truthFlag"));
  if (truthFlag !== null) {
    const truthValue = truthFlag.trim().toLowerCase();
    data.truthFlag = (Object.values(TruthFlag) as string[]).includes(truthValue)
      ? (truthValue as TruthFlag)
      : TruthFlag.canonical;
  }
  const strokeColor = parseOptionalString(form.get("strokeColor"));
  if (strokeColor !== null) data.strokeColor = strokeColor;
  const strokeWidth = parseOptionalInt(form.get("strokeWidth"));
  if (strokeWidth !== null) data.strokeWidth = strokeWidth;
  const markerStyleId = parseOptionalString(form.get("markerStyleId"));
  if (markerStyleId !== null) data.markerStyleId = markerStyleId;
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
  const relatedEventId = parseOptionalString(form.get("relatedEventId"));
  if (relatedEventId !== null) data.relatedEventId = relatedEventId;
  const relatedEntityIds = form.get("relatedEntityIds");
  if (relatedEntityIds !== null && String(relatedEntityIds).trim()) {
    data.relatedEntityIds = parseCsv(relatedEntityIds);
  }

  await prisma.path.update({ where: { id: pathId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "path",
    targetId: pathId
  });

  await notifyWatchers({
    workspaceId,
    targetType: "path",
    targetId: pathId,
    type: "path_updated",
    payload: { pathId }
  });

  return NextResponse.redirect(new URL("/maps", request.url));
}

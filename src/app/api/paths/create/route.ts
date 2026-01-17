import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { ArrowStyle, TruthFlag } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { parseCsv } from "@/lib/forms";

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
  const polyline = String(form.get("polyline") ?? "[]");
  const arrowStyleValue = String(form.get("arrowStyle") ?? "arrow")
    .trim()
    .toLowerCase();
  const arrowStyle = (Object.values(ArrowStyle) as string[]).includes(arrowStyleValue)
    ? (arrowStyleValue as ArrowStyle)
    : ArrowStyle.arrow;
  const strokeColor = String(form.get("strokeColor") ?? "").trim();
  const strokeWidthRaw = String(form.get("strokeWidth") ?? "").trim();
  const markerStyleId = String(form.get("markerStyleId") ?? "").trim();
  const layerId = String(form.get("layerId") ?? "").trim();
  const relatedEventId = String(form.get("relatedEventId") ?? "").trim();
  const relatedEntityIds = parseCsv(form.get("relatedEntityIds"));
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

  if (!workspaceId || !mapId) {
    return apiError("Missing fields", 400);
  }

  let parsedPolyline: unknown;
  try {
    parsedPolyline = JSON.parse(polyline);
  } catch {
    return apiError("Invalid polyline JSON", 400);
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

  let resolvedLayerId: string | null = null;
  if (layerId) {
    const layer = await prisma.mapLayer.findFirst({
      where: { id: layerId, workspaceId, mapId, softDeletedAt: null }
    });
    if (!layer) {
      return apiError("Layer not found", 404);
    }
    resolvedLayerId = layer.id;
  }

  if (markerStyleId) {
    const markerStyle = await prisma.markerStyle.findFirst({
      where: { id: markerStyleId, workspaceId, softDeletedAt: null }
    });
    if (!markerStyle) {
      return apiError("Marker style not found", 404);
    }
  }

  if (viewpointId) {
    const viewpoint = await prisma.viewpoint.findFirst({
      where: { id: viewpointId, workspaceId, softDeletedAt: null }
    });
    if (!viewpoint) {
      return apiError("Viewpoint not found", 404);
    }
  }

  if (storyFromChapterId) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: storyFromChapterId, workspaceId, softDeletedAt: null }
    });
    if (!chapter) {
      return apiError("Story chapter not found", 404);
    }
  }

  if (storyToChapterId) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: storyToChapterId, workspaceId, softDeletedAt: null }
    });
    if (!chapter) {
      return apiError("Story chapter not found", 404);
    }
  }

  if (relatedEventId) {
    const event = await prisma.event.findFirst({
      where: { id: relatedEventId, workspaceId, softDeletedAt: null }
    });
    if (!event) {
      return apiError("Event not found", 404);
    }
  }

  if (relatedEntityIds.length) {
    const count = await prisma.entity.count({
      where: { id: { in: relatedEntityIds }, workspaceId, softDeletedAt: null }
    });
    if (count !== relatedEntityIds.length) {
      return apiError("Related entities not found", 404);
    }
  }

  const strokeWidth = strokeWidthRaw ? Number(strokeWidthRaw) : null;

  const path = await prisma.path.create({
    data: {
      workspaceId,
      mapId,
      polyline: parsedPolyline as object,
      truthFlag,
      arrowStyle,
      strokeColor: strokeColor || null,
      strokeWidth: strokeWidth ?? null,
      relatedEntityIds,
      relatedEventId: relatedEventId || null,
      markerStyleId: markerStyleId || null,
      layerId: resolvedLayerId,
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
    targetType: "path",
    targetId: path.id
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: mapId,
    type: "path_created",
    payload: { pathId: path.id, mapId }
  });

  if (path.relatedEventId) {
    await notifyWatchers({
      workspaceId,
      targetType: "event",
      targetId: path.relatedEventId,
      type: "path_created",
      payload: { pathId: path.id }
    });
  }

  return NextResponse.redirect(toRedirectUrl(request, "/maps"));
}



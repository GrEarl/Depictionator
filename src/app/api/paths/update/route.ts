import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ArrowStyle, TruthFlag } from "@prisma/client";
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
  if (arrowStyle !== null) {
    const arrowValue = arrowStyle.trim().toLowerCase();
    data.arrowStyle = (Object.values(ArrowStyle) as string[]).includes(arrowValue)
      ? (arrowValue as ArrowStyle)
      : ArrowStyle.arrow;
  }
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
  const layerId = parseOptionalString(form.get("layerId"));
  const worldFrom = parseOptionalString(form.get("worldFrom"));
  if (worldFrom !== null) data.worldFrom = worldFrom;
  const worldTo = parseOptionalString(form.get("worldTo"));
  if (worldTo !== null) data.worldTo = worldTo;
  const storyFrom = parseOptionalString(form.get("storyFromChapterId"));
  if (storyFrom !== null) {
    if (storyFrom) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: storyFrom, workspaceId, softDeletedAt: null }
      });
      if (!chapter) {
        return apiError("Story chapter not found", 404);
      }
      data.storyFromChapterId = storyFrom;
    } else {
      data.storyFromChapterId = null;
    }
  }
  const storyTo = parseOptionalString(form.get("storyToChapterId"));
  if (storyTo !== null) {
    if (storyTo) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: storyTo, workspaceId, softDeletedAt: null }
      });
      if (!chapter) {
        return apiError("Story chapter not found", 404);
      }
      data.storyToChapterId = storyTo;
    } else {
      data.storyToChapterId = null;
    }
  }
  const viewpointId = parseOptionalString(form.get("viewpointId"));
  if (viewpointId !== null) {
    if (viewpointId) {
      const viewpoint = await prisma.viewpoint.findFirst({
        where: { id: viewpointId, workspaceId, softDeletedAt: null }
      });
      if (!viewpoint) {
        return apiError("Viewpoint not found", 404);
      }
      data.viewpointId = viewpointId;
    } else {
      data.viewpointId = null;
    }
  }
  const relatedEventId = parseOptionalString(form.get("relatedEventId"));
  if (relatedEventId !== null) {
    if (relatedEventId) {
      const event = await prisma.event.findFirst({
        where: { id: relatedEventId, workspaceId, softDeletedAt: null }
      });
      if (!event) {
        return apiError("Event not found", 404);
      }
      data.relatedEventId = relatedEventId;
    } else {
      data.relatedEventId = null;
    }
  }
  const relatedEntityIds = form.get("relatedEntityIds");
  if (relatedEntityIds !== null && String(relatedEntityIds).trim()) {
    const parsedIds = parseCsv(relatedEntityIds);
    if (parsedIds.length) {
      const count = await prisma.entity.count({
        where: { id: { in: parsedIds }, workspaceId, softDeletedAt: null }
      });
      if (count !== parsedIds.length) {
        return apiError("Related entities not found", 404);
      }
    }
    data.relatedEntityIds = parsedIds;
  }

  if (layerId !== null) {
    const path = await prisma.path.findFirst({ where: { id: pathId, workspaceId } });
    if (!path) {
      return apiError("Path not found", 404);
    }
    if (layerId) {
      const layer = await prisma.mapLayer.findFirst({
        where: { id: layerId, workspaceId, mapId: path.mapId, softDeletedAt: null }
      });
      if (!layer) {
        return apiError("Layer not found", 404);
      }
      data.layerId = layer.id;
    } else {
      data.layerId = null;
    }
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

  return NextResponse.json({ ok: true, pathId });
}


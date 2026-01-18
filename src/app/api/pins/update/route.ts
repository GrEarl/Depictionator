import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
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
  const entityQuery = parseOptionalString(form.get("entityQuery"));
  const entityId = parseOptionalString(form.get("entityId"));
  if (entityId !== null) {
    if (entityId) {
      const entity = await prisma.entity.findFirst({
        where: { id: entityId, workspaceId, softDeletedAt: null }
      });
      if (!entity) {
        return apiError("Entity not found", 404);
      }
      data.entityId = entityId;
    } else {
      data.entityId = null;
    }
  } else if (entityQuery !== null && entityQuery.trim()) {
    const matches = await prisma.entity.findMany({
      where: {
        workspaceId,
        softDeletedAt: null,
        OR: [
          { title: { equals: entityQuery, mode: "insensitive" } },
          { title: { contains: entityQuery, mode: "insensitive" } },
          { aliases: { has: entityQuery } }
        ]
      },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 6
    });
    if (matches.length === 0) {
      return apiError(`Entity not found for "${entityQuery}"`, 404);
    }
    if (matches.length > 1) {
      const names = matches.map((m) => m.title).join(", ");
      return apiError(`Multiple entities match: ${names}. Please refine.`, 409);
    }
    data.entityId = matches[0].id;
  }
  const locationType = parseOptionalString(form.get("locationType"));
  if (locationType !== null) {
    const locationValue = locationType.trim().toLowerCase();
    data.locationType = (Object.values(LocationType) as string[]).includes(locationValue)
      ? (locationValue as LocationType)
      : LocationType.other;
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
  const markerShape = parseOptionalString(form.get("markerShape"));
  if (markerShape !== null) {
    const shapeValue = markerShape.trim().toLowerCase();
    data.markerShape = (Object.values(MarkerShape) as string[]).includes(shapeValue)
      ? (shapeValue as MarkerShape)
      : null;
  }
  const markerColor = parseOptionalString(form.get("markerColor"));
  if (markerColor !== null) data.markerColor = markerColor;
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
  const truthFlag = parseOptionalString(form.get("truthFlag"));
  if (truthFlag !== null) {
    const truthValue = truthFlag.trim().toLowerCase();
    data.truthFlag = (Object.values(TruthFlag) as string[]).includes(truthValue)
      ? (truthValue as TruthFlag)
      : TruthFlag.canonical;
  }

  if (layerId !== null) {
    const pin = await prisma.pin.findFirst({ where: { id: pinId, workspaceId } });
    if (!pin) {
      return apiError("Pin not found", 404);
    }
    if (layerId) {
      const layer = await prisma.mapLayer.findFirst({
        where: { id: layerId, workspaceId, mapId: pin.mapId, softDeletedAt: null }
      });
      if (!layer) {
        return apiError("Layer not found", 404);
      }
      data.layerId = layer.id;
    } else {
      data.layerId = null;
    }
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

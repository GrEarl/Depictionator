import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { parseOptionalString } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const sceneId = String(form.get("sceneId") ?? "");

  if (!workspaceId || !sceneId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const scene = await prisma.mapScene.findFirst({
    where: { id: sceneId, workspaceId }
  });
  if (!scene) {
    return apiError("Scene not found", 404);
  }

  const data: Record<string, unknown> = {};
  const name = parseOptionalString(form.get("name"));
  if (name !== null) data.name = name;
  const description = parseOptionalString(form.get("description"));
  if (description !== null) data.description = description;
  const chapterId = parseOptionalString(form.get("chapterId"));
  if (chapterId !== null) {
    if (chapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: chapterId, workspaceId, softDeletedAt: null }
      });
      if (!chapter) return apiError("Chapter not found", 404);
      data.chapterId = chapterId;
    } else {
      data.chapterId = null;
    }
  }
  const eraId = parseOptionalString(form.get("eraId"));
  if (eraId !== null) {
    if (eraId) {
      const era = await prisma.era.findFirst({
        where: { id: eraId, workspaceId, softDeletedAt: null }
      });
      if (!era) return apiError("Era not found", 404);
      data.eraId = eraId;
    } else {
      data.eraId = null;
    }
  }
  const viewpointId = parseOptionalString(form.get("viewpointId"));
  if (viewpointId !== null) {
    if (viewpointId) {
      const viewpoint = await prisma.viewpoint.findFirst({
        where: { id: viewpointId, workspaceId, softDeletedAt: null }
      });
      if (!viewpoint) return apiError("Viewpoint not found", 404);
      data.viewpointId = viewpointId;
    } else {
      data.viewpointId = null;
    }
  }
  const stateRaw = parseOptionalString(form.get("state"));
  if (stateRaw !== null) {
    if (stateRaw) {
      try {
        data.state = JSON.parse(stateRaw) as Prisma.InputJsonValue;
      } catch {
        return apiError("Invalid state JSON", 400);
      }
    } else {
      data.state = {} as Prisma.InputJsonValue;
    }
  }

  await prisma.mapScene.update({ where: { id: sceneId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "map_scene",
    targetId: sceneId,
    meta: { mapId: scene.mapId }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: scene.mapId,
    type: "map_scene_updated",
    payload: { mapSceneId: sceneId, mapId: scene.mapId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/maps"));
}

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
  const mapId = String(form.get("mapId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const description = parseOptionalString(form.get("description"));
  const chapterId = parseOptionalString(form.get("chapterId"));
  const eraId = parseOptionalString(form.get("eraId"));
  const viewpointId = parseOptionalString(form.get("viewpointId"));
  const stateRaw = parseOptionalString(form.get("state"));

  if (!workspaceId || !mapId || !name) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const map = await prisma.map.findFirst({
    where: { id: mapId, workspaceId, softDeletedAt: null }
  });
  if (!map) {
    return apiError("Map not found", 404);
  }

  if (chapterId) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, workspaceId, softDeletedAt: null }
    });
    if (!chapter) return apiError("Chapter not found", 404);
  }

  if (eraId) {
    const era = await prisma.era.findFirst({
      where: { id: eraId, workspaceId, softDeletedAt: null }
    });
    if (!era) return apiError("Era not found", 404);
  }

  if (viewpointId) {
    const viewpoint = await prisma.viewpoint.findFirst({
      where: { id: viewpointId, workspaceId, softDeletedAt: null }
    });
    if (!viewpoint) return apiError("Viewpoint not found", 404);
  }

  let state: Prisma.InputJsonValue = {};
  if (stateRaw) {
    try {
      state = JSON.parse(stateRaw) as Prisma.InputJsonValue;
    } catch {
      return apiError("Invalid state JSON", 400);
    }
  }

  const scene = await prisma.mapScene.create({
    data: {
      workspaceId,
      mapId,
      name,
      description: description || null,
      chapterId: chapterId || null,
      eraId: eraId || null,
      viewpointId: viewpointId || null,
      state
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "map_scene",
    targetId: scene.id,
    meta: { mapId }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: mapId,
    type: "map_scene_created",
    payload: { mapSceneId: scene.id, mapId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/maps"));
}

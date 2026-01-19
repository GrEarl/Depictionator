import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { TruthFlag } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { toWikiPath } from "@/lib/wiki";
import { getProtectionLevel } from "@/lib/protection";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const entityId = String(form.get("entityId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const truthValue = String(form.get("truthFlag") ?? "canonical")
    .trim()
    .toLowerCase();
  const truthFlag = (Object.values(TruthFlag) as string[]).includes(truthValue)
    ? (truthValue as TruthFlag)
    : TruthFlag.canonical;
  const viewpointId = String(form.get("viewpointId") ?? "");
  const worldFrom = String(form.get("worldFrom") ?? "").trim();
  const worldTo = String(form.get("worldTo") ?? "").trim();
  const storyFromChapterId = String(form.get("storyFromChapterId") ?? "").trim();
  const storyToChapterId = String(form.get("storyToChapterId") ?? "").trim();
  const bodyMd = String(form.get("bodyMd") ?? "");
  const changeSummary = String(form.get("changeSummary") ?? "Overlay draft");

  if (!workspaceId || !entityId || !title) {
    return apiError("Missing required fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "reviewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId, softDeletedAt: null }
  });
  if (!entity) {
    return apiError("Entity not found", 404);
  }

  const protection = getProtectionLevel(entity.tags ?? []);
  if (protection === "admin") {
    try {
      await requireWorkspaceAccess(session.userId, workspaceId, "admin");
    } catch {
      return apiError("Forbidden", 403);
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

  const overlay = await prisma.articleOverlay.create({
    data: {
      workspaceId,
      entityId,
      viewpointId: viewpointId || null,
      title,
      truthFlag,
      worldFrom: worldFrom || null,
      worldTo: worldTo || null,
      storyFromChapterId: storyFromChapterId || null,
      storyToChapterId: storyToChapterId || null
    }
  });

  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType: "overlay",
      overlayId: overlay.id,
      bodyMd,
      changeSummary,
      createdById: session.userId,
      status: "draft"
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "overlay",
    targetId: overlay.id,
    meta: { entityId }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "revision",
    targetId: revision.id,
    meta: { targetType: "overlay" }
  });

  return NextResponse.redirect(toRedirectUrl(request, toWikiPath(entity.title)));
}

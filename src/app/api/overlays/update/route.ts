import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { TruthFlag } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
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
  const overlayId = String(form.get("overlayId") ?? "");

  if (!workspaceId || !overlayId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "reviewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const overlay = await prisma.articleOverlay.findFirst({
    where: { id: overlayId, workspaceId }
  });
  if (!overlay) {
    return apiError("Overlay not found", 404);
  }

  const data: Record<string, unknown> = {};
  const title = parseOptionalString(form.get("title"));
  if (title !== null) data.title = title;
  const truthFlag = parseOptionalString(form.get("truthFlag"));
  if (truthFlag !== null) {
    const truthValue = truthFlag.trim().toLowerCase();
    data.truthFlag = (Object.values(TruthFlag) as string[]).includes(truthValue)
      ? (truthValue as TruthFlag)
      : TruthFlag.canonical;
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
  const worldFrom = parseOptionalString(form.get("worldFrom"));
  if (worldFrom !== null) data.worldFrom = worldFrom;
  const worldTo = parseOptionalString(form.get("worldTo"));
  if (worldTo !== null) data.worldTo = worldTo;
  const storyFromChapterId = parseOptionalString(form.get("storyFromChapterId"));
  if (storyFromChapterId !== null) {
    if (storyFromChapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: storyFromChapterId, workspaceId, softDeletedAt: null }
      });
      if (!chapter) return apiError("Story chapter not found", 404);
      data.storyFromChapterId = storyFromChapterId;
    } else {
      data.storyFromChapterId = null;
    }
  }
  const storyToChapterId = parseOptionalString(form.get("storyToChapterId"));
  if (storyToChapterId !== null) {
    if (storyToChapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: storyToChapterId, workspaceId, softDeletedAt: null }
      });
      if (!chapter) return apiError("Story chapter not found", 404);
      data.storyToChapterId = storyToChapterId;
    } else {
      data.storyToChapterId = null;
    }
  }

  await prisma.articleOverlay.update({
    where: { id: overlayId, workspaceId },
    data
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "overlay",
    targetId: overlayId
  });

  return NextResponse.redirect(toRedirectUrl(request, "/articles/" + overlay.entityId));
}

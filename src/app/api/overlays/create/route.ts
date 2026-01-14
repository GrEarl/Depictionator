import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TruthFlag } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

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

  return NextResponse.redirect(new URL(`/articles/${entityId}`, request.url));
}

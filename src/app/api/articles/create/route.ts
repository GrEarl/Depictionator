import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { EntityType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { parseCsv, parseOptionalString } from "@/lib/forms";
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
  const typeValue = String(form.get("type") ?? "concept").trim().toLowerCase();
  const type = (Object.values(EntityType) as string[]).includes(typeValue)
    ? (typeValue as EntityType)
    : EntityType.concept;
  const title = String(form.get("title") ?? "").trim();
  const bodyMd = String(form.get("bodyMd") ?? "").trim();
  const changeSummary = String(form.get("changeSummary") ?? "Initial draft").trim();
  const storyIntroChapterId = parseOptionalString(form.get("storyIntroChapterId"));

  if (!workspaceId || !title) {
    return apiError("Missing required fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  if (storyIntroChapterId) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: storyIntroChapterId, workspaceId, softDeletedAt: null }
    });
    if (!chapter) {
      return apiError("Story chapter not found", 404);
    }
  }

  const entity = await prisma.entity.create({
    data: {
      workspaceId,
      type,
      title,
      aliases: parseCsv(form.get("aliases")),
      tags: parseCsv(form.get("tags")),
      status: "draft",
      worldExistFrom: parseOptionalString(form.get("worldExistFrom")),
      worldExistTo: parseOptionalString(form.get("worldExistTo")),
      storyIntroChapterId: storyIntroChapterId || null,
      createdById: session.userId,
      updatedById: session.userId
    }
  });

  const article = await prisma.article.create({
    data: {
      entityId: entity.id,
      workspaceId
    }
  });

  const now = new Date();
  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType: "base",
      articleId: article.entityId,
      bodyMd: bodyMd || "",
      changeSummary,
      createdById: session.userId,
      status: "approved",
      approvedAt: now,
      approvedById: session.userId
    }
  });

  await prisma.article.update({
    where: { entityId: article.entityId },
    data: { baseRevisionId: revision.id }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "entity",
    targetId: entity.id,
    meta: { title, type }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "revision",
    targetId: revision.id,
    meta: { targetType: "base" }
  });

  return NextResponse.redirect(toRedirectUrl(request, `/articles/${entity.id}`));
}



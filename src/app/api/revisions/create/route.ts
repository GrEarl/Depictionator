import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { toWikiPath } from "@/lib/wiki";
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
  const targetType = String(form.get("targetType") ?? "base") as "base" | "overlay";
  const articleId = String(form.get("articleId") ?? "");
  const overlayId = String(form.get("overlayId") ?? "");
  const bodyMd = String(form.get("bodyMd") ?? "");
  const changeSummary = String(form.get("changeSummary") ?? "Update");
  const wikiCategories = parseCsv(form.get("wikiCategories"));
  const wikiTemplates = parseCsv(form.get("wikiTemplates"));
  const hasWikiMeta = form.has("wikiCategories") || form.has("wikiTemplates");

  if (!workspaceId || (targetType === "base" && !articleId) || (targetType === "overlay" && !overlayId)) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(
      session.userId,
      workspaceId,
      targetType === "overlay" ? "reviewer" : "editor"
    );
  } catch {
    return apiError("Forbidden", 403);
  }

  const isBase = targetType === "base";
  let parentRevisionId: string | null = null;
  let overlayEntityId: string | null = null;

  if (isBase) {
    const article = await prisma.article.findFirst({
      where: { entityId: articleId, workspaceId },
      select: { baseRevisionId: true }
    });
    if (!article) {
      return apiError("Article not found", 404);
    }
    parentRevisionId = article.baseRevisionId ?? null;
  } else {
    const overlay = await prisma.articleOverlay.findFirst({
      where: { id: overlayId, workspaceId, softDeletedAt: null },
      select: { entityId: true, activeRevisionId: true }
    });
    if (!overlay) {
      return apiError("Overlay not found", 404);
    }
    overlayEntityId = overlay.entityId;
    parentRevisionId = overlay.activeRevisionId ?? null;
  }

  const now = new Date();
  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType,
      articleId: isBase ? articleId : null,
      overlayId: isBase ? null : overlayId,
      bodyMd,
      changeSummary,
      createdById: session.userId,
      status: isBase ? "approved" : "draft",
      approvedAt: isBase ? now : null,
      approvedById: isBase ? session.userId : null,
      parentRevisionId
    }
  });

  if (isBase) {
    await prisma.article.update({
      where: { entityId: articleId },
      data: { baseRevisionId: revision.id }
    });

    if (hasWikiMeta) {
      const entity = await prisma.entity.findFirst({
        where: { id: articleId, workspaceId },
        select: { tags: true }
      });
      if (entity) {
        const existingTags = entity.tags ?? [];
        const filtered = existingTags.filter((tag) => !tag.startsWith("category:") && !tag.startsWith("template:"));
        const categoryTags = wikiCategories.map((c) => `category:${c}`);
        const templateTags = wikiTemplates.map((t) => `template:${t}`);
        const nextTags = Array.from(new Set([...filtered, ...categoryTags, ...templateTags]));
        await prisma.entity.update({
          where: { id: articleId, workspaceId },
          data: { tags: { set: nextTags }, updatedById: session.userId }
        });
      }
    }

    await notifyWatchers({
      workspaceId,
      targetType: "entity",
      targetId: articleId,
      type: "article_updated",
      payload: { revisionId: revision.id }
    });
  }

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "revision",
    targetId: revision.id,
    meta: { targetType }
  });

  const redirectEntityId = isBase ? articleId : overlayEntityId ?? null;
  if (redirectEntityId) {
    const entity = await prisma.entity.findFirst({
      where: { id: redirectEntityId, workspaceId }
    });
    if (entity) {
      return NextResponse.redirect(toRedirectUrl(request, toWikiPath(entity.title)));
    }
  }

  return NextResponse.redirect(toRedirectUrl(request, "/articles"));
}

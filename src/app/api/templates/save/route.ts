import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { toRedirectUrl } from "@/lib/redirect";
import { toWikiPath } from "@/lib/wiki";
import { logAudit } from "@/lib/audit";

type Payload = {
  workspaceId?: string;
  name?: string;
  bodyMd?: string;
  changeSummary?: string;
};

function normalizeName(value?: string) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  let payload: Payload | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  if (!payload) {
    const form = await request.formData();
    payload = {
      workspaceId: String(form.get("workspaceId") ?? ""),
      name: String(form.get("name") ?? ""),
      bodyMd: String(form.get("bodyMd") ?? ""),
      changeSummary: String(form.get("changeSummary") ?? "")
    };
  }

  const workspaceId = normalizeName(payload.workspaceId);
  const rawName = normalizeName(payload.name);
  const bodyMd = String(payload.bodyMd ?? "");
  const changeSummary = normalizeName(payload.changeSummary) || "Update template";

  const baseName = rawName.replace(/^Template:/i, "").trim();
  if (!workspaceId || !baseName) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const title = `Template:${baseName}`;
  const templateTag = `template:${baseName}`;

  const existing = await prisma.entity.findFirst({
    where: {
      workspaceId,
      softDeletedAt: null,
      title: { equals: title, mode: "insensitive" }
    },
    include: { article: true }
  });

  let entityId = existing?.id;
  let articleId = existing?.article?.entityId;
  let parentRevisionId: string | null = null;

  if (!existing) {
    const created = await prisma.entity.create({
      data: {
        workspaceId,
        type: "concept",
        title,
        aliases: [],
        tags: [templateTag],
        status: "draft",
        createdById: session.userId,
        updatedById: session.userId
      }
    });
    entityId = created.id;
    const article = await prisma.article.create({
      data: {
        entityId: created.id,
        workspaceId
      }
    });
    articleId = article.entityId;

    await logAudit({
      workspaceId,
      actorUserId: session.userId,
      action: "create",
      targetType: "entity",
      targetId: created.id,
      meta: { title, type: "template" }
    });
  } else {
    parentRevisionId = existing.article?.baseRevisionId ?? null;
    const tags = Array.from(new Set([...(existing.tags ?? []), templateTag]));
    await prisma.entity.update({
      where: { id: existing.id },
      data: { tags, updatedById: session.userId }
    });
  }

  if (!articleId && entityId) {
    const article = await prisma.article.create({
      data: {
        entityId,
        workspaceId
      }
    });
    articleId = article.entityId;
  }

  if (!articleId) {
    return apiError("Article not found", 404);
  }

  const now = new Date();
  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType: "base",
      articleId,
      bodyMd,
      changeSummary,
      createdById: session.userId,
      status: "approved",
      approvedAt: now,
      approvedById: session.userId,
      parentRevisionId
    }
  });

  await prisma.article.update({
    where: { entityId: articleId },
    data: { baseRevisionId: revision.id }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "revision",
    targetId: revision.id,
    meta: { targetType: "base", template: title }
  });

  return NextResponse.redirect(
    toRedirectUrl(request, `/templates/${encodeURIComponent(baseName)}`)
  );
}

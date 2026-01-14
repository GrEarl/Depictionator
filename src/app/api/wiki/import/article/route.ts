import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EntityType, SourceTargetType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { buildWikiAttribution, fetchWikiPage } from "@/lib/wiki";
import { toRedirectUrl } from "@/lib/redirect";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();
  const lang = String(form.get("lang") ?? "").trim();
  const pageId = String(form.get("pageId") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const typeValue = String(form.get("entityType") ?? "concept").trim().toLowerCase();
  const publish = String(form.get("publish") ?? "false") === "true";

  if (!workspaceId || (!pageId && !title)) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const page = await fetchWikiPage(lang || null, { pageId, title });
  if (!page) return apiError("Page not found", 404);

  const type = (Object.values(EntityType) as string[]).includes(typeValue)
    ? (typeValue as EntityType)
    : EntityType.concept;

  const entity = await prisma.entity.create({
    data: {
      workspaceId,
      type,
      title: page.title,
      aliases: [],
      tags: ["imported", "wikipedia"],
      status: "draft",
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

  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType: "base",
      articleId: article.entityId,
      bodyMd: page.extract || page.wikitext || "",
      changeSummary: `Imported from Wikipedia (${page.url})`,
      createdById: session.userId,
      status: publish ? "approved" : "draft",
      approvedAt: publish ? new Date() : null,
      approvedById: publish ? session.userId : null
    }
  });

  if (publish) {
    await prisma.article.update({
      where: { entityId: entity.id },
      data: { baseRevisionId: revision.id }
    });
  }

  const attribution = buildWikiAttribution(page.title, page.url);
  await prisma.sourceRecord.create({
    data: {
      workspaceId,
      targetType: SourceTargetType.article_revision,
      targetId: revision.id,
      sourceUrl: page.url,
      title: page.title,
      author: attribution.author,
      licenseId: attribution.licenseId,
      licenseUrl: attribution.licenseUrl,
      attributionText: attribution.attributionText,
      retrievedAt: new Date(),
      createdById: session.userId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "import",
    targetType: "entity",
    targetId: entity.id,
    meta: { source: "wikipedia", url: page.url }
  });

  return NextResponse.redirect(toRedirectUrl(request, `/articles/${entity.id}`));
}

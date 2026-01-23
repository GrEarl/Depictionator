import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
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
  const articleId = String(form.get("articleId") ?? "");
  const bodyMd = String(form.get("bodyMd") ?? "");
  const changeSummary = String(form.get("changeSummary") ?? "LLM draft").trim();

  if (!workspaceId || !articleId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const entity = await prisma.entity.findFirst({
    where: { id: articleId, workspaceId },
    select: { tags: true }
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

  const article = await prisma.article.findFirst({
    where: { entityId: articleId, workspaceId },
    select: { baseRevisionId: true }
  });

  if (!article) {
    return apiError("Article not found", 404);
  }

  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType: "base",
      articleId,
      bodyMd,
      changeSummary: changeSummary || "LLM draft",
      createdById: session.userId,
      status: "draft",
      parentRevisionId: article.baseRevisionId ?? null
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create_draft",
    targetType: "revision",
    targetId: revision.id,
    meta: { source: "llm" }
  });

  return NextResponse.json({ ok: true, revisionId: revision.id });
}

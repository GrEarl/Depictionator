import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
  const type = String(form.get("type") ?? "concept");
  const title = String(form.get("title") ?? "").trim();
  const bodyMd = String(form.get("bodyMd") ?? "").trim();
  const changeSummary = String(form.get("changeSummary") ?? "Initial draft").trim();

  if (!workspaceId || !title) {
    return apiError("Missing required fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
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
      bodyMd: bodyMd || "",
      changeSummary,
      createdById: session.userId,
      status: "draft"
    }
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

  return NextResponse.redirect(new URL(`/articles/${entity.id}`, request.url));
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
  const targetType = String(form.get("targetType") ?? "base") as "base" | "overlay";
  const articleId = String(form.get("articleId") ?? "");
  const overlayId = String(form.get("overlayId") ?? "");
  const bodyMd = String(form.get("bodyMd") ?? "");
  const changeSummary = String(form.get("changeSummary") ?? "Update");

  if (!workspaceId || (targetType === "base" && !articleId) || (targetType === "overlay" && !overlayId)) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType,
      articleId: targetType === "base" ? articleId : null,
      overlayId: targetType === "overlay" ? overlayId : null,
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
    targetType: "revision",
    targetId: revision.id,
    meta: { targetType }
  });

  return NextResponse.redirect(new URL(`/app/articles/${articleId || overlayId}`, request.url));
}

import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
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
  const revisionId = String(form.get("revisionId") ?? "");

  if (!workspaceId || !revisionId) {
    return apiError("Missing fields", 400);
  }

  const revision = await prisma.articleRevision.findFirst({
    where: { id: revisionId, workspaceId }
  });

  if (!revision) {
    return apiError("Revision not found", 404);
  }

  try {
    await requireWorkspaceAccess(
      session.userId,
      workspaceId,
      revision.targetType === "overlay" ? "reviewer" : "editor"
    );
  } catch {
    return apiError("Forbidden", 403);
  }

  const restored = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType: revision.targetType,
      articleId: revision.articleId,
      overlayId: revision.overlayId,
      bodyMd: revision.bodyMd,
      changeSummary: `Restore from ${revisionId}`,
      createdById: session.userId,
      status: "draft",
      parentRevisionId: revision.id
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "restore_revision",
    targetType: "revision",
    targetId: restored.id,
    meta: { from: revisionId }
  });

  return NextResponse.redirect(toRedirectUrl(request, `/revisions/${restored.id}`));
}



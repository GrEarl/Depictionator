import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { toWikiPath } from "@/lib/wiki";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const threadId = String(form.get("threadId") ?? "");
  const bodyMd = String(form.get("bodyMd") ?? "").trim();

  if (!workspaceId || !threadId || !bodyMd) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const thread = await prisma.talkThread.findFirst({
    where: { id: threadId, workspaceId, softDeletedAt: null },
    include: { entity: { select: { title: true } } }
  });

  if (!thread) {
    return apiError("Thread not found", 404);
  }

  const comment = await prisma.talkComment.create({
    data: {
      workspaceId,
      threadId,
      bodyMd,
      createdById: session.userId
    }
  });

  await prisma.talkThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "talk_comment",
    targetId: comment.id,
    meta: { threadId }
  });

  return NextResponse.redirect(toRedirectUrl(request, toWikiPath(`Talk:${thread.entity.title}`)));
}

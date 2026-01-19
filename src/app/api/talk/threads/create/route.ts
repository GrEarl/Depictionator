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
  const entityId = String(form.get("entityId") ?? "");
  const title = String(form.get("title") ?? "Discussion").trim() || "Discussion";
  const bodyMd = String(form.get("bodyMd") ?? "").trim();

  if (!workspaceId || !entityId || !bodyMd) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId, softDeletedAt: null },
    select: { title: true }
  });

  if (!entity) {
    return apiError("Entity not found", 404);
  }

  const thread = await prisma.talkThread.create({
    data: {
      workspaceId,
      entityId,
      title,
      createdById: session.userId
    }
  });

  await prisma.talkComment.create({
    data: {
      workspaceId,
      threadId: thread.id,
      bodyMd,
      createdById: session.userId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "talk_thread",
    targetId: thread.id,
    meta: { entityId }
  });

  return NextResponse.redirect(toRedirectUrl(request, toWikiPath(`Talk:${entity.title}`)));
}

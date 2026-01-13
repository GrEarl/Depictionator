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
  const entityId = String(form.get("entityId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const status = String(form.get("status") ?? "draft");

  if (!workspaceId || !entityId || !title) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const entity = await prisma.entity.update({
    where: { id: entityId, workspaceId },
    data: {
      title,
      status,
      aliases: parseCsv(form.get("aliases")),
      tags: parseCsv(form.get("tags")),
      worldExistFrom: parseOptionalString(form.get("worldExistFrom")),
      worldExistTo: parseOptionalString(form.get("worldExistTo")),
      storyIntroChapterId: parseOptionalString(form.get("storyIntroChapterId")),
      updatedById: session.userId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "entity",
    targetId: entity.id
  });

  return NextResponse.redirect(new URL(`/app/articles/${entity.id}`, request.url));
}

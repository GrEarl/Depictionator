import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { EntityStatus } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { parseCsv, parseOptionalString } from "@/lib/forms";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { toWikiPath } from "@/lib/wiki";
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
  const entityId = String(form.get("entityId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const statusValue = String(form.get("status") ?? "draft").trim().toLowerCase();
  const status = (Object.values(EntityStatus) as string[]).includes(statusValue)
    ? (statusValue as EntityStatus)
    : EntityStatus.draft;

  if (!workspaceId || !entityId || !title) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const existing = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
    select: { tags: true }
  });

  if (!existing) {
    return apiError("Entity not found", 404);
  }

  const protection = getProtectionLevel(existing.tags ?? []);
  if (protection === "admin") {
    try {
      await requireWorkspaceAccess(session.userId, workspaceId, "admin");
    } catch {
      return apiError("Forbidden", 403);
    }
  }

  const nextTagsInput = parseCsv(form.get("tags")).filter((tag) => !tag.startsWith("protected:"));
  const existingProtected = (existing.tags ?? []).filter((tag) => tag.startsWith("protected:"));
  const nextTags = Array.from(new Set([...nextTagsInput, ...existingProtected]));

  const storyIntroChapterId = parseOptionalString(form.get("storyIntroChapterId"));
  if (storyIntroChapterId) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: storyIntroChapterId, workspaceId, softDeletedAt: null }
    });
    if (!chapter) {
      return apiError("Story chapter not found", 404);
    }
  }

  const entity = await prisma.entity.update({
    where: { id: entityId, workspaceId },
    data: {
      title,
      status,
      aliases: parseCsv(form.get("aliases")),
      tags: nextTags,
      worldExistFrom: parseOptionalString(form.get("worldExistFrom")),
      worldExistTo: parseOptionalString(form.get("worldExistTo")),
      storyIntroChapterId,
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

  await notifyWatchers({
    workspaceId,
    targetType: "entity",
    targetId: entity.id,
    type: "entity_updated",
    payload: { entityId: entity.id }
  });

  return NextResponse.redirect(toRedirectUrl(request, toWikiPath(entity.title)));
}

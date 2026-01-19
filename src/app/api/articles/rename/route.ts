import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
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
  const title = String(form.get("title") ?? "").trim();
  const addRedirect = String(form.get("addRedirect") ?? "true") !== "false";

  if (!workspaceId || !entityId || !title) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId }
  });

  if (!entity) {
    return apiError("Entity not found", 404);
  }

  const existing = await prisma.entity.findFirst({
    where: {
      workspaceId,
      id: { not: entityId },
      title: { equals: title, mode: "insensitive" }
    }
  });

  if (existing) {
    return apiError("Title already exists", 409);
  }

  const nextAliases = addRedirect
    ? Array.from(new Set([...(entity.aliases ?? []), entity.title])).filter(Boolean)
    : entity.aliases ?? [];

  await prisma.entity.update({
    where: { id: entityId, workspaceId },
    data: {
      title,
      aliases: { set: nextAliases },
      updatedById: session.userId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "rename",
    targetType: "entity",
    targetId: entityId,
    meta: { from: entity.title, to: title }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "entity",
    targetId: entityId,
    type: "entity_renamed",
    payload: { entityId, from: entity.title, to: title }
  });

  return NextResponse.redirect(toRedirectUrl(request, toWikiPath(title)));
}

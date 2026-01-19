import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { toWikiPath } from "@/lib/wiki";
import { applyProtection, type ProtectionLevel } from "@/lib/protection";

const ALLOWED_LEVELS = new Set<ProtectionLevel>(["none", "editor", "admin"]);

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
  const levelInput = String(form.get("level") ?? "none").trim().toLowerCase();
  const level = ALLOWED_LEVELS.has(levelInput as ProtectionLevel)
    ? (levelInput as ProtectionLevel)
    : "none";

  if (!workspaceId || !entityId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "admin");
  } catch {
    return apiError("Forbidden", 403);
  }

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
    select: { tags: true, title: true }
  });

  if (!entity) {
    return apiError("Entity not found", 404);
  }

  const nextTags = applyProtection(entity.tags ?? [], level);
  await prisma.entity.update({
    where: { id: entityId, workspaceId },
    data: { tags: { set: nextTags }, updatedById: session.userId }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "protect",
    targetType: "entity",
    targetId: entityId,
    meta: { level }
  });

  return NextResponse.redirect(toRedirectUrl(request, toWikiPath(entity.title)));
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";
import { logAudit } from "@/lib/audit";

type TargetType =
  | "entity"
  | "overlay"
  | "map"
  | "pin"
  | "path"
  | "event"
  | "timeline"
  | "era"
  | "chapter"
  | "marker_style"
  | "viewpoint"
  | "asset";

async function softUpdate(targetType: TargetType, workspaceId: string, id: string, archived: boolean) {
  const payload = { softDeletedAt: archived ? new Date() : null };
  switch (targetType) {
    case "entity":
      return prisma.entity.update({ where: { id, workspaceId }, data: payload });
    case "overlay":
      return prisma.articleOverlay.update({ where: { id, workspaceId }, data: payload });
    case "map":
      return prisma.map.update({ where: { id, workspaceId }, data: payload });
    case "pin":
      return prisma.pin.update({ where: { id, workspaceId }, data: payload });
    case "path":
      return prisma.path.update({ where: { id, workspaceId }, data: payload });
    case "event":
      return prisma.event.update({ where: { id, workspaceId }, data: payload });
    case "timeline":
      return prisma.timeline.update({ where: { id, workspaceId }, data: payload });
    case "era":
      return prisma.era.update({ where: { id, workspaceId }, data: payload });
    case "chapter":
      return prisma.chapter.update({ where: { id, workspaceId }, data: payload });
    case "marker_style":
      return prisma.markerStyle.update({ where: { id, workspaceId }, data: payload });
    case "viewpoint":
      return prisma.viewpoint.update({ where: { id, workspaceId }, data: payload });
    case "asset":
      return prisma.asset.update({ where: { id, workspaceId }, data: payload });
    default:
      throw new Error("Unsupported target");
  }
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const targetType = String(form.get("targetType") ?? "") as TargetType;
  const targetId = String(form.get("targetId") ?? "");

  if (!workspaceId || !targetType || !targetId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  await softUpdate(targetType, workspaceId, targetId, false);

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "restore",
    targetType,
    targetId
  });

  return NextResponse.redirect(new URL(request.headers.get("referer") ?? "/", request.url));
}

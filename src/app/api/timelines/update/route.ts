import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { TimelineType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { parseOptionalString } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const timelineId = String(form.get("timelineId") ?? "");

  if (!workspaceId || !timelineId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const data: Record<string, unknown> = {};
  const name = parseOptionalString(form.get("name"));
  if (name !== null) data.name = name;
  const type = parseOptionalString(form.get("type"));
  if (type !== null) {
    const typeValue = type.trim().toLowerCase();
    data.type = (Object.values(TimelineType) as string[]).includes(typeValue)
      ? (typeValue as TimelineType)
      : TimelineType.world_history;
  }

  await prisma.timeline.update({ where: { id: timelineId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "timeline",
    targetId: timelineId
  });

  await notifyWatchers({
    workspaceId,
    targetType: "timeline",
    targetId: timelineId,
    type: "timeline_updated",
    payload: { timelineId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/timeline"));
}



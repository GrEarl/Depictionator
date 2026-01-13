import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
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
  if (type !== null) data.type = type;

  await prisma.timeline.update({ where: { id: timelineId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "timeline",
    targetId: timelineId
  });

  return NextResponse.redirect(new URL("/app/timeline", request.url));
}

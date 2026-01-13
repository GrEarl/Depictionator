import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { parseOptionalInt, parseOptionalString } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const chapterId = String(form.get("chapterId") ?? "");

  if (!workspaceId || !chapterId) {
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
  const orderIndex = parseOptionalInt(form.get("orderIndex"));
  if (orderIndex !== null) data.orderIndex = orderIndex;
  const description = parseOptionalString(form.get("description"));
  if (description !== null) data.description = description;

  await prisma.chapter.update({ where: { id: chapterId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "chapter",
    targetId: chapterId
  });

  return NextResponse.redirect(new URL("/app/timeline", request.url));
}

import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
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
  const boardId = String(form.get("boardId") ?? "");

  if (!workspaceId || !boardId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const board = await prisma.evidenceBoard.findFirst({
    where: { id: boardId, workspaceId }
  });
  if (!board) {
    return apiError("Board not found", 404);
  }

  const data: Record<string, unknown> = {};
  const name = parseOptionalString(form.get("name"));
  if (name !== null) data.name = name;
  const description = parseOptionalString(form.get("description"));
  if (description !== null) data.description = description;

  await prisma.evidenceBoard.update({ where: { id: boardId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "evidence_board",
    targetId: boardId
  });

  return NextResponse.redirect(toRedirectUrl(request, "/"));
}

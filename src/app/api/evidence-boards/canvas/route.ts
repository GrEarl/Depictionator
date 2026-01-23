import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

type CanvasPayload = {
  workspaceId?: string;
  boardId?: string;
  canvasState?: unknown;
  autosave?: boolean;
};

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  let payload: CanvasPayload;
  try {
    payload = (await request.json()) as CanvasPayload;
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const workspaceId = String(payload.workspaceId ?? "");
  const boardId = String(payload.boardId ?? "");
  const autosave = Boolean(payload.autosave);

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

  await prisma.evidenceBoard.update({
    where: { id: boardId, workspaceId },
    data: { canvasState: payload.canvasState ?? null }
  });

  if (!autosave) {
    await logAudit({
      workspaceId,
      actorUserId: session.userId,
      action: "update_canvas",
      targetType: "evidence_board",
      targetId: boardId
    });
  }

  return NextResponse.json({ ok: true });
}

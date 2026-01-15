import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { EvidenceLinkStyle, Prisma } from "@prisma/client";
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
  const boardId = String(form.get("boardId") ?? "");
  const fromItemId = String(form.get("fromItemId") ?? "");
  const toItemId = String(form.get("toItemId") ?? "");
  const label = String(form.get("label") ?? "").trim();
  const styleRaw = String(form.get("style") ?? "line").trim().toLowerCase();
  const style = (Object.values(EvidenceLinkStyle) as string[]).includes(styleRaw)
    ? (styleRaw as EvidenceLinkStyle)
    : EvidenceLinkStyle.line;
  const dataRaw = parseOptionalString(form.get("data"));

  if (!workspaceId || !boardId || !fromItemId || !toItemId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const board = await prisma.evidenceBoard.findFirst({
    where: { id: boardId, workspaceId, softDeletedAt: null }
  });
  if (!board) {
    return apiError("Board not found", 404);
  }

  const fromItem = await prisma.evidenceItem.findFirst({
    where: { id: fromItemId, workspaceId, softDeletedAt: null }
  });
  const toItem = await prisma.evidenceItem.findFirst({
    where: { id: toItemId, workspaceId, softDeletedAt: null }
  });
  if (!fromItem || !toItem || fromItem.boardId !== boardId || toItem.boardId !== boardId) {
    return apiError("Evidence items not found", 404);
  }

  let data: Prisma.InputJsonValue | undefined;
  if (dataRaw) {
    try {
      data = JSON.parse(dataRaw) as Prisma.InputJsonValue;
    } catch {
      return apiError("Invalid data JSON", 400);
    }
  }

  const link = await prisma.evidenceLink.create({
    data: {
      workspaceId,
      boardId,
      fromItemId,
      toItemId,
      label: label || null,
      style,
      data: data ?? undefined
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "evidence_link",
    targetId: link.id,
    meta: { boardId }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "evidence_board",
    targetId: boardId,
    type: "evidence_link_created",
    payload: { evidenceLinkId: link.id, boardId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/"));
}

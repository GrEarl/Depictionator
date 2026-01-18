import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = String(searchParams.get("workspaceId") ?? "").trim();
  const boardId = String(searchParams.get("boardId") ?? "").trim();

  if (!boardId) return apiError("Missing board", 400);

  const board = await prisma.evidenceBoard.findFirst({
    where: { id: boardId, softDeletedAt: null },
    include: {
      items: { where: { softDeletedAt: null } },
      links: { where: { softDeletedAt: null } }
    }
  });

  if (!board) return apiError("Board not found", 404);

  const resolvedWorkspaceId = workspaceId || board.workspaceId;
  if (board.workspaceId !== resolvedWorkspaceId) {
    return apiError("Board workspace mismatch", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, resolvedWorkspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const payload = {
    meta: {
      version: "1",
      exportedAt: new Date().toISOString(),
      boardId: board.id
    },
    board: {
      name: board.name,
      description: board.description ?? undefined
    },
    items: board.items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title ?? undefined,
      content: item.content ?? undefined,
      url: item.url ?? undefined,
      entityId: item.entityId ?? undefined,
      assetId: item.assetId ?? undefined,
      referenceId: item.referenceId ?? undefined,
      x: item.x,
      y: item.y,
      width: item.width ?? undefined,
      height: item.height ?? undefined,
      rotation: item.rotation ?? undefined,
      zIndex: item.zIndex ?? undefined,
      data: item.data ?? undefined
    })),
    links: board.links.map((link) => ({
      from: link.fromItemId,
      to: link.toItemId,
      label: link.label ?? undefined,
      style: link.style,
      data: link.data ?? undefined
    }))
  };

  await logAudit({
    workspaceId: resolvedWorkspaceId,
    actorUserId: session.userId,
    action: "export",
    targetType: "evidence_board",
    targetId: board.id
  });

  const filename = `board-${board.id}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`
    }
  });
}

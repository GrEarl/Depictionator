import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { EvidenceItemType, Prisma } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { parseOptionalFloat, parseOptionalInt, parseOptionalString } from "@/lib/forms";

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
  const typeValue = String(form.get("type") ?? "note").trim().toLowerCase();
  const type = (Object.values(EvidenceItemType) as string[]).includes(typeValue)
    ? (typeValue as EvidenceItemType)
    : EvidenceItemType.note;
  const title = String(form.get("title") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const entityId = String(form.get("entityId") ?? "").trim();
  const assetId = String(form.get("assetId") ?? "").trim();
  const referenceId = String(form.get("referenceId") ?? "").trim();
  const x = parseOptionalFloat(form.get("x"));
  const y = parseOptionalFloat(form.get("y"));
  const width = parseOptionalFloat(form.get("width"));
  const height = parseOptionalFloat(form.get("height"));
  const rotation = parseOptionalFloat(form.get("rotation"));
  const zIndex = parseOptionalInt(form.get("zIndex"));
  const dataRaw = parseOptionalString(form.get("data"));

  if (!workspaceId || !boardId || x === null || y === null) {
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

  if (type === EvidenceItemType.entity && !entityId) {
    return apiError("Entity is required for entity items", 400);
  }
  if (type === EvidenceItemType.asset && !assetId) {
    return apiError("Asset is required for asset items", 400);
  }
  if (type === EvidenceItemType.reference && !referenceId) {
    return apiError("Reference is required for reference items", 400);
  }
  if (type === EvidenceItemType.url && !url) {
    return apiError("URL is required for url items", 400);
  }

  if (entityId) {
    const entity = await prisma.entity.findFirst({
      where: { id: entityId, workspaceId, softDeletedAt: null }
    });
    if (!entity) return apiError("Entity not found", 404);
  }
  if (assetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, workspaceId, softDeletedAt: null }
    });
    if (!asset) return apiError("Asset not found", 404);
  }
  if (referenceId) {
    const reference = await prisma.reference.findFirst({
      where: { id: referenceId, workspaceId, softDeletedAt: null }
    });
    if (!reference) return apiError("Reference not found", 404);
  }

  let data: Prisma.InputJsonValue | undefined;
  if (dataRaw) {
    try {
      data = JSON.parse(dataRaw) as Prisma.InputJsonValue;
    } catch {
      return apiError("Invalid data JSON", 400);
    }
  }

  const item = await prisma.evidenceItem.create({
    data: {
      workspaceId,
      boardId,
      type,
      title: title || null,
      content: content || null,
      url: url || null,
      entityId: entityId || null,
      assetId: assetId || null,
      referenceId: referenceId || null,
      x,
      y,
      width: width ?? null,
      height: height ?? null,
      rotation: rotation ?? null,
      zIndex: zIndex ?? null,
      data: data ?? undefined
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "evidence_item",
    targetId: item.id,
    meta: { boardId }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "evidence_board",
    targetId: boardId,
    type: "evidence_item_created",
    payload: { evidenceItemId: item.id, boardId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/"));
}

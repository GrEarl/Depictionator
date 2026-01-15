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
  const itemId = String(form.get("itemId") ?? "");

  if (!workspaceId || !itemId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const item = await prisma.evidenceItem.findFirst({
    where: { id: itemId, workspaceId }
  });
  if (!item) {
    return apiError("Evidence item not found", 404);
  }

  const data: Record<string, unknown> = {};
  const typeRaw = parseOptionalString(form.get("type"));
  const type = typeRaw
    ? ((Object.values(EvidenceItemType) as string[]).includes(typeRaw.trim().toLowerCase())
        ? (typeRaw.trim().toLowerCase() as EvidenceItemType)
        : null)
    : null;
  if (typeRaw && !type) {
    return apiError("Invalid item type", 400);
  }
  if (type) data.type = type;

  const title = parseOptionalString(form.get("title"));
  if (title !== null) data.title = title;
  const content = parseOptionalString(form.get("content"));
  if (content !== null) data.content = content;
  const url = parseOptionalString(form.get("url"));
  if (url !== null) data.url = url;
  const entityId = parseOptionalString(form.get("entityId"));
  if (entityId !== null) data.entityId = entityId;
  const assetId = parseOptionalString(form.get("assetId"));
  if (assetId !== null) data.assetId = assetId;
  const referenceId = parseOptionalString(form.get("referenceId"));
  if (referenceId !== null) data.referenceId = referenceId;

  const x = parseOptionalFloat(form.get("x"));
  if (x !== null) data.x = x;
  const y = parseOptionalFloat(form.get("y"));
  if (y !== null) data.y = y;
  const width = parseOptionalFloat(form.get("width"));
  if (width !== null) data.width = width;
  const height = parseOptionalFloat(form.get("height"));
  if (height !== null) data.height = height;
  const rotation = parseOptionalFloat(form.get("rotation"));
  if (rotation !== null) data.rotation = rotation;
  const zIndex = parseOptionalInt(form.get("zIndex"));
  if (zIndex !== null) data.zIndex = zIndex;

  const dataRaw = parseOptionalString(form.get("data"));
  if (dataRaw !== null) {
    if (dataRaw) {
      try {
        data.data = JSON.parse(dataRaw) as Prisma.InputJsonValue;
      } catch {
        return apiError("Invalid data JSON", 400);
      }
    } else {
      data.data = Prisma.DbNull;
    }
  }

  const nextType = type ?? item.type;
  const nextEntityId = entityId !== null ? entityId : item.entityId;
  const nextAssetId = assetId !== null ? assetId : item.assetId;
  const nextReferenceId = referenceId !== null ? referenceId : item.referenceId;
  const nextUrl = url !== null ? url : item.url;

  if (nextType === EvidenceItemType.entity && !nextEntityId) {
    return apiError("Entity is required for entity items", 400);
  }
  if (nextType === EvidenceItemType.asset && !nextAssetId) {
    return apiError("Asset is required for asset items", 400);
  }
  if (nextType === EvidenceItemType.reference && !nextReferenceId) {
    return apiError("Reference is required for reference items", 400);
  }
  if (nextType === EvidenceItemType.url && !nextUrl) {
    return apiError("URL is required for url items", 400);
  }

  if (nextEntityId) {
    const entity = await prisma.entity.findFirst({
      where: { id: nextEntityId, workspaceId, softDeletedAt: null }
    });
    if (!entity) return apiError("Entity not found", 404);
  }
  if (nextAssetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: nextAssetId, workspaceId, softDeletedAt: null }
    });
    if (!asset) return apiError("Asset not found", 404);
  }
  if (nextReferenceId) {
    const reference = await prisma.reference.findFirst({
      where: { id: nextReferenceId, workspaceId, softDeletedAt: null }
    });
    if (!reference) return apiError("Reference not found", 404);
  }

  await prisma.evidenceItem.update({
    where: { id: itemId, workspaceId },
    data
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "evidence_item",
    targetId: itemId,
    meta: { boardId: item.boardId }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "evidence_board",
    targetId: item.boardId,
    type: "evidence_item_updated",
    payload: { evidenceItemId: itemId, boardId: item.boardId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/"));
}

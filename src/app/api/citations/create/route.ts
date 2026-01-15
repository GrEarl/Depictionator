import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { CitationTargetType } from "@prisma/client";
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
  const referenceId = String(form.get("referenceId") ?? "");
  const targetTypeRaw = String(form.get("targetType") ?? "").trim().toLowerCase();
  const targetType = (Object.values(CitationTargetType) as string[]).includes(targetTypeRaw)
    ? (targetTypeRaw as CitationTargetType)
    : null;
  const targetId = String(form.get("targetId") ?? "");
  const quote = parseOptionalString(form.get("quote"));
  const locator = parseOptionalString(form.get("locator"));
  const note = parseOptionalString(form.get("note"));

  if (!workspaceId || !referenceId || !targetType || !targetId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const reference = await prisma.reference.findFirst({
    where: { id: referenceId, workspaceId, softDeletedAt: null }
  });
  if (!reference) {
    return apiError("Reference not found", 404);
  }

  const relationData: Record<string, string> = {};
  if (targetType === "entity") {
    const entity = await prisma.entity.findFirst({
      where: { id: targetId, workspaceId, softDeletedAt: null }
    });
    if (!entity) return apiError("Entity not found", 404);
  }
  if (targetType === "map") {
    const map = await prisma.map.findFirst({
      where: { id: targetId, workspaceId, softDeletedAt: null }
    });
    if (!map) return apiError("Map not found", 404);
    relationData.mapId = targetId;
  }
  if (targetType === "event") {
    const event = await prisma.event.findFirst({
      where: { id: targetId, workspaceId, softDeletedAt: null }
    });
    if (!event) return apiError("Event not found", 404);
    relationData.eventId = targetId;
  }
  if (targetType === "timeline") {
    const timeline = await prisma.timeline.findFirst({
      where: { id: targetId, workspaceId, softDeletedAt: null }
    });
    if (!timeline) return apiError("Timeline not found", 404);
    relationData.timelineId = targetId;
  }
  if (targetType === "board_item") {
    const item = await prisma.evidenceItem.findFirst({
      where: { id: targetId, workspaceId, softDeletedAt: null }
    });
    if (!item) return apiError("Evidence item not found", 404);
    relationData.evidenceItemId = targetId;
  }
  if (targetType === "evidence_board") {
    const board = await prisma.evidenceBoard.findFirst({
      where: { id: targetId, workspaceId, softDeletedAt: null }
    });
    if (!board) return apiError("Evidence board not found", 404);
    relationData.evidenceBoardId = targetId;
  }
  if (targetType === "article_revision") {
    const revision = await prisma.articleRevision.findFirst({
      where: { id: targetId, workspaceId }
    });
    if (!revision || revision.targetType !== "base") {
      return apiError("Article revision not found", 404);
    }
  }
  if (targetType === "overlay_revision") {
    const revision = await prisma.articleRevision.findFirst({
      where: { id: targetId, workspaceId }
    });
    if (!revision || revision.targetType !== "overlay") {
      return apiError("Overlay revision not found", 404);
    }
  }

  const citation = await prisma.citation.create({
    data: {
      workspaceId,
      referenceId,
      targetType,
      targetId,
      quote: quote || null,
      locator: locator || null,
      note: note || null,
      ...relationData
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "citation",
    targetId: citation.id,
    meta: { citationTargetType: targetType, citationTargetId: targetId }
  });

  await notifyWatchers({
    workspaceId,
    targetType,
    targetId,
    type: "citation_created",
    payload: { citationId: citation.id }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/"));
}

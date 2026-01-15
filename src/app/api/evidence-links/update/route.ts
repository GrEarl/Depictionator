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
  const linkId = String(form.get("linkId") ?? "");

  if (!workspaceId || !linkId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const link = await prisma.evidenceLink.findFirst({
    where: { id: linkId, workspaceId }
  });
  if (!link) {
    return apiError("Evidence link not found", 404);
  }

  const data: Record<string, unknown> = {};
  const label = parseOptionalString(form.get("label"));
  if (label !== null) data.label = label;
  const styleRaw = parseOptionalString(form.get("style"));
  if (styleRaw !== null) {
    const normalized = styleRaw.trim().toLowerCase();
    if ((Object.values(EvidenceLinkStyle) as string[]).includes(normalized)) {
      data.style = normalized as EvidenceLinkStyle;
    } else {
      return apiError("Invalid link style", 400);
    }
  }
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

  await prisma.evidenceLink.update({
    where: { id: linkId, workspaceId },
    data
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "evidence_link",
    targetId: linkId,
    meta: { boardId: link.boardId }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "evidence_board",
    targetId: link.boardId,
    type: "evidence_link_updated",
    payload: { evidenceLinkId: linkId, boardId: link.boardId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/"));
}

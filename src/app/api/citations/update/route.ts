import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
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
  const citationId = String(form.get("citationId") ?? "");

  if (!workspaceId || !citationId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const citation = await prisma.citation.findFirst({
    where: { id: citationId, workspaceId }
  });
  if (!citation) {
    return apiError("Citation not found", 404);
  }

  const data: Record<string, unknown> = {};
  const quote = parseOptionalString(form.get("quote"));
  if (quote !== null) data.quote = quote;
  const locator = parseOptionalString(form.get("locator"));
  if (locator !== null) data.locator = locator;
  const note = parseOptionalString(form.get("note"));
  if (note !== null) data.note = note;

  await prisma.citation.update({
    where: { id: citationId, workspaceId },
    data
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "citation",
    targetId: citationId,
    meta: { citationTargetType: citation.targetType, citationTargetId: citation.targetId }
  });

  await notifyWatchers({
    workspaceId,
    targetType: citation.targetType,
    targetId: citation.targetId,
    type: "citation_updated",
    payload: { citationId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/"));
}

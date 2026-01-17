import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { ReferenceType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { parseCsv, parseOptionalString } from "@/lib/forms";

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const typeValue = String(form.get("type") ?? "url").trim().toLowerCase();
  const type = (Object.values(ReferenceType) as string[]).includes(typeValue)
    ? (typeValue as ReferenceType)
    : ReferenceType.url;
  const title = String(form.get("title") ?? "").trim();
  const author = String(form.get("author") ?? "").trim();
  const year = String(form.get("year") ?? "").trim();
  const publisher = String(form.get("publisher") ?? "").trim();
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
  const summary = String(form.get("summary") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();
  const tags = parseCsv(form.get("tags"));
  const assetId = String(form.get("assetId") ?? "").trim();
  const licenseId = String(form.get("licenseId") ?? "").trim();
  const licenseUrl = String(form.get("licenseUrl") ?? "").trim();
  const attributionText = String(form.get("attributionText") ?? "").trim();
  const retrievedAtRaw = parseOptionalString(form.get("retrievedAt"));

  if (!workspaceId || !title) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  if (assetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, workspaceId, softDeletedAt: null }
    });
    if (!asset) return apiError("Asset not found", 404);
  }

  let retrievedAt: Date | null = null;
  if (retrievedAtRaw) {
    const parsed = parseDate(retrievedAtRaw);
    if (!parsed) return apiError("Invalid retrievedAt", 400);
    retrievedAt = parsed;
  }

  const reference = await prisma.reference.create({
    data: {
      workspaceId,
      type,
      title,
      author: author || null,
      year: year || null,
      publisher: publisher || null,
      sourceUrl: sourceUrl || null,
      summary: summary || null,
      notes: notes || null,
      tags,
      assetId: assetId || null,
      licenseId: licenseId || null,
      licenseUrl: licenseUrl || null,
      attributionText: attributionText || null,
      retrievedAt
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "reference",
    targetId: reference.id
  });

  await notifyWatchers({
    workspaceId,
    targetType: "reference",
    targetId: reference.id,
    type: "reference_created",
    payload: { referenceId: reference.id }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/"));
}

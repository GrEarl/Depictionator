import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
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
  const referenceId = String(form.get("referenceId") ?? "");

  if (!workspaceId || !referenceId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const reference = await prisma.reference.findFirst({
    where: { id: referenceId, workspaceId }
  });
  if (!reference) {
    return apiError("Reference not found", 404);
  }

  const data: Record<string, unknown> = {};
  const typeRaw = parseOptionalString(form.get("type"));
  if (typeRaw !== null) {
    const normalized = typeRaw.trim().toLowerCase();
    if ((Object.values(ReferenceType) as string[]).includes(normalized)) {
      data.type = normalized as ReferenceType;
    } else {
      return apiError("Invalid reference type", 400);
    }
  }
  const title = parseOptionalString(form.get("title"));
  if (title !== null) data.title = title;
  const author = parseOptionalString(form.get("author"));
  if (author !== null) data.author = author;
  const year = parseOptionalString(form.get("year"));
  if (year !== null) data.year = year;
  const publisher = parseOptionalString(form.get("publisher"));
  if (publisher !== null) data.publisher = publisher;
  const sourceUrl = parseOptionalString(form.get("sourceUrl"));
  if (sourceUrl !== null) data.sourceUrl = sourceUrl;
  const summary = parseOptionalString(form.get("summary"));
  if (summary !== null) data.summary = summary;
  const notes = parseOptionalString(form.get("notes"));
  if (notes !== null) data.notes = notes;
  const assetId = parseOptionalString(form.get("assetId"));
  if (assetId !== null) {
    if (assetId) {
      const asset = await prisma.asset.findFirst({
        where: { id: assetId, workspaceId, softDeletedAt: null }
      });
      if (!asset) return apiError("Asset not found", 404);
      data.assetId = assetId;
    } else {
      data.assetId = null;
    }
  }
  const licenseId = parseOptionalString(form.get("licenseId"));
  if (licenseId !== null) data.licenseId = licenseId;
  const licenseUrl = parseOptionalString(form.get("licenseUrl"));
  if (licenseUrl !== null) data.licenseUrl = licenseUrl;
  const attributionText = parseOptionalString(form.get("attributionText"));
  if (attributionText !== null) data.attributionText = attributionText;

  if (form.has("tags")) {
    data.tags = parseCsv(form.get("tags"));
  }

  if (form.has("retrievedAt")) {
    const raw = String(form.get("retrievedAt") ?? "").trim();
    if (!raw) {
      data.retrievedAt = null;
    } else {
      const parsed = parseDate(raw);
      if (!parsed) return apiError("Invalid retrievedAt", 400);
      data.retrievedAt = parsed;
    }
  }

  await prisma.reference.update({
    where: { id: referenceId, workspaceId },
    data
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "reference",
    targetId: referenceId
  });

  await notifyWatchers({
    workspaceId,
    targetType: "reference",
    targetId: referenceId,
    type: "reference_updated",
    payload: { referenceId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/"));
}

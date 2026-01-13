import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const file = form.get("file") as File | null;
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
  const author = String(form.get("author") ?? "").trim();
  const licenseId = String(form.get("licenseId") ?? "").trim();
  const licenseUrl = String(form.get("licenseUrl") ?? "").trim();
  const attributionText = String(form.get("attributionText") ?? "").trim();

  if (!workspaceId || !file) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storageDir = path.join(process.cwd(), "storage", workspaceId);
  await mkdir(storageDir, { recursive: true });
  const storageKey = `${Date.now()}-${file.name}`;
  await writeFile(path.join(storageDir, storageKey), buffer);

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      kind: file.type.startsWith("image/") ? "image" : "file",
      storageKey,
      mimeType: file.type,
      size: buffer.length,
      createdById: session.userId,
      sourceUrl: sourceUrl || null,
      author: author || null,
      licenseId: licenseId || null,
      licenseUrl: licenseUrl || null,
      attributionText: attributionText || null,
      retrievedAt: sourceUrl ? new Date() : null
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "asset",
    targetId: asset.id,
    meta: { storageKey }
  });

  return NextResponse.redirect(new URL("/settings", request.url));
}

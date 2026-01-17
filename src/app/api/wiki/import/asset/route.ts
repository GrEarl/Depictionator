import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { SourceTargetType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { fetchWikiImageInfo, safeFilename } from "@/lib/wiki";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();
  const lang = String(form.get("lang") ?? "").trim();
  const imageTitle = String(form.get("imageTitle") ?? "").trim();

  if (!workspaceId || !imageTitle) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const info = await fetchWikiImageInfo(lang || null, imageTitle);
  if (!info) return apiError("Image not found", 404);

  const download = await fetch(info.url);
  if (!download.ok) {
    return apiError(`Failed to download image (${download.status})`, 500);
  }

  const arrayBuffer = await download.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storageDir = path.join(process.cwd(), "storage", workspaceId);
  await mkdir(storageDir, { recursive: true });
  const storageKey = `${Date.now()}-${safeFilename(info.title)}`;
  await writeFile(path.join(storageDir, storageKey), buffer);

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      kind: info.mime.startsWith("image/") ? "image" : "file",
      storageKey,
      mimeType: info.mime,
      size: info.size ?? buffer.length,
      width: info.width,
      height: info.height,
      createdById: session.userId,
      sourceUrl: info.url,
      author: info.author,
      licenseId: info.licenseId,
      licenseUrl: info.licenseUrl,
      attributionText: info.attributionText,
      retrievedAt: new Date()
    }
  });

  await prisma.sourceRecord.create({
    data: {
      workspaceId,
      targetType: SourceTargetType.asset,
      targetId: asset.id,
      sourceUrl: info.url,
      title: info.title,
      author: info.author,
      licenseId: info.licenseId,
      licenseUrl: info.licenseUrl,
      attributionText: info.attributionText,
      retrievedAt: new Date(),
      createdById: session.userId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "import",
    targetType: "asset",
    targetId: asset.id,
    meta: { source: "wikipedia", url: info.url }
  });

  return NextResponse.json({ asset });
}

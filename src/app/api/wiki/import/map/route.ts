import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { Prisma, SourceTargetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { fetchWikiImageInfo, safeFilename, parseWikiImageInput } from "@/lib/wiki";

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
  const imageUrl = String(form.get("imageUrl") ?? "").trim();
  const mapTitle = String(form.get("mapTitle") ?? "").trim();
  const parentMapId = String(form.get("parentMapId") ?? "").trim();
  const parentMapQuery = String(form.get("parentMapQuery") ?? "").trim();
  const boundsRaw = String(form.get("bounds") ?? "").trim();

  if (!workspaceId || (!imageTitle && !imageUrl) || !mapTitle) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const resolved = parseWikiImageInput(imageUrl || imageTitle, lang || null);
  if (!resolved?.title) {
    return apiError("Invalid image reference", 400);
  }

  const info = await fetchWikiImageInfo(resolved.lang, resolved.title);
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

  let bounds: Prisma.InputJsonValue | undefined;
  if (boundsRaw) {
    try {
      bounds = JSON.parse(boundsRaw) as Prisma.InputJsonValue;
    } catch {
      return apiError("Invalid bounds JSON", 400);
    }
  }

  let resolvedParentMapId = parentMapId;
  if (!resolvedParentMapId && parentMapQuery) {
    const matches = await prisma.map.findMany({
      where: {
        workspaceId,
        softDeletedAt: null,
        OR: [
          { title: { equals: parentMapQuery, mode: "insensitive" } },
          { title: { contains: parentMapQuery, mode: "insensitive" } }
        ]
      },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 6
    });
    if (matches.length === 0) {
      return apiError(`No map matches "${parentMapQuery}".`, 404);
    }
    if (matches.length > 1) {
      const names = matches.map((m) => m.title).join(", ");
      return apiError(`Multiple maps match: ${names}. Please refine.`, 409);
    }
    resolvedParentMapId = matches[0].id;
  }

  const map = await prisma.map.create({
    data: {
      workspaceId,
      title: mapTitle,
      parentMapId: resolvedParentMapId || null,
      imageAssetId: asset.id,
      createdById: session.userId,
      updatedById: session.userId,
      ...(bounds !== undefined ? { bounds } : {})
    }
  });

  await prisma.sourceRecord.create({
    data: {
      workspaceId,
      targetType: SourceTargetType.map,
      targetId: map.id,
      sourceUrl: info.url,
      title: mapTitle,
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
    targetType: "map",
    targetId: map.id,
    meta: { source: "wikipedia", url: info.url }
  });

  return NextResponse.json({ map, asset });
}

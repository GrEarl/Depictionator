import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const { id: assetId } = await params;
  if (!assetId) {
    return apiError("Missing asset id", 400);
  }

  const asset = await prisma.asset.findFirst({ where: { id: assetId } });
  if (!asset) {
    return apiError("Asset not found", 404);
  }

  try {
    await requireWorkspaceAccess(session.userId, asset.workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const filePath = path.join(
    process.cwd(),
    "storage",
    asset.workspaceId,
    asset.storageKey
  );
  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${asset.storageKey}"`
      }
    });
  } catch {
    return apiError("File not found", 404);
  }
}

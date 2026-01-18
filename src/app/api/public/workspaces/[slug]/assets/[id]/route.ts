import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id: assetId } = await params;
  const workspaceSlug = String(slug ?? "").trim().toLowerCase();

  if (!workspaceSlug || !assetId) {
    return apiError("Missing parameters", 400);
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug }
  });

  if (!workspace) {
    return apiError("Workspace not found", 404);
  }

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, workspaceId: workspace.id, softDeletedAt: null }
  });

  if (!asset) {
    return apiError("Asset not found", 404);
  }

  if (asset.kind !== "image") {
    return apiError("Unsupported asset type", 400);
  }

  const filePath = path.join(process.cwd(), "storage", asset.workspaceId, asset.storageKey);
  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${asset.storageKey}"`,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    return apiError("File not found", 404);
  }
}

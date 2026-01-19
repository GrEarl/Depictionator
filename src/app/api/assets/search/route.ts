import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  let body: { workspaceId?: string; query?: string; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const workspaceId = String(body.workspaceId ?? "");
  const query = String(body.query ?? "").trim();
  const limit = Math.min(Number(body.limit ?? 20), 50);

  if (!workspaceId) {
    return apiError("Missing workspaceId", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const where: any = {
    workspaceId,
    softDeletedAt: null,
    kind: "image"
  };

  if (query) {
    where.OR = [
      { storageKey: { contains: query, mode: "insensitive" } },
      { sourceUrl: { contains: query, mode: "insensitive" } },
      { attributionText: { contains: query, mode: "insensitive" } }
    ];
  }

  const assets = await prisma.asset.findMany({
    where,
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      sourceUrl: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  const items = assets.map((asset) => ({
    ...asset,
    displayName: asset.storageKey?.split("-").slice(1).join("-") || asset.storageKey
  }));

  return NextResponse.json({ items });
}

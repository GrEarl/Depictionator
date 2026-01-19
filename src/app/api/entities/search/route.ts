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
    softDeletedAt: null
  };

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { aliases: { has: query } },
      { tags: { has: query } }
    ];
  }

  const items = await prisma.entity.findMany({
    where,
    select: { id: true, title: true, type: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: limit
  });

  return NextResponse.json({ items });
}

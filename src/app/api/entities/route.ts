import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = String(searchParams.get("workspaceId") ?? "");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const query = String(searchParams.get("q") ?? "").trim();

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

  const entities = await prisma.entity.findMany({
    where,
    select: { id: true, title: true, type: true },
    orderBy: { updatedAt: "desc" },
    take: limit
  });

  return NextResponse.json(entities);
}

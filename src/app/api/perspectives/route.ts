import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

function colorFromString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 55%)`;
}

export async function GET(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = String(searchParams.get("workspaceId") ?? "");

  if (!workspaceId) {
    return apiError("Missing workspaceId", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const viewpoints = await prisma.viewpoint.findMany({
    where: { workspaceId, softDeletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, type: true, description: true, entityId: true }
  });

  const items = viewpoints.map((viewpoint) => ({
    ...viewpoint,
    color: colorFromString(viewpoint.id)
  }));

  return NextResponse.json(items);
}

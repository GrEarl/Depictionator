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
  const scope = String(searchParams.get("scope") ?? "");

  if (!workspaceId || !scope) {
    return apiError("Missing workspaceId or scope", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const templates = await prisma.llmPromptTemplate.findMany({
    where: { workspaceId, scope },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({ items: templates });
}

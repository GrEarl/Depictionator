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

  let payload: { workspaceId?: string; entityId?: string };
  try {
    payload = (await request.json()) as { workspaceId?: string; entityId?: string };
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const workspaceId = String(payload.workspaceId ?? "").trim();
  const entityId = String(payload.entityId ?? "").trim();
  if (!workspaceId || !entityId) return apiError("Missing fields", 400);

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
    include: {
      article: {
        include: { baseRevision: true }
      }
    }
  });

  if (!entity) return apiError("Entity not found", 404);

  return NextResponse.json({
    ok: true,
    bodyMd: entity.article?.baseRevision?.bodyMd ?? "",
    revisionId: entity.article?.baseRevisionId ?? null,
    title: entity.title
  });
}

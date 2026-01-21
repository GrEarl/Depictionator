import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { ViewpointType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const typeValue = String(form.get("type") ?? "player").trim().toLowerCase();
  const type = (Object.values(ViewpointType) as string[]).includes(typeValue)
    ? (typeValue as ViewpointType)
    : ViewpointType.player;
  const entityId = String(form.get("entityId") ?? "").trim();
  const entityQuery = String(form.get("entityQuery") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  if (!workspaceId || !name) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  let resolvedEntityId = entityId || null;
  if (!resolvedEntityId && entityQuery) {
    const entity = await prisma.entity.findFirst({
      where: {
        workspaceId,
        softDeletedAt: null,
        OR: [
          { title: { equals: entityQuery, mode: "insensitive" } },
          { aliases: { has: entityQuery } }
        ]
      },
      select: { id: true }
    });
    if (!entity) {
      return apiError("Entity not found", 404);
    }
    resolvedEntityId = entity.id;
  }

  const viewpoint = await prisma.viewpoint.create({
    data: {
      workspaceId,
      name,
      type,
      entityId: resolvedEntityId,
      description: description || null
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "viewpoint",
    targetId: viewpoint.id
  });

  return NextResponse.redirect(toRedirectUrl(request, "/settings"));
}


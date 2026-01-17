import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { ViewpointType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { parseOptionalString } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const viewpointId = String(form.get("viewpointId") ?? "");

  if (!workspaceId || !viewpointId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const viewpoint = await prisma.viewpoint.findFirst({
    where: { id: viewpointId, workspaceId }
  });
  if (!viewpoint) {
    return apiError("Viewpoint not found", 404);
  }

  const data: Record<string, unknown> = {};
  const name = parseOptionalString(form.get("name"));
  if (name !== null) data.name = name;
  const description = parseOptionalString(form.get("description"));
  if (description !== null) data.description = description;
  const typeRaw = parseOptionalString(form.get("type"));
  if (typeRaw !== null) {
    const normalized = typeRaw.trim().toLowerCase();
    if ((Object.values(ViewpointType) as string[]).includes(normalized)) {
      data.type = normalized as ViewpointType;
    } else {
      return apiError("Invalid viewpoint type", 400);
    }
  }
  const entityId = parseOptionalString(form.get("entityId"));
  if (entityId !== null) {
    if (entityId) {
      const entity = await prisma.entity.findFirst({
        where: { id: entityId, workspaceId, softDeletedAt: null }
      });
      if (!entity) return apiError("Entity not found", 404);
      data.entityId = entityId;
    } else {
      data.entityId = null;
    }
  }

  await prisma.viewpoint.update({
    where: { id: viewpointId, workspaceId },
    data
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "viewpoint",
    targetId: viewpointId
  });

  return NextResponse.redirect(toRedirectUrl(request, "/settings"));
}

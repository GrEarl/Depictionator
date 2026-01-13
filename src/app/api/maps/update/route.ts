import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
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
  const mapId = String(form.get("mapId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const parentMapId = parseOptionalString(form.get("parentMapId"));
  const imageAssetId = parseOptionalString(form.get("imageAssetId"));
  const boundsRaw = parseOptionalString(form.get("bounds"));

  if (!workspaceId || !mapId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const data: Record<string, unknown> = {};
  if (title) data.title = title;
  if (parentMapId !== null) data.parentMapId = parentMapId;
  if (imageAssetId !== null) {
    if (imageAssetId) {
      const asset = await prisma.asset.findFirst({
        where: { id: imageAssetId, workspaceId, softDeletedAt: null }
      });
      if (!asset) {
        return apiError("Image asset not found", 404);
      }
      data.imageAssetId = asset.id;
    } else {
      data.imageAssetId = null;
    }
  }
  if (boundsRaw !== null) {
    if (!boundsRaw) {
      data.bounds = null;
    } else {
      try {
        data.bounds = JSON.parse(boundsRaw);
      } catch {
        return apiError("Invalid bounds JSON", 400);
      }
    }
  }
  data.updatedById = session.userId;

  await prisma.map.update({ where: { id: mapId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "map",
    targetId: mapId
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: mapId,
    type: "map_updated",
    payload: { mapId }
  });

  return NextResponse.redirect(new URL("/app/maps", request.url));
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
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
  const title = String(form.get("title") ?? "").trim();
  const parentMapId = String(form.get("parentMapId") ?? "").trim();
  const imageAssetId = String(form.get("imageAssetId") ?? "").trim();
  const boundsRaw = String(form.get("bounds") ?? "").trim();

  if (!workspaceId || !title) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  let bounds: Prisma.InputJsonValue | undefined;
  if (boundsRaw) {
    try {
      bounds = JSON.parse(boundsRaw) as Prisma.InputJsonValue;
    } catch {
      return apiError("Invalid bounds JSON", 400);
    }
  }

  let imageAsset: { id: string } | null = null;
  if (imageAssetId) {
    imageAsset = await prisma.asset.findFirst({
      where: { id: imageAssetId, workspaceId, softDeletedAt: null }
    });
    if (!imageAsset) {
      return apiError("Image asset not found", 404);
    }
  }

  const data: Prisma.MapUncheckedCreateInput = {
    workspaceId,
    title,
    parentMapId: parentMapId || null,
    imageAssetId: imageAsset?.id ?? null,
    createdById: session.userId,
    updatedById: session.userId
  };
  if (bounds !== undefined) data.bounds = bounds;

  const map = await prisma.map.create({ data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "map",
    targetId: map.id
  });

  return NextResponse.redirect(new URL("/maps", request.url));
}

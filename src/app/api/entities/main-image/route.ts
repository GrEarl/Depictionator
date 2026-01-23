import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { requireWorkspaceAccess, logAudit } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/entities/main-image
 * Upload or update the main image for an entity
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const formData = await request.formData();

    const workspaceId = formData.get("workspaceId") as string;
    const entityId = formData.get("entityId") as string;
    const assetId = formData.get("assetId") as string | null;
    const file = formData.get("file") as File | null;

    if (!workspaceId || !entityId) {
      return NextResponse.json(
        { error: "workspaceId and entityId are required" },
        { status: 400 }
      );
    }

    await requireWorkspaceAccess(session.userId, workspaceId, "editor");

    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: { id: true, title: true, workspaceId: true, mainImageId: true }
    });

    if (!entity || entity.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    let newAssetId: string | null = assetId;

    // If a file is provided, upload it first
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create asset record
      const asset = await prisma.asset.create({
        data: {
          workspaceId,
          uploadedById: session.userId,
          mimeType: file.type,
          storageKey: `entity-main-${entityId}-${Date.now()}`,
          displayName: file.name,
          sizeBytes: file.size,
          fileData: buffer,
        },
      });

      newAssetId = asset.id;
    }

    // Update entity with new main image
    await prisma.entity.update({
      where: { id: entityId },
      data: { mainImageId: newAssetId },
    });

    await logAudit({
      workspaceId,
      userId: session.userId,
      action: newAssetId ? "entity.main_image.set" : "entity.main_image.remove",
      targetType: "entity",
      targetId: entityId,
      metadata: {
        entityTitle: entity.title,
        previousImageId: entity.mainImageId,
        newImageId: newAssetId,
      },
    });

    // Redirect back to the entity page
    const redirectUrl = `/wiki/${encodeURIComponent(entity.title.replace(/ /g, "_"))}`;
    return NextResponse.redirect(new URL(redirectUrl, request.url), 303);
  } catch (error) {
    console.error("Error updating main image:", error);
    return NextResponse.json(
      { error: "Failed to update main image" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/entities/main-image
 * Remove the main image from an entity
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const { searchParams } = new URL(request.url);

    const workspaceId = searchParams.get("workspaceId");
    const entityId = searchParams.get("entityId");

    if (!workspaceId || !entityId) {
      return NextResponse.json(
        { error: "workspaceId and entityId are required" },
        { status: 400 }
      );
    }

    await requireWorkspaceAccess(session.userId, workspaceId, "editor");

    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: { id: true, title: true, workspaceId: true, mainImageId: true }
    });

    if (!entity || entity.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    await prisma.entity.update({
      where: { id: entityId },
      data: { mainImageId: null },
    });

    await logAudit({
      workspaceId,
      userId: session.userId,
      action: "entity.main_image.remove",
      targetType: "entity",
      targetId: entityId,
      metadata: {
        entityTitle: entity.title,
        previousImageId: entity.mainImageId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing main image:", error);
    return NextResponse.json(
      { error: "Failed to remove main image" },
      { status: 500 }
    );
  }
}

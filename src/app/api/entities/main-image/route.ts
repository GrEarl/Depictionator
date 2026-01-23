import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceAccess } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

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
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save to filesystem
      const storageDir = path.join(process.cwd(), "storage", workspaceId);
      await mkdir(storageDir, { recursive: true });
      const storageKey = `entity-main-${entityId}-${Date.now()}-${file.name}`;
      await writeFile(path.join(storageDir, storageKey), buffer);

      // Create asset record
      const asset = await prisma.asset.create({
        data: {
          workspaceId,
          kind: file.type.startsWith("image/") ? "image" : "file",
          storageKey,
          mimeType: file.type,
          size: buffer.length,
          createdById: session.userId,
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
      actorUserId: session.userId,
      action: newAssetId ? "update" : "delete",
      targetType: "entity",
      targetId: entityId,
      meta: {
        field: "mainImage",
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
      actorUserId: session.userId,
      action: "update",
      targetType: "entity",
      targetId: entityId,
      meta: {
        field: "mainImage",
        previousImageId: entity.mainImageId,
        newImageId: null,
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

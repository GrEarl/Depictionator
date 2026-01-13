import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
  const entityId = String(form.get("entityId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const truthFlag = String(form.get("truthFlag") ?? "canonical");
  const viewpointId = String(form.get("viewpointId") ?? "");
  const bodyMd = String(form.get("bodyMd") ?? "");
  const changeSummary = String(form.get("changeSummary") ?? "Overlay draft");

  if (!workspaceId || !entityId || !title) {
    return apiError("Missing required fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "reviewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const overlay = await prisma.articleOverlay.create({
    data: {
      workspaceId,
      entityId,
      viewpointId: viewpointId || null,
      title,
      truthFlag
    }
  });

  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType: "overlay",
      overlayId: overlay.id,
      bodyMd,
      changeSummary,
      createdById: session.userId,
      status: "draft"
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "overlay",
    targetId: overlay.id,
    meta: { entityId }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "revision",
    targetId: revision.id,
    meta: { targetType: "overlay" }
  });

  return NextResponse.redirect(new URL(`/app/articles/${entityId}`, request.url));
}

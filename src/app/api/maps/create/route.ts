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
  const title = String(form.get("title") ?? "").trim();
  const parentMapId = String(form.get("parentMapId") ?? "").trim();

  if (!workspaceId || !title) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const map = await prisma.map.create({
    data: {
      workspaceId,
      title,
      parentMapId: parentMapId || null,
      bounds: null,
      createdById: session.userId,
      updatedById: session.userId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "map",
    targetId: map.id
  });

  return NextResponse.redirect(new URL("/app/maps", request.url));
}

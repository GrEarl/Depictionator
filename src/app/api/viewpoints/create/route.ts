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
  const name = String(form.get("name") ?? "").trim();
  const type = String(form.get("type") ?? "player");
  const entityId = String(form.get("entityId") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  if (!workspaceId || !name) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const viewpoint = await prisma.viewpoint.create({
    data: {
      workspaceId,
      name,
      type,
      entityId: entityId || null,
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

  return NextResponse.redirect(new URL("/settings", request.url));
}

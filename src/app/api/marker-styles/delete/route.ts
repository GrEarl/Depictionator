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
  const styleId = String(form.get("styleId") ?? "");

  if (!workspaceId || !styleId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  await prisma.markerStyle.delete({ where: { id: styleId } });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "delete",
    targetType: "marker_style",
    targetId: styleId
  });

  return NextResponse.redirect(new URL("/app/maps", request.url));
}

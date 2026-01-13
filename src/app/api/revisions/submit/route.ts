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
  const revisionId = String(form.get("revisionId") ?? "");

  if (!workspaceId || !revisionId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  await prisma.articleRevision.update({
    where: { id: revisionId },
    data: { status: "submitted" }
  });

  await prisma.reviewRequest.create({
    data: {
      workspaceId,
      revisionId,
      requestedById: session.userId,
      status: "open"
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "submit_review",
    targetType: "revision",
    targetId: revisionId
  });

  return NextResponse.redirect(new URL("/app/reviews", request.url));
}

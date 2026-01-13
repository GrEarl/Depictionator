import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { parseOptionalInt } from "@/lib/forms";

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
  const orderIndex = parseOptionalInt(form.get("orderIndex"));
  const description = String(form.get("description") ?? "").trim();

  if (!workspaceId || !name || orderIndex === null) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const chapter = await prisma.chapter.create({
    data: {
      workspaceId,
      name,
      orderIndex,
      description: description || null
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "chapter",
    targetId: chapter.id
  });

  return NextResponse.redirect(new URL("/timeline", request.url));
}

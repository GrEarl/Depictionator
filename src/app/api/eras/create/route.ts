import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
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
  const worldStart = String(form.get("worldStart") ?? "").trim();
  const worldEnd = String(form.get("worldEnd") ?? "").trim();
  const sortKey = parseOptionalInt(form.get("sortKey"));

  if (!workspaceId || !name || sortKey === null) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const era = await prisma.era.create({
    data: {
      workspaceId,
      name,
      worldStart: worldStart || null,
      worldEnd: worldEnd || null,
      sortKey
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "era",
    targetId: era.id
  });

  return NextResponse.redirect(toRedirectUrl(request, "/timeline"));
}



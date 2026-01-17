import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { parseOptionalInt, parseOptionalString } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const eraId = String(form.get("eraId") ?? "");

  if (!workspaceId || !eraId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const data: Record<string, unknown> = {};
  const name = parseOptionalString(form.get("name"));
  if (name !== null) data.name = name;
  const worldStart = parseOptionalString(form.get("worldStart"));
  if (worldStart !== null) data.worldStart = worldStart;
  const worldEnd = parseOptionalString(form.get("worldEnd"));
  if (worldEnd !== null) data.worldEnd = worldEnd;
  const sortKey = parseOptionalInt(form.get("sortKey"));
  if (sortKey !== null) data.sortKey = sortKey;

  await prisma.era.update({ where: { id: eraId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "era",
    targetId: eraId
  });

  return NextResponse.redirect(toRedirectUrl(request, "/timeline"));
}



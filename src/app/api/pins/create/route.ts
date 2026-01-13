import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { parseOptionalFloat } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const mapId = String(form.get("mapId") ?? "");
  const x = parseOptionalFloat(form.get("x"));
  const y = parseOptionalFloat(form.get("y"));
  const label = String(form.get("label") ?? "").trim();
  const locationType = String(form.get("locationType") ?? "other");
  const markerStyleId = String(form.get("markerStyleId") ?? "").trim();
  const markerShape = String(form.get("markerShape") ?? "").trim();
  const markerColor = String(form.get("markerColor") ?? "").trim();

  if (!workspaceId || !mapId || x === null || y === null) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const pin = await prisma.pin.create({
    data: {
      workspaceId,
      mapId,
      x,
      y,
      label: label || null,
      locationType,
      truthFlag: "canonical",
      markerStyleId: markerStyleId || null,
      markerShape: markerShape || null,
      markerColor: markerColor || null
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "pin",
    targetId: pin.id
  });

  return NextResponse.redirect(new URL("/app/maps", request.url));
}

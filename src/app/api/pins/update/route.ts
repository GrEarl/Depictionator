import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { parseOptionalFloat, parseOptionalString } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const pinId = String(form.get("pinId") ?? "");

  if (!workspaceId || !pinId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const data: Record<string, unknown> = {};
  const x = parseOptionalFloat(form.get("x"));
  const y = parseOptionalFloat(form.get("y"));
  if (x !== null) data.x = x;
  if (y !== null) data.y = y;
  const label = parseOptionalString(form.get("label"));
  if (label !== null) data.label = label;
  const locationType = parseOptionalString(form.get("locationType"));
  if (locationType !== null) data.locationType = locationType;
  const markerStyleId = parseOptionalString(form.get("markerStyleId"));
  if (markerStyleId !== null) data.markerStyleId = markerStyleId;
  const markerShape = parseOptionalString(form.get("markerShape"));
  if (markerShape !== null) data.markerShape = markerShape;
  const markerColor = parseOptionalString(form.get("markerColor"));
  if (markerColor !== null) data.markerColor = markerColor;
  const worldFrom = parseOptionalString(form.get("worldFrom"));
  if (worldFrom !== null) data.worldFrom = worldFrom;
  const worldTo = parseOptionalString(form.get("worldTo"));
  if (worldTo !== null) data.worldTo = worldTo;
  const storyFrom = parseOptionalString(form.get("storyFromChapterId"));
  if (storyFrom !== null) data.storyFromChapterId = storyFrom;
  const storyTo = parseOptionalString(form.get("storyToChapterId"));
  if (storyTo !== null) data.storyToChapterId = storyTo;
  const viewpointId = parseOptionalString(form.get("viewpointId"));
  if (viewpointId !== null) data.viewpointId = viewpointId;
  const truthFlag = parseOptionalString(form.get("truthFlag"));
  if (truthFlag !== null) data.truthFlag = truthFlag;

  await prisma.pin.update({ where: { id: pinId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "pin",
    targetId: pinId
  });

  return NextResponse.redirect(new URL("/app/maps", request.url));
}

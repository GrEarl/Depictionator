import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { parseCsv } from "@/lib/forms";

type Payload = {
  workspaceId?: string;
  name?: string;
  entityIds?: string[];
};

function normalizeName(value?: string) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  let payload: Payload | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  if (!payload) {
    const form = await request.formData();
    payload = {
      workspaceId: String(form.get("workspaceId") ?? ""),
      name: String(form.get("name") ?? ""),
      entityIds: parseCsv(form.get("entityIds"))
    };
  }

  const workspaceId = normalizeName(payload.workspaceId);
  const name = normalizeName(payload.name);
  const entityIds = Array.isArray(payload.entityIds) ? payload.entityIds.filter(Boolean) : [];

  if (!workspaceId || !name || entityIds.length === 0) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const tag = `category:${name}`;
  const targets = await prisma.entity.findMany({
    where: { workspaceId, softDeletedAt: null, id: { in: entityIds } },
    select: { id: true, tags: true }
  });

  await Promise.all(
    targets.map((entity) => {
      const nextTags = Array.from(new Set([...(entity.tags ?? []), tag]));
      return prisma.entity.update({
        where: { id: entity.id },
        data: { tags: nextTags, updatedById: session.userId }
      });
    })
  );

  return NextResponse.json({ ok: true, updated: targets.length });
}

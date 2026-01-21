import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

type Payload = {
  workspaceId?: string;
  name?: string;
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
      name: String(form.get("name") ?? "")
    };
  }

  const workspaceId = normalizeName(payload.workspaceId);
  const name = normalizeName(payload.name);

  if (!workspaceId || !name) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const tag = `category:${name}`;
  const targets = await prisma.entity.findMany({
    where: { workspaceId, softDeletedAt: null, tags: { has: tag } },
    select: { id: true, tags: true }
  });

  await Promise.all(
    targets.map((entity) => {
      const nextTags = entity.tags.filter((existing) => existing !== tag);
      return prisma.entity.update({
        where: { id: entity.id },
        data: { tags: nextTags }
      });
    })
  );

  return NextResponse.json({ ok: true, updated: targets.length });
}

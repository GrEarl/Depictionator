import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

type Payload = {
  workspaceId?: string;
  from?: string;
  to?: string;
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
      from: String(form.get("from") ?? ""),
      to: String(form.get("to") ?? "")
    };
  }

  const workspaceId = normalizeName(payload.workspaceId);
  const from = normalizeName(payload.from);
  const to = normalizeName(payload.to);

  if (!workspaceId || !from || !to) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const fromTag = `category:${from}`;
  const toTag = `category:${to}`;

  const targets = await prisma.entity.findMany({
    where: { workspaceId, softDeletedAt: null, tags: { has: fromTag } },
    select: { id: true, tags: true }
  });

  await Promise.all(
    targets.map((entity) => {
      const nextTags = Array.from(
        new Set(
          entity.tags.map((tag) => (tag === fromTag ? toTag : tag))
        )
      );
      return prisma.entity.update({
        where: { id: entity.id },
        data: { tags: nextTags }
      });
    })
  );

  return NextResponse.json({ ok: true, updated: targets.length });
}

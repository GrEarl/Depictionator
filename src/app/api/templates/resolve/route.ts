import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

type ResolvePayload = {
  workspaceId?: string;
  names?: string[];
};

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  let payload: ResolvePayload | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const workspaceId = String(payload?.workspaceId ?? "");
  const rawNames = Array.isArray(payload?.names) ? payload?.names : [];
  const normalizedNames = Array.from(
    new Set(rawNames.map((name) => String(name || "").trim()).filter(Boolean))
  );

  if (!workspaceId || normalizedNames.length === 0) {
    return NextResponse.json({ items: [] });
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const candidates = normalizedNames.flatMap((name) => {
    const base = name.replace(/^Template:/i, "").trim();
    return [
      `Template:${base}`,
      base
    ];
  });

  const uniqueCandidates = Array.from(new Set(candidates.map((title) => title.trim()).filter(Boolean)));
  const orFilters = uniqueCandidates.map((title) => ({
    title: { equals: title, mode: "insensitive" as const }
  }));

  const entities = await prisma.entity.findMany({
    where: {
      workspaceId,
      softDeletedAt: null,
      OR: orFilters.length ? orFilters : undefined
    },
    include: {
      article: {
        include: { baseRevision: true }
      }
    }
  });

  const byTitle = new Map(
    entities.map((entity) => [normalizeTitle(entity.title), entity])
  );

  const items = normalizedNames.map((name) => {
    const base = name.replace(/^Template:/i, "").trim();
    const primary = byTitle.get(normalizeTitle(`Template:${base}`));
    const fallback = byTitle.get(normalizeTitle(base));
    const entity = primary ?? fallback;
    return {
      name: base,
      bodyMd: entity?.article?.baseRevision?.bodyMd ?? ""
    };
  }).filter((item) => item.bodyMd);

  return NextResponse.json({ items });
}

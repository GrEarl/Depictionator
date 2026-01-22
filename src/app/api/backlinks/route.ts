import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { containsLinkTo } from "@/lib/links";

/**
 * Get all entities that link to a specific entity
 * Based on AGENTS.md requirement: "バックリンク（どこから参照されているか）"
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);

    const workspaceId = searchParams.get("workspaceId");
    const entityId = searchParams.get("entityId");
    const title = searchParams.get("title");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!workspaceId || (!entityId && !title)) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get target entity
    let targetEntity;
    if (entityId) {
      targetEntity = await prisma.entity.findFirst({
        where: { id: entityId, workspaceId, softDeletedAt: null },
        select: { id: true, title: true, aliases: true },
      });
    } else if (title) {
      targetEntity = await prisma.entity.findFirst({
        where: {
          workspaceId,
          softDeletedAt: null,
          OR: [
            { title: { equals: title, mode: "insensitive" } },
            { aliases: { has: title } },
          ],
        },
        select: { id: true, title: true, aliases: true },
      });
    }

    if (!targetEntity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Get all articles with their content
    const articlesWithContent = await prisma.articleRevision.findMany({
      where: {
        workspaceId,
        article: {
          entity: {
            softDeletedAt: null,
            id: { not: targetEntity.id }, // Exclude self-links
          },
        },
        status: "approved",
      },
      select: {
        id: true,
        bodyMd: true,
        article: {
          select: {
            entity: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: { approvedAt: "desc" },
    });

    // Filter to find articles that link to the target
    const searchTerms = [
      targetEntity.title,
      ...(targetEntity.aliases || []),
    ].filter(Boolean);

    const backlinks: { id: string; title: string; type: string }[] = [];
    const seenIds = new Set<string>();

    for (const revision of articlesWithContent) {
      const entity = revision.article?.entity;
      if (!entity || seenIds.has(entity.id)) continue;

      // Check if this article's content links to the target
      const hasLink = searchTerms.some((term) =>
        containsLinkTo(revision.bodyMd, term)
      );

      if (hasLink) {
        seenIds.add(entity.id);
        backlinks.push({
          id: entity.id,
          title: entity.title,
          type: entity.type,
        });

        if (backlinks.length >= limit) break;
      }
    }

    // Also include explicit relations
    const relations = await prisma.entityRelation.findMany({
      where: {
        workspaceId,
        softDeletedAt: null,
        toEntityId: targetEntity.id,
      },
      include: {
        fromEntity: {
          select: { id: true, title: true, type: true },
        },
      },
      take: limit,
    });

    for (const rel of relations) {
      if (!seenIds.has(rel.fromEntity.id)) {
        seenIds.add(rel.fromEntity.id);
        backlinks.push({
          id: rel.fromEntity.id,
          title: rel.fromEntity.title,
          type: rel.fromEntity.type,
        });
      }
    }

    return NextResponse.json({
      backlinks: backlinks.slice(0, limit),
      total: backlinks.length,
    });
  } catch (error) {
    console.error("Backlinks error:", error);
    return NextResponse.json({ error: "Failed to fetch backlinks" }, { status: 500 });
  }
}

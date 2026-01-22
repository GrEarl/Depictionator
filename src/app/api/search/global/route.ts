import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type SearchResult = {
  id: string;
  type: "entity" | "map" | "board" | "event" | "timeline";
  title: string;
  excerpt?: string;
  url: string;
  entityType?: string;
  tags?: string[];
  updatedAt?: string;
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);

    const workspaceId = searchParams.get("workspaceId");
    const query = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!workspaceId || !query) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: user.id
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const searchTerm = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search entities
    const entities = await prisma.entity.findMany({
      where: {
        workspaceId,
        softDeletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { aliases: { hasSome: [query] } },
          { tags: { hasSome: [query] } },
          { summaryMd: { contains: query, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        title: true,
        type: true,
        tags: true,
        summaryMd: true,
        updatedAt: true
      },
      take: Math.floor(limit * 0.5),
      orderBy: { updatedAt: "desc" }
    });

    entities.forEach((entity) => {
      results.push({
        id: entity.id,
        type: "entity",
        title: entity.title,
        excerpt: entity.summaryMd?.substring(0, 150),
        url: `/wiki/${encodeURIComponent(entity.title)}`,
        entityType: entity.type,
        tags: entity.tags,
        updatedAt: entity.updatedAt.toISOString()
      });
    });

    // Search maps
    const maps = await prisma.map.findMany({
      where: {
        workspaceId,
        softDeletedAt: null,
        title: { contains: query, mode: "insensitive" }
      },
      select: {
        id: true,
        title: true,
        updatedAt: true
      },
      take: Math.floor(limit * 0.2),
      orderBy: { updatedAt: "desc" }
    });

    maps.forEach((map) => {
      results.push({
        id: map.id,
        type: "map",
        title: map.title,
        url: `/maps/${map.id}`,
        updatedAt: map.updatedAt.toISOString()
      });
    });

    // Search evidence boards
    const boards = await prisma.evidenceBoard.findMany({
      where: {
        workspaceId,
        softDeletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true
      },
      take: Math.floor(limit * 0.15),
      orderBy: { updatedAt: "desc" }
    });

    boards.forEach((board) => {
      results.push({
        id: board.id,
        type: "board",
        title: board.name,
        excerpt: board.description || undefined,
        url: `/boards?board=${board.id}`,
        updatedAt: board.updatedAt.toISOString()
      });
    });

    // Search events
    const events = await prisma.event.findMany({
      where: {
        workspaceId,
        softDeletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { summaryMd: { contains: query, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        title: true,
        summaryMd: true,
        eventType: true,
        updatedAt: true
      },
      take: Math.floor(limit * 0.1),
      orderBy: { updatedAt: "desc" }
    });

    events.forEach((event) => {
      results.push({
        id: event.id,
        type: "event",
        title: event.title,
        excerpt: event.summaryMd?.substring(0, 150),
        url: `/timeline?event=${event.id}`,
        updatedAt: event.updatedAt.toISOString()
      });
    });

    // Search timelines
    const timelines = await prisma.timeline.findMany({
      where: {
        workspaceId,
        softDeletedAt: null,
        name: { contains: query, mode: "insensitive" }
      },
      select: {
        id: true,
        name: true,
        type: true
      },
      take: Math.floor(limit * 0.05)
    });

    timelines.forEach((timeline) => {
      results.push({
        id: timeline.id,
        type: "timeline",
        title: timeline.name,
        url: `/timeline?id=${timeline.id}`
      });
    });

    // Sort by relevance (exact matches first, then by update time)
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase() === searchTerm;
      const bExact = b.title.toLowerCase() === searchTerm;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = a.title.toLowerCase().startsWith(searchTerm);
      const bStarts = b.title.toLowerCase().startsWith(searchTerm);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Sort by update time
      if (a.updatedAt && b.updatedAt) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return 0;
    });

    return NextResponse.json({
      results: results.slice(0, limit),
      total: results.length
    });

  } catch (error) {
    console.error("Global search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

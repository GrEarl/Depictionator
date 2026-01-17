import { prisma } from "@/lib/prisma";
import { EntityType, EntityStatus } from "@prisma/client";

export type EntityFilterParams = {
  workspaceId: string;
  query?: string;
  type?: string;
  status?: string;
  tags?: string[];
  era?: string;
  chapter?: string;
  unreadOnly?: boolean;
  userId?: string;
};

export async function getFilteredEntities({
  workspaceId,
  query,
  type,
  status,
  tags,
  era,
  chapter,
  unreadOnly,
  userId
}: EntityFilterParams) {
  const typeFilter = type && Object.values(EntityType).includes(type as EntityType) ? type as EntityType : undefined;
  const statusFilter = status && Object.values(EntityStatus).includes(status as EntityStatus) ? status as EntityStatus : undefined;

  const where: any = {
    workspaceId,
    softDeletedAt: null,
  };

  if (typeFilter) where.type = typeFilter;
  if (statusFilter) where.status = statusFilter;
  
  if (era && era !== "all") {
    where.OR = [
      { worldExistFrom: era },
      { worldExistTo: era },
      { worldExistFrom: null, worldExistTo: null }
    ];
  }

  if (chapter && chapter !== "all") {
    where.OR = (where.OR || []).concat([
      { storyIntroChapterId: chapter },
      { storyIntroChapterId: null }
    ]);
  }

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { aliases: { has: query } },
      { tags: { has: query } }
    ];
  }

  if (tags && tags.length > 0) {
    where.tags = { hasSome: tags };
  }

  const entities = await prisma.entity.findMany({
    where,
    select: {
      id: true,
      title: true,
      type: true,
      updatedAt: true,
      article: { select: { baseRevisionId: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 100 // Limit for performance
  });

  if (unreadOnly && userId) {
    const readStates = await prisma.readState.findMany({
      where: { workspaceId, userId, targetType: "entity" }
    });
    const readStateMap = new Map(readStates.map(r => [r.targetId, r]));
    
    return entities.filter(e => {
      const baseRev = e.article?.baseRevisionId;
      const lastRead = readStateMap.get(e.id)?.lastReadRevisionId;
      return baseRev && lastRead !== baseRev;
    });
  }

  return entities;
}

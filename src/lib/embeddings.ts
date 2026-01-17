/**
 * Background job to generate embeddings for content
 *
 * Run this periodically or trigger after content updates
 */

import { prisma } from './prisma';
import { llmClient } from './llm-client';

export async function generateEmbeddingsForWorkspace(workspaceId: string) {
  console.log(`🔄 Generating embeddings for workspace: ${workspaceId}`);

  // Get entities without embeddings (using raw SQL for vector check)
  const entities = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    summaryMd: string | null;
    tags: string[];
    aliases: string[];
  }>>`
    SELECT id, title, "summaryMd", tags, aliases
    FROM "Entity"
    WHERE "workspaceId" = ${workspaceId}
      AND embedding IS NULL
      AND "softDeletedAt" IS NULL
    LIMIT 100
  `;

  console.log(`📊 Found ${entities.length} entities to embed`);

  for (const entity of entities) {
    try {
      // Create text representation
      const text = [
        entity.title,
        ...entity.aliases,
        ...entity.tags,
        entity.summaryMd || ''
      ].filter(Boolean).join(' ');

      if (!text.trim()) continue;

      // Generate embedding
      const embedding = await llmClient.embed(text);

      // Store in database (requires raw SQL for vector type)
      await prisma.$executeRaw`
        UPDATE "Entity"
        SET "embedding" = ${embedding}::vector
        WHERE "id" = ${entity.id}
      `;

      console.log(`✅ Generated embedding for entity: ${entity.title}`);
    } catch (error) {
      console.error(`❌ Failed to generate embedding for entity ${entity.id}:`, error);
    }
  }

  // Get articles without embeddings (using raw SQL for vector check)
  const articles = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    bodyMd: string;
  }>>`
    SELECT id, title, "bodyMd"
    FROM "ArticleRevision"
    WHERE "workspaceId" = ${workspaceId}
      AND embedding IS NULL
      AND status = 'approved'
    LIMIT 50
  `;

  console.log(`📊 Found ${articles.length} articles to embed`);

  for (const article of articles) {
    try {
      // Create text representation (limit size)
      const text = [
        article.title,
        article.bodyMd.slice(0, 5000) // Limit to first 5000 chars
      ].filter(Boolean).join('\n\n');

      if (!text.trim()) continue;

      // Generate embedding
      const embedding = await llmClient.embed(text);

      // Store in database
      await prisma.$executeRaw`
        UPDATE "ArticleRevision"
        SET "embedding" = ${embedding}::vector
        WHERE "id" = ${article.id}
      `;

      console.log(`✅ Generated embedding for article: ${article.title}`);
    } catch (error) {
      console.error(`❌ Failed to generate embedding for article ${article.id}:`, error);
    }
  }

  console.log(`✅ Embedding generation complete for workspace: ${workspaceId}`);
}

/**
 * Generate embedding for a single entity (use on create/update)
 */
export async function generateEntityEmbedding(entityId: string) {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      title: true,
      summaryMd: true,
      tags: true,
      aliases: true
    }
  });

  if (!entity) return;

  const text = [
    entity.title,
    ...entity.aliases,
    ...entity.tags,
    entity.summaryMd || ''
  ].filter(Boolean).join(' ');

  if (!text.trim()) return;

  const embedding = await llmClient.embed(text);

  await prisma.$executeRaw`
    UPDATE "Entity"
    SET "embedding" = ${embedding}::vector
    WHERE "id" = ${entity.id}
  `;
}

/**
 * Generate embedding for a single article (use on create/update)
 */
export async function generateArticleEmbedding(articleId: string) {
  const article = await prisma.articleRevision.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      bodyMd: true
    }
  });

  if (!article) return;

  const text = [
    article.title,
    article.bodyMd.slice(0, 5000)
  ].filter(Boolean).join('\n\n');

  if (!text.trim()) return;

  const embedding = await llmClient.embed(text);

  await prisma.$executeRaw`
    UPDATE "ArticleRevision"
    SET "embedding" = ${embedding}::vector
    WHERE "id" = ${article.id}
  `;
}

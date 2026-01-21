import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { llmClient } from "@/lib/llm-client";
import { LLM_PROMPTS, LLM_SCHEMAS } from "@/lib/llm-tools";

type AnalysisResult = {
  perspectiveId: string;
  perspectiveName: string;
  knowledgeLevel: "full" | "partial" | "minimal" | "false" | "unknown";
  beliefs: Array<{
    statement: string;
    isTrue: boolean;
    reliability: "confirmed" | "rumor" | "propaganda" | "misunderstanding";
    notes?: string;
  }>;
  relationships: Array<{
    relationshipType: string;
    description: string;
    sentiment: "positive" | "neutral" | "negative";
  }>;
  motivations: string[];
  hiddenFrom: string[];
};

function formatReliability(value: string) {
  if (value === "propaganda") return "propaganda" as const;
  if (value === "false") return "misunderstanding" as const;
  if (value === "uncertain") return "rumor" as const;
  return "confirmed" as const;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, entityId, perspectiveIds } = body as {
      workspaceId?: string;
      entityId?: string;
      perspectiveIds?: string[];
    };

    if (!workspaceId || !entityId || !Array.isArray(perspectiveIds) || perspectiveIds.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      include: { article: { include: { baseRevision: true } } }
    });
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const perspectives = await prisma.viewpoint.findMany({
      where: { workspaceId, id: { in: perspectiveIds }, softDeletedAt: null },
      orderBy: { createdAt: "asc" }
    });
    if (perspectives.length === 0) {
      return NextResponse.json({ error: "No viewpoints found" }, { status: 404 });
    }

    const [relatedEntities, relatedEvents, relationships] = await Promise.all([
      prisma.entity.findMany({
        where: {
          workspaceId,
          softDeletedAt: null,
          OR: [{ tags: { hasSome: entity.tags } }, { type: entity.type }]
        },
        take: 20
      }),
      prisma.event.findMany({
        where: {
          workspaceId,
          softDeletedAt: null,
          involvedEntityIds: { has: entityId }
        },
        take: 10
      }),
      prisma.entityRelation.findMany({
        where: {
          workspaceId,
          OR: [{ fromEntityId: entityId }, { toEntityId: entityId }]
        }
      })
    ]);

    const worldContext = `
# Entity: ${entity.title}
Type: ${entity.type}
${entity.article?.baseRevision?.bodyMd ? `\n## Canon Information\n${entity.article.baseRevision.bodyMd}\n` : ""}

## Related Entities
${relatedEntities.map((e) => `- ${e.title} (${e.type})`).join("\n")}

## Relationships
${relationships
  .map(
    (r) =>
      `- ${r.fromEntityId === entityId ? "This entity" : "Other"} ↔ ${
        r.relationType
      } ↔ ${r.toEntityId === entityId ? "This entity" : "Other"}: ${r.description || ""}`
  )
  .join("\n")}

## Related Events
${relatedEvents
  .map((e) => `- ${e.title} (${e.worldStart || "unknown"}): ${e.summaryMd || ""}`)
  .join("\n")}
`;

    const analyses: AnalysisResult[] = [];

    for (const perspective of perspectives) {
      const prompt = LLM_PROMPTS.perspectiveAnalysis(
        entity.title,
        perspective.name,
        worldContext
      );
      const result = await llmClient.complete(
        [{ role: "user", content: prompt }],
        {
          temperature: 0.7,
          maxTokens: 2048,
          jsonSchema: LLM_SCHEMAS.perspectiveAnalysis
        }
      );

      let analysisData: any;
      try {
        const jsonMatch =
          result.content.match(/```json\\s*([\\s\\S]*?)\\s*```/) ||
          result.content.match(/\\{[\\s\\S]*\\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.content;
        analysisData = JSON.parse(jsonStr);
      } catch (parseError) {
        return NextResponse.json(
          { error: "Failed to parse AI response", raw: result.content },
          { status: 500 }
        );
      }

      analyses.push({
        perspectiveId: perspective.id,
        perspectiveName: perspective.name,
        knowledgeLevel: "partial",
        beliefs: (analysisData.beliefs || []).map((belief: any) => ({
          statement: belief.statement,
          isTrue: belief.reliability === "true",
          reliability: formatReliability(belief.reliability),
          notes: belief.reasoning
        })),
        relationships: [],
        motivations: analysisData.motivations || [],
        hiddenFrom: analysisData.unknownFacts || []
      });
    }

    return NextResponse.json({
      entityId,
      entityTitle: entity.title,
      entityType: entity.type,
      perspectives: analyses
    });
  } catch (error: any) {
    console.error("Perspective comparison error:", error);
    return NextResponse.json(
      { error: error.message || "Comparison failed" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EntityType, SourceTargetType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { buildWikiAttribution, fetchWikiLangLinks, fetchWikiPage, normalizeLang, resolveWikiPageWithFallback } from "@/lib/wiki";
import { toRedirectUrl } from "@/lib/redirect";
import { generateText, type LlmProvider } from "@/lib/llm";
import { toWikiPath } from "@/lib/wiki";

const DEFAULT_WIKI_LANG = process.env.WIKI_DEFAULT_LANG ?? "en";
const DEFAULT_LLM_PROVIDER = (process.env.WIKI_LLM_PROVIDER ?? process.env.LLM_DEFAULT_PROVIDER ?? "gemini_ai") as LlmProvider;
const DEFAULT_LANG_LIMIT = Number(process.env.WIKI_IMPORT_LANG_LIMIT ?? "10");

type WikiPage = NonNullable<Awaited<ReturnType<typeof fetchWikiPage>>>;
type WikiSource = {
  lang: string;
  page: WikiPage;
};

function parseLangList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => normalizeLang(entry))
        .filter(Boolean)
    )
  );
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return value.slice(0, limit) + "\n\n[truncated]";
}

function pickSourceContent(page: WikiPage): string {
  const extract = (page.extract ?? "").trim();
  if (extract) return extract;
  return (page.wikitext ?? "").trim();
}

function buildSynthesisPrompt(targetLang: string, sources: WikiSource[]): string {
  const header = [
    `You are a careful technical writer.`,
    `Create a concise internal wiki article in ${targetLang}.`,
    `Use only the provided sources. Do not invent facts.`,
    `If sources conflict, note the conflict clearly.`,
    `Output Markdown only.`,
    `Structure:`,
    `- Summary section with 3-6 bullet points.`,
    `- 2-6 sections with ## headings.`,
    `- End with a "Sources" section listing each source as "- [lang] URL".`
  ].join("\n");
  const sourceList = sources
    .map((source) => `- [${source.lang}] ${source.page.title}: ${source.page.url}`)
    .join("\n");
  const bodies = sources
    .map((source) => {
      const extract = pickSourceContent(source.page);
      const clipped = truncateText(extract, 4000);
      return `SOURCE [${source.lang}] ${source.page.title}\nURL: ${source.page.url}\nCONTENT:\n${clipped}`;
    })
    .join("\n\n");
  return `${header}\n\nSources:\n${sourceList}\n\n${bodies}`;
}

function renderPromptTemplate(template: string, targetLang: string, sources: WikiSource[]): string {
  const sourceList = sources
    .map((source) => `- [${source.lang}] ${source.page.title}: ${source.page.url}`)
    .join("\n");
  const bodies = sources
    .map((source) => {
      const extract = pickSourceContent(source.page);
      const clipped = truncateText(extract, 4000);
      return `SOURCE [${source.lang}] ${source.page.title}\nURL: ${source.page.url}\nCONTENT:\n${clipped}`;
    })
    .join("\n\n");
  const replacements: Record<string, string> = {
    targetLang,
    source_list: sourceList,
    sources: bodies,
    source_count: String(sources.length)
  };
  const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (key in replacements) return replacements[key];
    return match;
  });

  if (!rendered.includes(sourceList) && !rendered.includes("SOURCE [")) {
    return `${rendered}\n\nSources:\n${sourceList}\n\n${bodies}`;
  }
  return rendered;
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();
  const lang = String(form.get("lang") ?? "").trim();
  const pageId = String(form.get("pageId") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const typeValue = String(form.get("entityType") ?? "concept").trim().toLowerCase();
  const publish = String(form.get("publish") ?? "false") === "true";
  const targetLang = String(form.get("targetLang") ?? "").trim();
  const useLlm = String(form.get("useLlm") ?? process.env.WIKI_IMPORT_USE_LLM ?? "true") === "true";
  const aggregateLangs =
    String(form.get("aggregateLangs") ?? process.env.WIKI_IMPORT_AGGREGATE_LANGS ?? "true") === "true";
  const llmProviderRaw = String(form.get("llmProvider") ?? "").trim();
  const llmProvider = (llmProviderRaw || DEFAULT_LLM_PROVIDER) as LlmProvider;
  const llmModel = String(form.get("llmModel") ?? process.env.WIKI_LLM_MODEL ?? "").trim();
  const codexAuthBase64 = String(form.get("codexAuthBase64") ?? "").trim();
  const llmPrompt = String(form.get("llmPrompt") ?? "").trim();
  const llmPromptTemplateId = String(form.get("llmPromptTemplateId") ?? "").trim();
  const llmPromptTemplateName = String(form.get("llmPromptTemplateName") ?? "").trim();

  if (!workspaceId || (!pageId && !title)) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const preferredLang = normalizeLang(lang || DEFAULT_WIKI_LANG);
  const fallbackLangs = parseLangList(process.env.WIKI_FALLBACK_LANGS ?? "en");
  const resolved = await resolveWikiPageWithFallback(preferredLang, { pageId, title }, fallbackLangs);
  if (!resolved) return apiError("Page not found", 404);

  const page = resolved.page;
  const pageLang = resolved.lang;
  const fallbackUsed = pageLang !== preferredLang;

  let sources: WikiSource[] = [{ lang: pageLang, page }];
  let bodyMd = "";
  let usedLlm = false;

  if (useLlm) {
    if (aggregateLangs) {
      const links = await fetchWikiLangLinks(pageLang, page.pageId);
      const limit = Number.isFinite(DEFAULT_LANG_LIMIT) ? DEFAULT_LANG_LIMIT : 10;
      const selected = links.slice(0, limit);
      const extraPages = await Promise.all(
        selected.map(async (link) => {
          const extraPage = await fetchWikiPage(link.lang, { title: link.title });
          return extraPage ? ({ lang: link.lang, page: extraPage } as WikiSource) : null;
        })
      );
      sources = [sources[0], ...extraPages.filter((entry): entry is WikiSource => Boolean(entry))];
    }

    const outputLang = targetLang || preferredLang;
    let templatePrompt = llmPrompt;
    if (!templatePrompt && llmPromptTemplateId) {
      const template = await prisma.llmPromptTemplate.findFirst({
        where: { id: llmPromptTemplateId, workspaceId }
      });
      if (template) templatePrompt = template.prompt;
    }
    if (!templatePrompt && llmPromptTemplateName) {
      const template = await prisma.llmPromptTemplate.findFirst({
        where: {
          workspaceId,
          scope: "wiki_import_article",
          name: llmPromptTemplateName
        }
      });
      if (template) templatePrompt = template.prompt;
    }
    const prompt = templatePrompt
      ? renderPromptTemplate(templatePrompt, outputLang, sources)
      : buildSynthesisPrompt(outputLang, sources);
    try {
      bodyMd = await generateText({
        provider: llmProvider,
        prompt,
        model: llmModel || undefined,
        codexAuthBase64
      });
      usedLlm = true;
      if (!bodyMd.trim()) {
        bodyMd = pickSourceContent(page);
        usedLlm = false;
      }
    } catch (error) {
      return apiError(`LLM synthesis failed: ${(error as Error).message}`, 502);
    }
  } else if (fallbackUsed && String(process.env.WIKI_IMPORT_REQUIRE_LLM ?? "true") === "true") {
    return apiError("LLM is required to synthesize non-target language sources", 400);
  } else {
    bodyMd = pickSourceContent(page);
  }

  const type = (Object.values(EntityType) as string[]).includes(typeValue)
    ? (typeValue as EntityType)
    : EntityType.concept;

  const entity = await prisma.entity.create({
    data: {
      workspaceId,
      type,
      title: page.title,
      aliases: [],
      tags: ["imported", "wikipedia"],
      status: "draft",
      createdById: session.userId,
      updatedById: session.userId
    }
  });

  const article = await prisma.article.create({
    data: {
      entityId: entity.id,
      workspaceId
    }
  });

  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType: "base",
      articleId: article.entityId,
      bodyMd,
      changeSummary: usedLlm
        ? `Summarized from Wikipedia (${sources.length} languages)`
        : `Imported from Wikipedia (${page.url})`,
      createdById: session.userId,
      status: publish ? "approved" : "draft",
      approvedAt: publish ? new Date() : null,
      approvedById: publish ? session.userId : null
    }
  });

  if (publish) {
    await prisma.article.update({
      where: { entityId: entity.id },
      data: { baseRevisionId: revision.id }
    });
  }

  for (const source of sources) {
    const attribution = buildWikiAttribution(source.page.title, source.page.url);
    await prisma.sourceRecord.create({
      data: {
        workspaceId,
        targetType: SourceTargetType.article_revision,
        targetId: revision.id,
        sourceUrl: source.page.url,
        title: source.page.title,
        author: attribution.author,
        licenseId: attribution.licenseId,
        licenseUrl: attribution.licenseUrl,
        attributionText: attribution.attributionText,
        retrievedAt: new Date(),
        note: `lang=${source.lang}${usedLlm ? "; llm_synthesized=true" : ""}`,
        createdById: session.userId
      }
    });
  }

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "import",
    targetType: "entity",
    targetId: entity.id,
    meta: { source: "wikipedia", url: page.url, lang: pageLang, synthesized: usedLlm }
  });

  return NextResponse.redirect(toRedirectUrl(request, toWikiPath(entity.title)));
}

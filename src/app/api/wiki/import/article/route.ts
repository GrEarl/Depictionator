import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EntityType, SourceTargetType } from "@prisma/client";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  buildWikiAttribution,
  fetchWikiImageInfo,
  fetchWikiLangLinks,
  fetchWikiPage,
  fetchWikiPageMedia,
  searchWiki,
  normalizeLang,
  resolveWikiPageWithFallback,
  safeFilename,
  extractWikitextImagePlacements,
  type WikitextImagePlacement,
  buildMediaAnalysisPrompt,
  parseMediaAnalysisResponse,
  type MediaAnalysisItem,
  type MediaRelevanceResult
} from "@/lib/wiki";
import { toRedirectUrl } from "@/lib/redirect";
import { generateText, type LlmProvider } from "@/lib/llm";
import { toWikiPath } from "@/lib/wiki";

const DEFAULT_WIKI_LANG = process.env.WIKI_DEFAULT_LANG ?? "en";
const DEFAULT_LLM_PROVIDER = (process.env.WIKI_LLM_PROVIDER ?? process.env.LLM_DEFAULT_PROVIDER ?? "gemini_ai") as LlmProvider;
const DEFAULT_USE_LLM = String(process.env.WIKI_IMPORT_USE_LLM ?? "true") === "true";
const DEFAULT_AGGREGATE_LANGS = String(process.env.WIKI_IMPORT_AGGREGATE_LANGS ?? "true") === "true";
const DEFAULT_LANG_LIMIT = Number(process.env.WIKI_IMPORT_LANG_LIMIT ?? "10");
const DEFAULT_MEDIA_LIMIT = Number(process.env.WIKI_IMPORT_MEDIA_LIMIT ?? "50");
const DEFAULT_MEDIA_MAX_BYTES = Number(process.env.WIKI_IMPORT_MEDIA_MAX_BYTES ?? `${200 * 1024 * 1024}`);
const DEFAULT_MEDIA_MIN_DIM = Number(process.env.WIKI_IMPORT_MEDIA_MIN_DIM ?? "200");
const DEFAULT_GALLERY_MIN_COUNT = Number(process.env.WIKI_IMPORT_GALLERY_MIN ?? "3");
const DEFAULT_SKIP_UI_MEDIA = String(process.env.WIKI_IMPORT_SKIP_UI_MEDIA ?? "true") === "true";
const DEFAULT_VERIFY_LIMIT = Number(process.env.WIKI_IMPORT_VERIFY_LIMIT ?? "3");
const DEFAULT_MIN_BODY_CHARS = Number(process.env.WIKI_IMPORT_MIN_CHARS ?? "600");

type WikiPage = NonNullable<Awaited<ReturnType<typeof fetchWikiPage>>>;
type WikiSource = {
  lang: string;
  page: WikiPage;
};

type ImportedAsset = {
  id: string;
  title: string;
  mimeType: string;
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

function parseBooleanValue(input: FormDataEntryValue | null, fallback: boolean) {
  const normalized = String(input ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function pickSourceContent(page: WikiPage): string {
  const extract = (page.extract ?? "").trim();
  if (extract) return extract;
  return (page.wikitext ?? "").trim();
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[_\-–—]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelySameTitle(base: string, candidate: string): boolean {
  if (!base || !candidate) return false;
  if (base === candidate) return true;
  return base.includes(candidate) || candidate.includes(base);
}

function buildImportRules(targetLang: string): string {
  return [
    `IMPORT RULES (must follow):`,
    `- Output Markdown only. No HTML, no wikitext, no templates.`,
    `- Synthesize across all provided languages and verification sources.`,
    `- Use only the provided sources; do not invent facts.`,
    `- Remove subjective language; keep neutral, factual tone.`,
    `- Add narrative context and relationships useful for worldbuilding, but stay factual and sourced.`,
    `- If sources conflict or a fact is missing, state that explicitly.`,
    `- Write in ${targetLang} only. Translate any non-${targetLang} content.`
  ].join("\n");
}

function buildSynthesisPrompt(targetLang: string, sources: WikiSource[]): string {
  const header = [
    buildImportRules(targetLang),
    ``,
    `Structure:`,
    `- Summary section with 3-6 bullet points.`,
    `- 2-6 sections with ## headings (Overview, Background, Relationships, Narrative Context as applicable).`,
    `- End with a "Sources" section listing each source as "- [lang] URL".`,
    `Keep paragraphs short and readable.`
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
  const importRules = buildImportRules(targetLang);
  const replacements: Record<string, string> = {
    targetlang: targetLang,
    target_lang: targetLang,
    language: targetLang,
    lang: targetLang,
    outputlang: targetLang,
    output_lang: targetLang,
    source_list: sourceList,
    sourcelist: sourceList,
    sources_list: sourceList,
    sources: bodies,
    source_block: bodies,
    sourceblock: bodies,
    sources_block: bodies,
    sources_text: bodies,
    source_text: bodies,
    sourcestext: bodies,
    sourcetext: bodies,
    source_count: String(sources.length),
    sourcecount: String(sources.length),
    import_rules: importRules,
    importrules: importRules,
    rules: importRules
  };
  const replaceTokens = (input: string, pattern: RegExp) =>
    input.replace(pattern, (match, key) => {
      const normalizedKey = String(key).toLowerCase();
      if (normalizedKey in replacements) return replacements[normalizedKey];
      return match;
    });
  let renderedBody = replaceTokens(template, /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  renderedBody = replaceTokens(renderedBody, /\$\{\s*([a-zA-Z0-9_]+)\s*\}/g);
  const includesRulesPlaceholder =
    /(\{\{\s*(import_rules|importrules|rules)\s*\}\}|\$\{\s*(import_rules|importrules|rules)\s*\})/i.test(
      template
    );
  const rendered = (includesRulesPlaceholder ? renderedBody : `${importRules}\n\n${renderedBody}`).trim();

  const hasAnySourceUrl = sources.some((source) => rendered.includes(source.page.url));
  if (!hasAnySourceUrl && !/SOURCE \[/i.test(rendered)) {
    return `${rendered}\n\nSources:\n${sourceList}\n\n${bodies}`.trim();
  }
  return rendered;
}

function buildFallbackMarkdown(targetLang: string, sources: WikiSource[]): string {
  const combined = sources
    .map((source) => {
      const extract = pickSourceContent(source.page);
      return `### ${source.page.title} (${source.lang})\n${truncateText(extract, 1200)}`;
    })
    .join("\n\n");
  const sentences = combined
    .replace(/#+\s*/g, "")
    .split(/[。．.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const summary = sentences.slice(0, 5).map((s) => `- ${s}`);
  const sourceList = sources
    .map((source) => `- [${source.lang}] ${source.page.url}`)
    .join("\n");
  return [
    `## Summary`,
    summary.length ? summary.join("\n") : "- Summary unavailable from sources.",
    ``,
    `## Overview`,
    `This entry aggregates multi-language sources in ${targetLang}.`,
    ``,
    `## Details`,
    combined || "_No source extract available._",
    ``,
    `## Sources`,
    sourceList
  ].join("\n");
}

function ensureMarkdown(body: string, targetLang: string, sources: WikiSource[]): string {
  const trimmed = body.trim();
  if (!trimmed) return buildFallbackMarkdown(targetLang, sources);
  const hasHeading = /##\s+/.test(trimmed);
  const hasSources = /##\s*Sources/i.test(trimmed);
  const hasWikiSyntax = /\[\[.+?\]\]|\{\{.+?\}\}/.test(trimmed);
  if (hasWikiSyntax || trimmed.length < DEFAULT_MIN_BODY_CHARS || !hasHeading) {
    return buildFallbackMarkdown(targetLang, sources);
  }
  if (!hasSources) {
    const sourceList = sources
      .map((source) => `- [${source.lang}] ${source.page.url}`)
      .join("\n");
    return `${trimmed}\n\n## Sources\n${sourceList}`.trim();
  }
  return trimmed;
}

function shouldSkipMediaTitle(title: string): boolean {
  const lower = title.toLowerCase();
  const patterns = [
    "wikipedia",
    "wikimedia",
    "commons",
    "wikidata",
    "wiktionary",
    "wikisource",
    "wikibooks",
    "wikinews",
    "wikiquote",
    "wikivoyage",
    "mediawiki",
    "logo",
    "icon",
    "pictogram",
    "question_book",
    "speaker_icon",
    "sound-icon",
    "edit",
    "magnify",
    "searchtool",
    "powered by",
    "citation"
  ];
  return patterns.some((pattern) => lower.includes(pattern));
}

function shouldSkipMediaInfo(info: { mime?: string | null; width?: number | null; height?: number | null }) {
  if (!DEFAULT_SKIP_UI_MEDIA) return false;
  if (!info.mime || !info.mime.startsWith("image/")) return false;
  const maxDim = Math.max(info.width ?? 0, info.height ?? 0);
  if (!maxDim) return false;
  return maxDim < DEFAULT_MEDIA_MIN_DIM;
}

function normalizeMediaTitle(title: string) {
  return title.toLowerCase().replace(/^file:/i, "").trim();
}

function stripExtension(title: string) {
  return title.replace(/\.[a-z0-9]+$/i, "");
}

function extractTitleKeywords(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && token.length >= 2 && /[a-z]/.test(token));
}

async function fetchCommonsSearchImages(query: string, limit: number): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed || limit <= 0) return [];
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: trimmed,
    srnamespace: "6",
    srlimit: String(limit),
    format: "json",
    origin: "*"
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Depictionator/1.0 (media import)"
      }
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { search?: Array<{ title?: string | null }> };
    };
    const titles = data?.query?.search ?? [];
    return titles
      .map((item) => String(item.title ?? "").trim())
      .filter(Boolean)
      .map((title) => title.replace(/^File:/i, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const REFERENCE_MEDIA_KEYWORDS = [
  "diagram",
  "schematic",
  "schematics",
  "blueprint",
  "blue print",
  "cutaway",
  "cross-section",
  "cross section",
  "orthographic",
  "plan",
  "outline",
  "drawing",
  "technical",
  "profile",
  "side view",
  "top view",
  "front view",
  "rear view",
  "section",
  "elevation",
  "layout",
  "dimension",
  "dimensions",
  "spec",
  "specs"
];

function isReferenceMediaTitle(title: string) {
  const normalized = title.toLowerCase().replace(/[_\-]+/g, " ");
  return REFERENCE_MEDIA_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type ImportedAssetWithMeta = ImportedAsset & {
  placement: "infobox" | "inline" | "gallery";
  caption?: string;
  inlineSection?: string;
  priority: number;
};
type MediaInfo = NonNullable<Awaited<ReturnType<typeof fetchWikiImageInfo>>>;

function buildSmartMediaSection(assets: ImportedAssetWithMeta[]): string | null {
  // Only include gallery items in Media section (inline items will be placed in-text by LLM)
  const galleryAssets = assets.filter((a) => a.placement === "gallery");
  if (!galleryAssets.length) return null;

  const imageLines = galleryAssets
    .filter((asset) => asset.mimeType.startsWith("image/"))
    .map((asset) => `![${asset.caption || asset.title}](/api/assets/file/${asset.id})`);

  if (imageLines.length === 0) return null;

  return ["## Reference Gallery", "", ...imageLines].join("\n");
}

function insertInlineImages(body: string, assets: ImportedAssetWithMeta[]): string {
  const inlineAssets = assets.filter((a) => a.placement === "inline" && a.mimeType.startsWith("image/"));
  if (!inlineAssets.length) return body;

  let result = body;

  // Group by section
  const bySection = new Map<string, ImportedAssetWithMeta[]>();
  for (const asset of inlineAssets) {
    const section = asset.inlineSection?.toLowerCase() || "overview";
    if (!bySection.has(section)) bySection.set(section, []);
    bySection.get(section)!.push(asset);
  }

  // Insert images after section headings
  for (const [section, sectionAssets] of bySection) {
    const sectionPattern = new RegExp(`(##\\s*${escapeRegExp(section)}[^\\n]*\\n)`, "i");
    const match = result.match(sectionPattern);
    if (match && match.index !== undefined) {
      const imageMarkdown = sectionAssets
        .map((a) => `\n![${a.caption || a.title}](/api/assets/file/${a.id})\n`)
        .join("");
      const insertPos = match.index + match[0].length;
      result = result.slice(0, insertPos) + imageMarkdown + result.slice(insertPos);
    }
  }

  return result;
}

function appendMediaToMarkdown(body: string, assets: ImportedAssetWithMeta[]): string {
  const trimmed = body.trim();
  if (!trimmed) return body;
  if (/##\s*Reference Gallery/i.test(trimmed)) return body;

  // First insert inline images
  let result = insertInlineImages(trimmed, assets);

  // Then add gallery section
  const section = buildSmartMediaSection(assets);
  if (!section) return result;

  const sourceMatch = result.match(/##\s*Sources\b/i);
  if (!sourceMatch || sourceMatch.index === undefined) {
    return `${result}\n\n${section}`.trim();
  }
  const insertIndex = sourceMatch.index;
  const before = result.slice(0, insertIndex).trimEnd();
  const after = result.slice(insertIndex).trimStart();
  return `${before}\n\n${section}\n\n${after}`.trim();
}

async function importWikiAsset(
  workspaceId: string,
  userId: string,
  info: Awaited<ReturnType<typeof fetchWikiImageInfo>>
) {
  if (!info) return null;
  const download = await fetch(info.url);
  if (!download.ok) {
    throw new Error(`Failed to download media (${download.status})`);
  }

  const arrayBuffer = await download.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storageDir = path.join(process.cwd(), "storage", workspaceId);
  await mkdir(storageDir, { recursive: true });
  const storageKey = `${Date.now()}-${safeFilename(info.title)}`;
  await writeFile(path.join(storageDir, storageKey), buffer);

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      kind: info.mime.startsWith("image/") ? "image" : "file",
      storageKey,
      mimeType: info.mime,
      size: info.size ?? buffer.length,
      width: info.width,
      height: info.height,
      createdById: userId,
      sourceUrl: info.url,
      author: info.author,
      licenseId: info.licenseId,
      licenseUrl: info.licenseUrl,
      attributionText: info.attributionText,
      retrievedAt: new Date()
    }
  });

  await prisma.sourceRecord.create({
    data: {
      workspaceId,
      targetType: SourceTargetType.asset,
      targetId: asset.id,
      sourceUrl: info.url,
      title: info.title,
      author: info.author,
      licenseId: info.licenseId,
      licenseUrl: info.licenseUrl,
      attributionText: info.attributionText,
      retrievedAt: new Date(),
      createdById: userId
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: userId,
    action: "import",
    targetType: "asset",
    targetId: asset.id,
    meta: { source: "wikipedia", url: info.url }
  });

  return asset;
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
  const publish = parseBooleanValue(form.get("publish"), false);
  const targetLang = String(form.get("targetLang") ?? "").trim();
  const useLlm = parseBooleanValue(form.get("useLlm"), DEFAULT_USE_LLM);
  const aggregateLangs = parseBooleanValue(form.get("aggregateLangs"), DEFAULT_AGGREGATE_LANGS);
  const llmProviderRaw = String(form.get("llmProvider") ?? "").trim();
  const llmProvider = (llmProviderRaw || DEFAULT_LLM_PROVIDER) as LlmProvider;
  const llmModel = String(form.get("llmModel") ?? process.env.WIKI_LLM_MODEL ?? "").trim();
  const codexAuthBase64 = String(form.get("codexAuthBase64") ?? "").trim();
  const llmPrompt = String(form.get("llmPrompt") ?? "").trim();
  const llmPromptTemplateId = String(form.get("llmPromptTemplateId") ?? "").trim();
  const llmPromptTemplateName = String(form.get("llmPromptTemplateName") ?? "").trim();
  const importMedia = parseBooleanValue(form.get("importMedia"), true);
  const mediaLimitRaw = Number(form.get("mediaLimit") ?? DEFAULT_MEDIA_LIMIT);
  const mediaLimit = Math.min(
    Math.max(Number.isFinite(mediaLimitRaw) ? mediaLimitRaw : DEFAULT_MEDIA_LIMIT, 0),
    300
  );
  const mediaMaxRaw = Number(form.get("mediaMaxBytes") ?? DEFAULT_MEDIA_MAX_BYTES);
  const mediaMaxBytes = Math.max(
    Number.isFinite(mediaMaxRaw) ? mediaMaxRaw : DEFAULT_MEDIA_MAX_BYTES,
    0
  );

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
  const imagePlacements = extractWikitextImagePlacements(page.wikitext || "");
  const placementMap = new Map<string, WikitextImagePlacement>();
  for (const placement of imagePlacements) {
    const normalized = normalizeMediaTitle(placement.filename);
    if (!normalized) continue;
    if (!placementMap.has(normalized)) placementMap.set(normalized, placement);
    const stripped = stripExtension(normalized);
    if (!placementMap.has(stripped)) placementMap.set(stripped, placement);
  }

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
    if (DEFAULT_VERIFY_LIMIT > 0) {
      try {
        const baseKey = normalizeTitle(page.title);
        const existingPageIds = new Set(sources.map((source) => source.page.pageId));
        const existingKeys = new Set(
          sources.map((source) => `${source.lang}:${normalizeTitle(source.page.title)}`)
        );
        const results = await searchWiki(page.title, outputLang);
        for (const result of results) {
          if (sources.length >= DEFAULT_LANG_LIMIT + DEFAULT_VERIFY_LIMIT) break;
          if (existingPageIds.has(String(result.pageId))) continue;
          const candidateKey = normalizeTitle(result.title);
          if (!isLikelySameTitle(baseKey, candidateKey)) continue;
          if (existingKeys.has(`${outputLang}:${candidateKey}`)) continue;
          const verificationPage = await fetchWikiPage(outputLang, { pageId: result.pageId });
          if (!verificationPage) continue;
          sources.push({ lang: outputLang, page: verificationPage });
          existingPageIds.add(verificationPage.pageId);
          existingKeys.add(`${outputLang}:${candidateKey}`);
          if (sources.length >= DEFAULT_LANG_LIMIT + DEFAULT_VERIFY_LIMIT) break;
        }
      } catch {
        // ignore verification search failures
      }
    }
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
    const basePrompt = templatePrompt
      ? renderPromptTemplate(templatePrompt, outputLang, sources)
      : buildSynthesisPrompt(outputLang, sources);
    try {
      bodyMd = await generateText({
        provider: llmProvider,
        prompt: basePrompt,
        model: llmModel || undefined,
        codexAuthBase64
      });
      usedLlm = true;
      if (!bodyMd.trim()) {
        bodyMd = pickSourceContent(page);
        usedLlm = false;
      }
      const needsRetry =
        bodyMd.trim().length < DEFAULT_MIN_BODY_CHARS ||
        !/##\s+/.test(bodyMd) ||
        /\[\[.+?\]\]|\{\{.+?\}\}/.test(bodyMd);
      if (needsRetry) {
        const retryPrompt = `${basePrompt}\n\nIMPORTANT: The output was too short or not valid Markdown. Expand to at least ${DEFAULT_MIN_BODY_CHARS} characters, include multiple sections with ## headings, and end with a Sources section.`;
        const retryBody = await generateText({
          provider: llmProvider,
          prompt: retryPrompt,
          model: llmModel || undefined,
          codexAuthBase64
        });
        if (retryBody?.trim()) {
          bodyMd = retryBody;
        }
      }
    } catch (error) {
      return apiError(`LLM synthesis failed: ${(error as Error).message}`, 502);
    }
    bodyMd = ensureMarkdown(bodyMd, outputLang, sources);
  } else if (fallbackUsed && String(process.env.WIKI_IMPORT_REQUIRE_LLM ?? "true") === "true") {
    return apiError("LLM is required to synthesize non-target language sources", 400);
  } else {
    bodyMd = pickSourceContent(page);
  }
  if (!useLlm) {
    const outputLang = targetLang || preferredLang;
    bodyMd = ensureMarkdown(bodyMd, outputLang, sources);
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
      status: publish ? "approved" : "draft",
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

  const importedAssets: ImportedAssetWithMeta[] = [];

  if (importMedia) {
    // Step 1: Gather all media titles from all sources
    const mediaEntries: Array<{ title: string; lang: string }> = [];
    const pageImageTitle = page.pageImageTitle?.replace(/^File:/i, "").trim();
    if (pageImageTitle) {
      mediaEntries.push({ title: pageImageTitle, lang: pageLang });
    }

    const mediaLists = await Promise.all(
      sources.map(async (source) => {
        try {
          const titles = await fetchWikiPageMedia(source.lang, source.page.pageId);
          return titles.map((title) => ({ title, lang: source.lang }));
        } catch {
          return [] as Array<{ title: string; lang: string }>;
        }
      })
    );
    mediaEntries.push(...mediaLists.flat());

    // Deduplicate
    const seen = new Set<string>();
    const deduped = mediaEntries.filter((entry) => {
      const key = entry.title.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Step 2: Pre-filter obvious UI elements
    const prefiltered = deduped.filter((entry) => !shouldSkipMediaTitle(entry.title));
    const pageTitleKeywords = extractTitleKeywords(page.title);
    const commonsThreshold = Math.max(DEFAULT_GALLERY_MIN_COUNT * 2, 6);
    if (prefiltered.length < commonsThreshold) {
      const commonsLimit = Math.min(
        12,
        Math.max(0, DEFAULT_MEDIA_LIMIT - prefiltered.length)
      );
      if (commonsLimit > 0) {
        const commonsTitles = await fetchCommonsSearchImages(page.title, commonsLimit);
        for (const title of commonsTitles) {
          if (shouldSkipMediaTitle(title)) continue;
          const normalizedKey = title.toLowerCase();
          if (seen.has(normalizedKey)) continue;
          if (pageTitleKeywords.length) {
            const normalized = normalizeMediaTitle(title);
            if (!pageTitleKeywords.some((keyword) => normalized.includes(keyword))) {
              continue;
            }
          }
          seen.add(normalizedKey);
          prefiltered.push({ title, lang: "commons" });
        }
      }
    }
    const limited = mediaLimit > 0 ? prefiltered.slice(0, mediaLimit) : prefiltered;

    // Step 3: Fetch media info for all candidates
    const mediaInfoList: Array<{
      entry: { title: string; lang: string };
      info: Awaited<ReturnType<typeof fetchWikiImageInfo>>;
    }> = [];

    for (const entry of limited) {
      try {
        let info = await fetchWikiImageInfo(entry.lang, entry.title);
        if (!info && entry.lang !== "commons") {
          info = await fetchWikiImageInfo("commons", entry.title);
        }
        if (info && (!mediaMaxBytes || !info.size || info.size <= mediaMaxBytes)) {
          const normalized = normalizeMediaTitle(info.title);
          const placementHit =
            placementMap.has(normalized) || placementMap.has(stripExtension(normalized));
          if (!shouldSkipMediaInfo(info) || placementHit) {
            mediaInfoList.push({ entry, info });
          }
        }
      } catch {
        // ignore failed media info
      }
    }

    const mediaInfoThreshold = Math.max(DEFAULT_GALLERY_MIN_COUNT * 2, 6);
    if (mediaInfoList.length < mediaInfoThreshold) {
      const commonsLimit = Math.min(
        12,
        Math.max(0, DEFAULT_MEDIA_LIMIT - mediaInfoList.length)
      );
      if (commonsLimit > 0) {
        const pageTitleKeywords = extractTitleKeywords(page.title);
        const existingMediaKeys = new Set(
          mediaInfoList
            .map(({ info }) => info?.title)
            .filter(Boolean)
            .map((title) => normalizeMediaTitle(String(title)))
        );
        const commonsTitles = await fetchCommonsSearchImages(page.title, commonsLimit);
        for (const title of commonsTitles) {
          if (shouldSkipMediaTitle(title)) continue;
          const normalized = normalizeMediaTitle(title);
          if (existingMediaKeys.has(normalized) || existingMediaKeys.has(stripExtension(normalized))) {
            continue;
          }
          if (pageTitleKeywords.length) {
            if (!pageTitleKeywords.some((keyword) => normalized.includes(keyword))) {
              continue;
            }
          }
          try {
            const info = await fetchWikiImageInfo("commons", title);
            if (info && (!mediaMaxBytes || !info.size || info.size <= mediaMaxBytes)) {
              if (!shouldSkipMediaInfo(info)) {
                mediaInfoList.push({ entry: { title, lang: "commons" }, info });
                existingMediaKeys.add(normalized);
                existingMediaKeys.add(stripExtension(normalized));
              }
            }
          } catch {
            // ignore failed media info
          }
        }
      }
    }

    // Step 4: Use LLM to analyze media relevance
    let analysisResults: MediaRelevanceResult[] = [];

    if (useLlm && mediaInfoList.length > 0) {
      const mediaAnalysisItems: MediaAnalysisItem[] = mediaInfoList.map(({ info }) => ({
        title: info!.title,
        mime: info!.mime,
        width: info!.width,
        height: info!.height,
        size: info!.size
      }));

      const wikitext = page.wikitext || "";

      // Build and execute analysis prompt
      const analysisPrompt = buildMediaAnalysisPrompt(
        page.title,
        typeValue,
        mediaAnalysisItems,
        wikitext,
        imagePlacements
      );

      try {
        const analysisResponse = await generateText({
          provider: llmProvider,
          prompt: analysisPrompt,
          model: llmModel || undefined,
          codexAuthBase64
        });
        analysisResults = parseMediaAnalysisResponse(analysisResponse);
      } catch {
        // If LLM analysis fails, fall back to importing main image only
        analysisResults = mediaAnalysisItems.slice(0, 5).map((item, i) => ({
          title: item.title,
          relevant: i === 0, // Only first item (usually main image)
          reason: i === 0 ? "Primary image" : "Fallback - LLM analysis failed",
          placement: i === 0 ? "infobox" as const : "exclude" as const,
          priority: i + 1
        }));
      }
    } else if (mediaInfoList.length > 0) {
      // No LLM: just use basic heuristics - take first 5 images
      analysisResults = mediaInfoList.slice(0, 5).map(({ info }, i) => ({
        title: info!.title,
        relevant: true,
        reason: "No LLM analysis",
        placement: i === 0 ? "infobox" as const : "gallery" as const,
        priority: i + 1
      }));
    }

    if (analysisResults.length === 0 && mediaInfoList.length > 0) {
      // If LLM returns no usable result, fall back to heuristic selection.
      analysisResults = mediaInfoList.slice(0, 5).map(({ info }, i) => ({
        title: info!.title,
        relevant: i === 0 || i < 5,
        reason: "Fallback - no LLM result",
        placement: i === 0 ? "infobox" as const : "gallery" as const,
        priority: i + 1
      }));
    }

    // Ensure audio/video get placed in infobox even when LLM misses them
    const analysisLookup = new Map<string, MediaRelevanceResult>();
    for (const result of analysisResults) {
      const normalized = normalizeMediaTitle(result.title);
      if (!normalized) continue;
      analysisLookup.set(normalized, result);
      analysisLookup.set(stripExtension(normalized), result);
    }
    const ensureInfoboxMedia = (mimePrefix: string, reason: string) => {
      const candidates = mediaInfoList
        .map(({ info }) => info)
        .filter((info): info is NonNullable<typeof info> => Boolean(info))
        .filter((info) => info.mime?.startsWith(mimePrefix));
      if (!candidates.length) return;

      let hasInfobox = false;
      for (const candidate of candidates) {
        const key = normalizeMediaTitle(candidate.title);
        const existing =
          (key && (analysisLookup.get(key) ?? analysisLookup.get(stripExtension(key)))) || null;
        if (existing) {
          if (existing.relevant && existing.placement === "infobox") {
            hasInfobox = true;
            break;
          }
          if (existing.relevant && existing.placement !== "infobox") {
            existing.placement = "infobox";
            existing.reason = existing.reason || reason;
            existing.priority = Math.min(existing.priority || 1, 1);
            hasInfobox = true;
            break;
          }
        }
      }

      if (hasInfobox) return;
      const fallback = candidates[0];
      const fallbackResult: MediaRelevanceResult = {
        title: fallback.title,
        relevant: true,
        reason,
        placement: "infobox",
        suggestedCaption: fallback.title,
        priority: 1
      };
      analysisResults.push(fallbackResult);
      const normalized = normalizeMediaTitle(fallback.title);
      if (normalized) {
        analysisLookup.set(normalized, fallbackResult);
        analysisLookup.set(stripExtension(normalized), fallbackResult);
      }
    };
    ensureInfoboxMedia("audio/", "Auto-selected audio for infobox");
    ensureInfoboxMedia("video/", "Auto-selected video for infobox");

    // Promote images referenced in wikitext placements
    for (const [key, placement] of placementMap) {
      const existing =
        analysisLookup.get(key) ?? analysisLookup.get(stripExtension(key)) ?? null;
      if (existing) {
        if (!existing.relevant || existing.placement === "exclude") {
          existing.relevant = true;
        }
        existing.placement = placement.isInfobox ? "infobox" : "inline";
        if (!existing.suggestedCaption && placement.caption) {
          existing.suggestedCaption = placement.caption;
        }
        if (!existing.inlineSection && !placement.isInfobox) {
          existing.inlineSection = placement.section;
        }
        existing.priority = Math.min(existing.priority || 3, placement.isInfobox ? 1 : 3);
        continue;
      }
      analysisResults.push({
        title: placement.filename,
        relevant: true,
        reason: "Referenced in article wikitext",
        placement: placement.isInfobox ? "infobox" : "inline",
        suggestedCaption: placement.caption || placement.filename,
        priority: placement.isInfobox ? 1 : 3,
        inlineSection: placement.isInfobox ? undefined : placement.section
      });
    }

    // If we have too few gallery images, include reference/diagram assets by title
    const galleryCount = analysisResults.filter(
      (item) => item.relevant && item.placement === "gallery"
    ).length;
    if (galleryCount < DEFAULT_GALLERY_MIN_COUNT) {
      for (const { info } of mediaInfoList) {
        if (!info) continue;
        if (!info.mime.startsWith("image/")) continue;
        if (!isReferenceMediaTitle(info.title)) continue;
        const normalized = normalizeMediaTitle(info.title);
        const existing = analysisLookup.get(normalized) ?? analysisLookup.get(stripExtension(normalized));
        if (existing) {
          if (!existing.relevant || existing.placement === "exclude") {
            existing.relevant = true;
          }
          if (existing.placement === "exclude") {
            existing.placement = "gallery";
          }
          if (existing.placement !== "infobox" && existing.placement !== "inline") {
            existing.placement = "gallery";
          }
          existing.reason = existing.reason || "Reference diagram/title match";
          continue;
        }
        analysisResults.push({
          title: info.title,
          relevant: true,
          reason: "Reference diagram/title match",
          placement: "gallery",
          suggestedCaption: info.title,
          priority: 4
        });
        analysisLookup.set(normalized, analysisResults[analysisResults.length - 1]);
        analysisLookup.set(stripExtension(normalized), analysisResults[analysisResults.length - 1]);
      }
    }

    // If gallery is still too small, add top images by size as a final fallback
    let finalGalleryCount = analysisResults.filter(
      (item) => item.relevant && item.placement === "gallery"
    ).length;
    if (finalGalleryCount < DEFAULT_GALLERY_MIN_COUNT) {
      const titleKeywords = extractTitleKeywords(page.title);
      const candidates = mediaInfoList
        .map(({ info }) => info)
        .filter((info): info is NonNullable<typeof info> => Boolean(info))
        .filter((info) => info.mime?.startsWith("image/"))
        .sort((a, b) => {
          const aScore = a.size ?? ((a.width ?? 0) * (a.height ?? 0));
          const bScore = b.size ?? ((b.width ?? 0) * (b.height ?? 0));
          return bScore - aScore;
        });

      const matchByTitle = (info: MediaInfo) => {
        if (!titleKeywords.length) return true;
        const normalized = normalizeMediaTitle(info.title);
        return titleKeywords.some((token) => normalized.includes(token));
      };

      const fallbackPool = candidates.filter(matchByTitle);
      const pool = fallbackPool.length ? fallbackPool : candidates;

      for (const info of pool) {
        if (finalGalleryCount >= DEFAULT_GALLERY_MIN_COUNT) break;
        const normalized = normalizeMediaTitle(info.title);
        const existing = analysisLookup.get(normalized) ?? analysisLookup.get(stripExtension(normalized));
        if (existing) {
          if (existing.placement === "infobox" || existing.placement === "inline") continue;
          if (!existing.relevant || existing.placement === "exclude") {
            existing.relevant = true;
          }
          if (existing.placement !== "gallery") {
            existing.placement = "gallery";
          }
          existing.reason = existing.reason || "Fallback - gallery fill";
          existing.priority = Math.min(existing.priority || 5, 5);
        } else {
          analysisResults.push({
            title: info.title,
            relevant: true,
            reason: "Fallback - gallery fill",
            placement: "gallery",
            suggestedCaption: info.title,
            priority: 5
          });
          const inserted = analysisResults[analysisResults.length - 1];
          analysisLookup.set(normalized, inserted);
          analysisLookup.set(stripExtension(normalized), inserted);
        }
        finalGalleryCount += 1;
      }
    }

    // Create a map for quick lookup (normalize titles & strip extensions)
    const analysisMap = new Map<string, MediaRelevanceResult>();
    for (const result of analysisResults) {
      const normalized = normalizeMediaTitle(result.title);
      if (!normalized) continue;
      analysisMap.set(normalized, result);
      analysisMap.set(stripExtension(normalized), result);
    }

    // Step 5: Import only relevant media
    let mainImageId: string | null = null;
    const infoboxAudio: Array<{ assetId: string; caption: string }> = [];
    const infoboxVideo: Array<{ assetId: string; caption: string }> = [];

    for (const { entry, info } of mediaInfoList) {
      if (!info) continue;

      const normalizedTitle = normalizeMediaTitle(info.title);
      const analysis =
        analysisMap.get(normalizedTitle) ??
        analysisMap.get(stripExtension(normalizedTitle));
      if (!analysis || !analysis.relevant || analysis.placement === "exclude") {
        continue;
      }

      try {
        const asset = await importWikiAsset(workspaceId, session.userId, info);
        if (!asset) continue;

        importedAssets.push({
          id: asset.id,
          title: info.title,
          mimeType: asset.mimeType,
          placement: analysis.placement,
          caption: analysis.suggestedCaption,
          inlineSection: analysis.inlineSection,
          priority: analysis.priority
        });

        // Handle infobox media
        if (analysis.placement === "infobox") {
          if (info.mime.startsWith("image/") && !mainImageId) {
            mainImageId = asset.id;
          } else if (info.mime.startsWith("audio/")) {
            infoboxAudio.push({
              assetId: asset.id,
              caption: analysis.suggestedCaption || info.title
            });
          } else if (info.mime.startsWith("video/")) {
            infoboxVideo.push({
              assetId: asset.id,
              caption: analysis.suggestedCaption || info.title
            });
          }
        }
      } catch {
        // ignore failed media import
      }
    }

    // Update entity with main image and infobox media
    if (mainImageId || infoboxAudio.length > 0 || infoboxVideo.length > 0) {
      const updateData: { mainImageId?: string; infoboxMediaJson?: string } = {};
      if (mainImageId) {
        updateData.mainImageId = mainImageId;
      }
      if (infoboxAudio.length > 0 || infoboxVideo.length > 0) {
        updateData.infoboxMediaJson = JSON.stringify({
          audio: infoboxAudio,
          video: infoboxVideo
        });
      }
      await prisma.entity.update({
        where: { id: entity.id },
        data: updateData
      });
    }

    const galleryAssets = importedAssets.filter((asset) => asset.placement === "gallery");
    const remainingMediaSlots =
      mediaLimit > 0 ? Math.max(0, mediaLimit - importedAssets.length) : 0;
    if (galleryAssets.length < DEFAULT_GALLERY_MIN_COUNT && remainingMediaSlots > 0) {
      const needed = Math.min(
        DEFAULT_GALLERY_MIN_COUNT - galleryAssets.length,
        remainingMediaSlots,
        6
      );
      const pageTitleKeywords = extractTitleKeywords(page.title);
      const existingTitles = new Set(
        importedAssets.map((asset) => normalizeMediaTitle(asset.title))
      );
      const commonsTitles = await fetchCommonsSearchImages(page.title, Math.max(needed * 2, 8));
      let added = 0;
      for (const title of commonsTitles) {
        if (added >= needed) break;
        if (shouldSkipMediaTitle(title)) continue;
        const normalized = normalizeMediaTitle(title);
        if (existingTitles.has(normalized) || existingTitles.has(stripExtension(normalized))) {
          continue;
        }
        if (pageTitleKeywords.length) {
          if (!pageTitleKeywords.some((keyword) => normalized.includes(keyword))) {
            continue;
          }
        }
        try {
          const info = await fetchWikiImageInfo("commons", title);
          if (!info) continue;
          if (mediaMaxBytes && info.size && info.size > mediaMaxBytes) continue;
          if (shouldSkipMediaInfo(info)) continue;
          const asset = await importWikiAsset(workspaceId, session.userId, info);
          if (!asset) continue;
          importedAssets.push({
            id: asset.id,
            title: info.title,
            mimeType: asset.mimeType,
            placement: "gallery",
            caption: info.title,
            priority: 6
          });
          existingTitles.add(normalized);
          existingTitles.add(stripExtension(normalized));
          added += 1;
        } catch {
          // ignore failed commons fallback import
        }
      }
    }
  }

  // Sort imported assets by priority and append to markdown
  if (importedAssets.length) {
    importedAssets.sort((a, b) => a.priority - b.priority);
    bodyMd = appendMediaToMarkdown(bodyMd, importedAssets);
  }

  const revision = await prisma.articleRevision.create({
    data: {
      workspaceId,
      targetType: "base",
      articleId: article.entityId,
      bodyMd,
      changeSummary: usedLlm
        ? `Summarized from Wikipedia (${sources.length} sources)`
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

  const redirectPath = `${toWikiPath(entity.title)}?id=${entity.id}`;
  return NextResponse.redirect(toRedirectUrl(request, redirectPath));
}

export type WikiPage = {
  pageId: string;
  title: string;
  url: string;
  lang: string;
  extract?: string;
  wikitext?: string;
  thumbnail?: { source: string; width: number; height: number } | null;
  pageImageTitle?: string | null;
};

export type WikiLangLink = { lang: string; title: string };
export type WikiImageInfo = {
  title: string;
  url: string;
  mime: string;
  size?: number;
  width?: number;
  height?: number;
  author?: string | null;
  licenseId?: string | null;
  licenseUrl?: string | null;
  attributionText?: string | null;
};

const DEFAULT_LANG = "en";

export function normalizeLang(lang: string) {
  return (lang || "").trim().toLowerCase();
}

export function toWikiPath(title: string) {
  const slug = title.trim().replace(/ /g, "_");
  return `/wiki/${encodeURIComponent(slug)}`;
}

export function parseWikiPageInput(input: string, fallbackLang: string | null) {
  const raw = input.trim();
  if (!raw) return null;

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const url = new URL(raw);
      const hostParts = url.hostname.split(".");
      const lang = hostParts.length >= 3 ? hostParts[0] : fallbackLang ?? DEFAULT_LANG;
      const title = decodeURIComponent(url.pathname.replace(/^\/wiki\//, "")).replace(/_/g, " ");
      return { lang: normalizeLang(lang), title };
    }
  } catch {
    // ignore URL parse errors
  }

  const langMatch = raw.match(/^([a-z]{2,3})\s*:\s*(.+)$/i);
  if (langMatch) {
    return { lang: normalizeLang(langMatch[1]), title: langMatch[2].trim() };
  }

  return { lang: normalizeLang(fallbackLang ?? DEFAULT_LANG), title: raw };
}

function buildWikiApiUrl(lang: string, params: Record<string, string>) {
  const host = lang === "commons" ? "commons.wikimedia.org" : `${lang}.wikipedia.org`;
  const url = new URL(`https://${host}/w/api.php`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

export async function fetchWikiPage(
  langInput: string | null,
  { pageId, title }: { pageId?: string; title?: string }
): Promise<WikiPage | null> {
  const lang = normalizeLang(langInput || DEFAULT_LANG) || DEFAULT_LANG;
  if (!pageId && !title) return null;

  const params: Record<string, string> = {
    action: "query",
    format: "json",
    origin: "*",
    prop: "extracts|revisions|info|pageimages",
    explaintext: "1",
    exintro: "0",
    inprop: "url",
    rvprop: "content",
    rvslots: "main",
    piprop: "thumbnail|name",
    pithumbsize: "800"
  };

  if (pageId) {
    params.pageids = pageId;
  } else if (title) {
    params.titles = title;
  }

  const url = buildWikiApiUrl(lang, params);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikipedia request failed (${response.status})`);
  }
  const data = await response.json();
  if (data?.error?.info) {
    throw new Error(data.error.info);
  }
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0] as any;
  if (!page || page.missing) return null;

  const wikitext =
    page?.revisions?.[0]?.slots?.main?.["*"] ??
    page?.revisions?.[0]?.["*"] ??
    "";

  return {
    pageId: String(page.pageid),
    title: page.title,
    url: page.fullurl,
    lang,
    extract: page.extract,
    wikitext: wikitext || undefined,
    thumbnail: page.thumbnail
      ? { source: page.thumbnail.source, width: page.thumbnail.width, height: page.thumbnail.height }
      : null,
    pageImageTitle: page.pageimage ? String(page.pageimage) : null
  };
}

export async function fetchWikiPageMedia(langInput: string | null, pageId: string): Promise<string[]> {
  const lang = normalizeLang(langInput || DEFAULT_LANG) || DEFAULT_LANG;
  if (!pageId) return [];

  let titles: string[] = [];
  let imContinue: string | null = null;

  do {
    const params: Record<string, string> = {
      action: "query",
      format: "json",
      origin: "*",
      prop: "images",
      imlimit: "500",
      pageids: pageId
    };
    if (imContinue) {
      params.imcontinue = imContinue;
    }

    const url = buildWikiApiUrl(lang, params);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Wikipedia request failed (${response.status})`);
    }
    const data = await response.json();
    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    const images = page?.images ?? [];
    titles = titles.concat(
      images
        .map((image: any) => String(image.title || ""))
        .filter(Boolean)
        .map((title: string) => title.replace(/^File:/i, "").trim())
        .filter(Boolean)
    );
    imContinue = data?.continue?.imcontinue ?? null;
  } while (imContinue);

  return Array.from(new Set(titles));
}

export async function fetchWikiLangLinks(lang: string, pageId: string): Promise<WikiLangLink[]> {
  if (!pageId) return [];
  const url = buildWikiApiUrl(normalizeLang(lang || DEFAULT_LANG) || DEFAULT_LANG, {
    action: "query",
    format: "json",
    origin: "*",
    prop: "langlinks",
    lllimit: "50",
    pageids: pageId
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikipedia request failed (${response.status})`);
  }
  const data = await response.json();
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0] as any;
  const links = page?.langlinks ?? [];
  return links.map((link: any) => ({
    lang: normalizeLang(link.lang),
    title: link["*"] || link.title
  }));
}

export async function resolveWikiPageWithFallback(
  preferredLang: string,
  input: { pageId?: string; title?: string },
  fallbackLangs: string[]
) {
  const primary = await fetchWikiPage(preferredLang, input);
  if (primary) return { lang: normalizeLang(preferredLang), page: primary };

  for (const lang of fallbackLangs) {
    const candidate = await fetchWikiPage(lang, input);
    if (candidate) return { lang: normalizeLang(lang), page: candidate };
  }
  return null;
}

export function buildWikiAttribution(title: string, url: string) {
  return {
    author: "Wikipedia contributors",
    licenseId: "CC-BY-SA-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    attributionText: `${title} — Wikipedia contributors (${url})`
  };
}

export function safeFilename(value: string) {
  return value.replace(/[^\w.\-()]+/g, "_");
}

export function parseWikiImageInput(input: string, fallbackLang: string | null) {
  const raw = input.trim();
  if (!raw) return null;

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const url = new URL(raw);
      const hostParts = url.hostname.split(".");
      const isCommons = url.hostname.includes("commons.wikimedia.org");
      const lang = isCommons ? "commons" : (hostParts.length >= 3 ? hostParts[0] : fallbackLang ?? DEFAULT_LANG);
      const title = decodeURIComponent(url.pathname.replace(/^\/wiki\//, "")).replace(/_/g, " ");
      return { lang: normalizeLang(lang), title: title.replace(/^File:/i, "").trim() };
    }
  } catch {
    // ignore URL parse errors
  }

  const normalized = raw.replace(/^File:/i, "").replace(/^Image:/i, "").trim();
  return { lang: normalizeLang(fallbackLang ?? DEFAULT_LANG), title: normalized };
}

export async function fetchWikiImageInfo(langInput: string | null, title: string): Promise<WikiImageInfo | null> {
  const lang = normalizeLang(langInput || DEFAULT_LANG) || DEFAULT_LANG;
  const apiUrl = buildWikiApiUrl(lang === "commons" ? "commons" : lang, {
    action: "query",
    format: "json",
    origin: "*",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    titles: `File:${title}`
  });

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Wikipedia image request failed (${response.status})`);
  }
  const data = await response.json();
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0] as any;
  const info = page?.imageinfo?.[0];
  if (!info?.url) return null;

  const metadata = info.extmetadata ?? {};
  const author = metadata.Artist?.value ?? metadata.Author?.value ?? null;
  const licenseId = metadata.LicenseShortName?.value ?? metadata.License?.value ?? null;
  const licenseUrl = metadata.LicenseUrl?.value ?? null;
  const attributionText =
    metadata.Attribution?.value ??
    metadata.Credit?.value ??
    metadata.ImageDescription?.value ??
    null;

  return {
    title: page.title?.replace(/^File:/i, "") || title,
    url: info.url,
    mime: info.mime || "application/octet-stream",
    size: info.size,
    width: info.width,
    height: info.height,
    author,
    licenseId,
    licenseUrl,
    attributionText
  };
}

export async function searchWiki(query: string, langInput: string | null) {
  const lang = normalizeLang(langInput || DEFAULT_LANG) || DEFAULT_LANG;
  const baseUrl =
    lang === "commons"
      ? "https://commons.wikimedia.org/wiki/"
      : `https://${lang}.wikipedia.org/wiki/`;
  const url = buildWikiApiUrl(lang, {
    action: "query",
    format: "json",
    origin: "*",
    list: "search",
    srsearch: query,
    srlimit: "10"
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikipedia search failed (${response.status})`);
  }
  const data = await response.json();
  const results = data?.query?.search ?? [];
  return results.map((item: any) => ({
    pageId: String(item.pageid),
    title: item.title,
    snippet: item.snippet,
    url: `${baseUrl}${encodeURIComponent(String(item.title || "").replace(/ /g, "_"))}`
  }));
}

// ==========================================
// Wikitext Structure Analysis
// ==========================================

export type WikitextImagePlacement = {
  filename: string;
  section: string;
  options: string;
  position: number;
  isInfobox: boolean;
  size?: string;
  alignment?: "left" | "right" | "center" | "none";
  caption?: string;
};

/**
 * Extract image placement information from wikitext
 */
export function extractWikitextImagePlacements(wikitext: string): WikitextImagePlacement[] {
  if (!wikitext) return [];

  const placements: WikitextImagePlacement[] = [];
  // Match [[File:...]] or [[Image:...]] patterns
  const imagePattern = /\[\[(File|Image):([^\]|]+)(?:\|([^\]]*))?\]\]/gi;
  let match;

  // Track current section
  const sectionPattern = /==+\s*([^=]+)\s*==+/g;
  const sections: Array<{ title: string; start: number }> = [{ title: "intro", start: 0 }];
  let sectionMatch;
  while ((sectionMatch = sectionPattern.exec(wikitext)) !== null) {
    sections.push({
      title: sectionMatch[1].trim(),
      start: sectionMatch.index
    });
  }

  // Check if we're inside an infobox
  const infoboxStart = wikitext.search(/\{\{[Ii]nfobox/);
  const infoboxEnd = infoboxStart >= 0 ? findMatchingBrace(wikitext, infoboxStart) : -1;

  while ((match = imagePattern.exec(wikitext)) !== null) {
    const filename = match[2].trim();
    const options = match[3] || "";
    const position = match.index;

    // Find which section this image is in
    let section = "intro";
    for (let i = sections.length - 1; i >= 0; i--) {
      if (position >= sections[i].start) {
        section = sections[i].title;
        break;
      }
    }

    // Check if inside infobox
    const isInfobox = infoboxStart >= 0 && position >= infoboxStart && position <= infoboxEnd;

    // Parse options for size and alignment
    const optionParts = options.split("|").map((o) => o.trim());
    let size: string | undefined;
    let alignment: "left" | "right" | "center" | "none" | undefined;
    let caption: string | undefined;

    for (const opt of optionParts) {
      if (/^\d+px$/i.test(opt) || /^\d+x\d+px$/i.test(opt)) {
        size = opt;
      } else if (["left", "right", "center", "none"].includes(opt.toLowerCase())) {
        alignment = opt.toLowerCase() as "left" | "right" | "center" | "none";
      } else if (opt === "thumb" || opt === "thumbnail" || opt === "frame" || opt === "frameless") {
        // These are display type options, not caption
      } else if (opt && !["upright", "border", "alt="].some((k) => opt.startsWith(k))) {
        // Last non-keyword option is usually the caption
        caption = opt;
      }
    }

    placements.push({
      filename,
      section,
      options,
      position,
      isInfobox,
      size,
      alignment,
      caption
    });
  }

  return placements;
}

/**
 * Find matching closing brace for a template
 */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i++;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

// ==========================================
// Media Analysis Types and Prompts
// ==========================================

export type MediaAnalysisItem = {
  title: string;
  mime: string;
  width?: number;
  height?: number;
  size?: number;
};

export type MediaRelevanceResult = {
  title: string;
  relevant: boolean;
  reason: string;
  placement: "infobox" | "inline" | "gallery" | "exclude";
  suggestedCaption?: string;
  priority: number; // 1 = highest
  inlineSection?: string; // Which section to place inline images
};

export type MediaAnalysisResult = {
  media: MediaRelevanceResult[];
  infoboxMedia: {
    mainImage?: { title: string; caption: string };
    audio: Array<{ title: string; caption: string }>;
    video: Array<{ title: string; caption: string }>;
  };
};

/**
 * Build LLM prompt for media relevance analysis
 */
export function buildMediaAnalysisPrompt(
  pageTitle: string,
  entityType: string,
  mediaList: MediaAnalysisItem[],
  wikitextSnippet: string,
  imagePlacements: WikitextImagePlacement[]
): string {
  const mediaListStr = mediaList
    .map((m, i) => `${i + 1}. "${m.title}" (${m.mime}${m.width ? `, ${m.width}x${m.height}` : ""})`)
    .join("\n");

  const placementsStr = imagePlacements
    .slice(0, 20)
    .map((p) => `- "${p.filename}" in ${p.isInfobox ? "infobox" : `section "${p.section}"`}${p.caption ? `: "${p.caption}"` : ""}`)
    .join("\n");

  return `You are analyzing media files from a Wikipedia article to determine their relevance for a worldbuilding reference database.

SUBJECT: "${pageTitle}"
ENTITY TYPE: ${entityType}

AVAILABLE MEDIA FILES:
${mediaListStr}

ORIGINAL WIKIPEDIA IMAGE PLACEMENTS:
${placementsStr || "(none detected)"}

WIKITEXT EXCERPT (for context):
${wikitextSnippet.slice(0, 2000)}

TASK: Analyze each media file and determine:
1. Is it relevant to the subject? (directly shows or describes "${pageTitle}")
2. Where should it be placed?
3. What priority? (1 = most important, 5 = least)

PLACEMENT RULES:
- "infobox": Main representative image, audio clips (sounds, voice samples), short videos demonstrating the subject
- "inline": Images that belong near specific text sections (diagrams, historical photos, technical details)
- "gallery": Additional reference images useful for artists/modelers
- "exclude": Country flags, national emblems, political icons, UI elements, Wikipedia icons, location maps showing operators/users, portraits of unrelated people, generic symbols

BE STRICT: Only mark as relevant if the media DIRECTLY shows or describes "${pageTitle}".
Flags of countries that used/operated the subject are NOT relevant.
Maps showing distribution/operators are NOT relevant.
Only the actual subject matter is relevant.

RESPOND WITH VALID JSON ONLY (no markdown, no explanation):
{
  "media": [
    {
      "title": "exact filename from list",
      "relevant": true,
      "reason": "brief explanation",
      "placement": "infobox",
      "suggestedCaption": "Caption for display",
      "priority": 1,
      "inlineSection": "optional section name for inline placement"
    }
  ]
}`;
}

/**
 * Parse LLM response for media analysis
 */
export function parseMediaAnalysisResponse(response: string): MediaRelevanceResult[] {
  // Try to extract JSON from the response
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try to find JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const mediaItems = Array.isArray(parsed)
      ? parsed
      : (parsed.media && Array.isArray(parsed.media) ? parsed.media : []);
    if (mediaItems.length) {
      return mediaItems.map((item: any) => ({
        title: String(item.title || ""),
        relevant: Boolean(item.relevant),
        reason: String(item.reason || ""),
        placement: ["infobox", "inline", "gallery", "exclude"].includes(item.placement)
          ? item.placement
          : "exclude",
        suggestedCaption: item.suggestedCaption ? String(item.suggestedCaption) : undefined,
        priority: typeof item.priority === "number" ? item.priority : 5,
        inlineSection: item.inlineSection ? String(item.inlineSection) : undefined
      }));
    }
  } catch {
    // Failed to parse
  }

  return [];
}

/**
 * Categorize analyzed media into infobox components
 */
export function categorizeMediaForInfobox(
  analysisResults: MediaRelevanceResult[],
  mediaList: MediaAnalysisItem[]
): MediaAnalysisResult["infoboxMedia"] {
  const result: MediaAnalysisResult["infoboxMedia"] = {
    audio: [],
    video: []
  };

  // Create a map for quick lookup
  const mediaMap = new Map(mediaList.map((m) => [m.title.toLowerCase(), m]));

  // Sort by priority
  const sortedResults = [...analysisResults]
    .filter((r) => r.relevant && r.placement !== "exclude")
    .sort((a, b) => a.priority - b.priority);

  for (const item of sortedResults) {
    const mediaInfo = mediaMap.get(item.title.toLowerCase());
    if (!mediaInfo) continue;

    const mime = mediaInfo.mime.toLowerCase();

    if (mime.startsWith("audio/")) {
      result.audio.push({
        title: item.title,
        caption: item.suggestedCaption || item.title
      });
    } else if (mime.startsWith("video/")) {
      result.video.push({
        title: item.title,
        caption: item.suggestedCaption || item.title
      });
    } else if (mime.startsWith("image/") && item.placement === "infobox" && !result.mainImage) {
      result.mainImage = {
        title: item.title,
        caption: item.suggestedCaption || item.title
      };
    }
  }

  return result;
}

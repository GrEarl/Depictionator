export type WikiPage = {
  pageId: string;
  title: string;
  url: string;
  lang: string;
  extract?: string;
  wikitext?: string;
  thumbnail?: { source: string; width: number; height: number } | null;
};

export type WikiLangLink = { lang: string; title: string };

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
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

export async function fetchWikiPage(
  langInput: string | null,
  { pageId, title }: { pageId?: string; title?: string }
): Promise<WikiPage | null> {
  const lang = normalizeLang(langInput || DEFAULT_LANG) || DEFAULT_LANG;
  if (!pageId && !title) return null;

  const url = buildWikiApiUrl(lang, {
    action: "query",
    format: "json",
    origin: "*",
    prop: "extracts|revisions|info|pageimages",
    explaintext: "1",
    exintro: "0",
    inprop: "url",
    rvprop: "content",
    rvslots: "main",
    piprop: "thumbnail",
    pithumbsize: "800",
    titles: title || "",
    pageids: pageId || ""
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikipedia request failed (${response.status})`);
  }
  const data = await response.json();
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
      : null
  };
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

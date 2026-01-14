type WikiSearchResult = {
  pageId: number;
  title: string;
  snippet: string;
  url: string;
};

type WikiPageResult = {
  pageId: number;
  title: string;
  url: string;
  extract: string;
  wikitext: string;
  images: string[];
};

type WikiImageInfo = {
  title: string;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  size: number | null;
  author: string | null;
  licenseId: string | null;
  licenseUrl: string | null;
  attributionText: string | null;
};

const DEFAULT_WIKI_LANG = process.env.WIKI_DEFAULT_LANG ?? "en";

const WIKI_AUTHOR = "Wikipedia contributors";
const WIKI_LICENSE_ID = "CC BY-SA 4.0";
const WIKI_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

function normalizeLang(lang?: string | null): string {
  const raw = (lang ?? "").trim().toLowerCase();
  if (raw === "commons") return "commons";
  if (raw && /^[a-z]{2,3}(-[a-z0-9]+)?$/.test(raw)) return raw;
  return DEFAULT_WIKI_LANG;
}

function baseWikiUrl(lang: string): string {
  if (lang === "commons") return "https://commons.wikimedia.org";
  return `https://${lang}.wikipedia.org`;
}

function apiUrl(lang: string): string {
  return `${baseWikiUrl(lang)}/w/api.php`;
}

function pageUrl(lang: string, title: string): string {
  const normalized = title.replace(/ /g, "_");
  return `${baseWikiUrl(lang)}/wiki/${encodeURIComponent(normalized)}`;
}

function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/<[^>]+>/g, "").replace(/\\s+/g, " ").trim();
}

async function fetchWikiJson<T>(lang: string, params: Record<string, string>): Promise<T> {
  const url = new URL(apiUrl(lang));
  const search = new URLSearchParams({ format: "json", origin: "*", ...params });
  url.search = search.toString();
  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    throw new Error(`Wiki request failed ${response.status}`);
  }
  return (await response.json()) as T;
}

export function buildWikiAttribution(title: string, url: string) {
  const attributionText = `Title: ${title} | Author: ${WIKI_AUTHOR} | Source: ${url} | License: ${WIKI_LICENSE_ID}`;
  return {
    author: WIKI_AUTHOR,
    licenseId: WIKI_LICENSE_ID,
    licenseUrl: WIKI_LICENSE_URL,
    attributionText
  };
}

export async function searchWiki(query: string, lang?: string | null): Promise<WikiSearchResult[]> {
  const resolvedLang = normalizeLang(lang);
  const data = await fetchWikiJson<{
    query?: { search?: { pageid: number; title: string; snippet: string }[] };
  }>(resolvedLang, {
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "10",
    srprop: "snippet"
  });

  const results = data.query?.search ?? [];
  return results.map((result) => ({
    pageId: result.pageid,
    title: result.title,
    snippet: stripHtml(result.snippet),
    url: pageUrl(resolvedLang, result.title)
  }));
}

export async function fetchWikiPage(
  lang: string | null | undefined,
  input: { pageId?: string; title?: string }
): Promise<WikiPageResult | null> {
  const resolvedLang = normalizeLang(lang);
  const params: Record<string, string> = {
    action: "query",
    prop: "extracts|revisions|info|images",
    explaintext: "1",
    inprop: "url",
    rvslots: "main",
    rvprop: "content"
  };
  if (input.pageId) params.pageids = input.pageId;
  if (input.title) params.titles = input.title;
  const data = await fetchWikiJson<{
    query?: {
      pages?: Record<
        string,
        {
          pageid: number;
          title: string;
          fullurl?: string;
          extract?: string;
          images?: { title: string }[];
          revisions?: { slots?: { main?: { "*": string } } }[];
        }
      >;
    };
  }>(resolvedLang, params);

  const pages = data.query?.pages ? Object.values(data.query.pages) : [];
  const page = pages.find((entry) => entry.pageid && entry.pageid > 0);
  if (!page) return null;

  const wikitext = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
  return {
    pageId: page.pageid,
    title: page.title,
    url: page.fullurl ?? pageUrl(resolvedLang, page.title),
    extract: page.extract ?? "",
    wikitext,
    images: (page.images ?? []).map((img) => img.title)
  };
}

export async function fetchWikiImageInfo(
  lang: string | null | undefined,
  title: string
): Promise<WikiImageInfo | null> {
  const resolvedLang = normalizeLang(lang);
  const normalizedTitle = title.startsWith("File:") ? title : `File:${title}`;
  const data = await fetchWikiJson<{
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          imageinfo?: {
            url: string;
            mime?: string;
            width?: number;
            height?: number;
            size?: number;
            extmetadata?: Record<string, { value: string }>;
          }[];
        }
      >;
    };
  }>(resolvedLang, {
    action: "query",
    titles: normalizedTitle,
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|Credit|ImageDescription",
    iiurlwidth: "2000"
  });

  const pages = data.query?.pages ? Object.values(data.query.pages) : [];
  const page = pages[0];
  const info = page?.imageinfo?.[0];
  if (!info?.url) return null;

  const metadata = info.extmetadata ?? {};
  const author = stripHtml(metadata.Artist?.value);
  const licenseId = stripHtml(metadata.LicenseShortName?.value);
  const licenseUrl = stripHtml(metadata.LicenseUrl?.value);
  const credit = stripHtml(metadata.Credit?.value);
  const description = stripHtml(metadata.ImageDescription?.value);

  const attributionText = [credit, description].filter(Boolean).join(" | ") || null;

  return {
    title: normalizedTitle,
    url: info.url,
    mime: info.mime ?? "application/octet-stream",
    width: info.width ?? null,
    height: info.height ?? null,
    size: info.size ?? null,
    author: author || null,
    licenseId: licenseId || null,
    licenseUrl: licenseUrl || null,
    attributionText
  };
}

export function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9._-]/gi, "_");
}

import { NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

type MetadataRequest = {
  workspaceId?: string;
  doi?: string;
  bibtex?: string;
};

type MetadataPayload = {
  title?: string;
  author?: string;
  year?: string;
  publisher?: string;
  sourceUrl?: string;
  doi?: string;
  url?: string;
};

const DOI_PATTERN = /(10\.\d{4,9}\/[^\s]+)/i;

function normalizeDoi(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const match = trimmed.match(DOI_PATTERN);
  if (match) return match[1];
  return trimmed.replace(/^https?:\/\/doi\.org\//i, "");
}

function cleanBibtexValue(value: string) {
  return value
    .replace(/^[{"]+/, "")
    .replace(/[}"]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBibtex(input: string): MetadataPayload {
  const payload: MetadataPayload = {};
  const normalized = input.replace(/\r\n/g, "\n");
  const entryMatch = normalized.match(/@\w+\s*\{\s*[^,]+,([\s\S]*)\}\s*$/);
  if (!entryMatch) return payload;

  const body = entryMatch[1];
  const fieldRegex = /(\w+)\s*=\s*(\{[^}]*\}|"[^"]*")\s*,?/g;
  let match: RegExpExecArray | null;
  const fields: Record<string, string> = {};

  while ((match = fieldRegex.exec(body))) {
    fields[match[1].toLowerCase()] = cleanBibtexValue(match[2]);
  }

  if (fields.title) payload.title = fields.title;
  if (fields.author) {
    payload.author = fields.author.replace(/\s+and\s+/gi, "; ");
  }
  if (fields.year) payload.year = fields.year;
  if (fields.publisher) payload.publisher = fields.publisher;
  if (fields.url) payload.url = fields.url;
  if (fields.doi) payload.doi = normalizeDoi(fields.doi);

  return payload;
}

function buildAuthorList(authors: Array<{ given?: string; family?: string }>) {
  if (!Array.isArray(authors)) return "";
  return authors
    .map((author) => {
      const parts = [author.family, author.given].filter(Boolean);
      return parts.join(", ");
    })
    .filter(Boolean)
    .join("; ");
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  let payload: MetadataRequest;
  try {
    payload = (await request.json()) as MetadataRequest;
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const workspaceId = String(payload.workspaceId ?? "").trim();
  if (!workspaceId) return apiError("Missing workspace", 400);

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  if (payload.bibtex) {
    const parsed = parseBibtex(payload.bibtex);
    return NextResponse.json({ ok: true, data: parsed });
  }

  const doi = normalizeDoi(String(payload.doi ?? ""));
  if (!doi) {
    return apiError("Missing DOI", 400);
  }

  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: {
        "User-Agent": "Depictionator/1.0"
      }
    });

    if (!response.ok) {
      return apiError("DOI lookup failed", 400);
    }

    const data = await response.json();
    const message = data?.message ?? {};

    const title = Array.isArray(message.title) ? message.title[0] : message.title;
    const author = buildAuthorList(message.author ?? []);
    const publisher = message.publisher || (Array.isArray(message["container-title"]) ? message["container-title"][0] : undefined);
    const issued = message.issued?.["date-parts"]?.[0]?.[0];
    const published = message["published-print"]?.["date-parts"]?.[0]?.[0] || message["published-online"]?.["date-parts"]?.[0]?.[0];
    const year = issued || published;
    const url = message.URL || message.url;

    const result: MetadataPayload = {
      title: title || undefined,
      author: author || undefined,
      publisher: publisher || undefined,
      year: year ? String(year) : undefined,
      sourceUrl: url || undefined,
      doi,
      url: url || undefined
    };

    return NextResponse.json({ ok: true, data: result });
  } catch {
    return apiError("DOI lookup failed", 400);
  }
}

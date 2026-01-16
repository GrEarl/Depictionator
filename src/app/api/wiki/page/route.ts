import { NextResponse } from "next/server";
import { requireApiSession, apiError } from "@/lib/api";
import { fetchWikiPage, parseWikiPageInput } from "@/lib/wiki";

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const lang = String(form.get("lang") ?? "").trim();
  const pageId = String(form.get("pageId") ?? "").trim();
  const rawTitle = String(form.get("title") ?? "").trim();

  if (!pageId && !rawTitle) {
    return apiError("pageId or title required", 400);
  }

  try {
    const parsed = rawTitle ? parseWikiPageInput(rawTitle, lang || null) : null;
    const resolvedLang = parsed?.lang ?? (lang || null);
    const title = parsed?.title ?? rawTitle;
    const page = await fetchWikiPage(resolvedLang, { pageId, title });
    if (!page) return apiError("Page not found", 404);
    return NextResponse.json({ page });
  } catch (error) {
    return apiError((error as Error).message, 500);
  }
}

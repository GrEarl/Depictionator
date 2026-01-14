import { NextResponse } from "next/server";
import { requireApiSession, apiError } from "@/lib/api";
import { searchWiki } from "@/lib/wiki";

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const query = String(form.get("query") ?? form.get("q") ?? "").trim();
  const lang = String(form.get("lang") ?? "").trim();

  if (!query) {
    return apiError("Query required", 400);
  }

  try {
    const results = await searchWiki(query, lang || null);
    return NextResponse.json({ results });
  } catch (error) {
    return apiError((error as Error).message, 500);
  }
}

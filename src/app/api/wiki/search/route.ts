import { NextResponse } from "next/server";
import { requireApiSession, apiError } from "@/lib/api";
import { searchWiki } from "@/lib/wiki";

async function handleSearch(query: string, lang: string | null) {
  const results = await searchWiki(query, lang || null);
  return NextResponse.json({ results });
}

export async function GET(request: Request) {
  try {
    await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("query") ?? searchParams.get("q") ?? "").trim();
  const lang = String(searchParams.get("lang") ?? "").trim();

  if (!query) {
    return apiError("Query required", 400);
  }

  try {
    return await handleSearch(query, lang || null);
  } catch (error) {
    return apiError((error as Error).message, 500);
  }
}

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
    return await handleSearch(query, lang || null);
  } catch (error) {
    return apiError((error as Error).message, 500);
  }
}

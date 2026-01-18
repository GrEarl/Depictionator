import { NextResponse } from "next/server";
import { fetchWikiImageInfo, parseWikiImageInput } from "@/lib/wiki";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const file = String(searchParams.get("file") ?? "").trim();
  const lang = String(searchParams.get("lang") ?? "").trim();

  if (!file) {
    return new NextResponse("Missing file", { status: 400 });
  }

  const resolved = parseWikiImageInput(file, lang || null);
  if (!resolved?.title) {
    return new NextResponse("Invalid file", { status: 400 });
  }

  const info = await fetchWikiImageInfo(resolved.lang, resolved.title);
  if (!info?.url) {
    return new NextResponse("Not found", { status: 404 });
  }

  const download = await fetch(info.url);
  if (!download.ok) {
    return new NextResponse(`Failed to fetch image (${download.status})`, { status: 502 });
  }

  const arrayBuffer = await download.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": info.mime || "application/octet-stream",
      "Cache-Control": "public, max-age=86400"
    }
  });
}

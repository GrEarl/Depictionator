import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";
type EntitySummary = {
  title: string;
  article: { baseRevision: { bodyMd: string } | null } | null;
};
type MapSummary = {
  title: string;
  imageAsset: { storageKey: string; mimeType: string } | null;
};
type TimelineSummary = {
  name: string;
  events: { title: string }[];
};
type AssetSummary = {
  storageKey: string;
  author: string | null;
  licenseId: string | null;
  licenseUrl: string | null;
  sourceUrl: string | null;
};


function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
  const entityIds = String(form.get("entityIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const mapIds = String(form.get("mapIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const timelineIds = String(form.get("timelineIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const includeCredits = String(form.get("includeCredits") ?? "false") === "true";

  if (!workspaceId) {
    return apiError("Workspace required", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const sections: string[] = [];

  if (entityIds.length > 0) {
    const entities: EntitySummary[] = await prisma.entity.findMany({
      where: { workspaceId, id: { in: entityIds } },
      include: { article: { include: { baseRevision: true } } }
    });
    const items = entities
      .map((entity) => {
        const body = entity.article?.baseRevision?.bodyMd ?? "";
        return `<article><h3>${escapeHtml(entity.title)}</h3><pre>${escapeHtml(body)}</pre></article>`;
      })
      .join("");
    sections.push(`<section><h2>Articles</h2>${items || "<p>No articles.</p>"}</section>`);
  }

  if (mapIds.length > 0) {
    const maps: MapSummary[] = await prisma.map.findMany({
      where: { workspaceId, id: { in: mapIds } },
      include: { imageAsset: true }
    });
    const items = await Promise.all(
      maps.map(async (map) => {
        let imageHtml = "<p>No image.</p>";
        if (map.imageAsset) {
          try {
            const filePath = path.join(
              process.cwd(),
              "storage",
              workspaceId,
              map.imageAsset.storageKey
            );
            const buffer = await readFile(filePath);
            const encoded = buffer.toString("base64");
            imageHtml = `<img src="data:${map.imageAsset.mimeType};base64,${encoded}" style="max-width:100%;border:1px solid #ddd;" />`;
          } catch {
            imageHtml = "<p>Image not found.</p>";
          }
        }
        return `<article><h3>${escapeHtml(map.title)}</h3>${imageHtml}</article>`;
      })
    );
    sections.push(`<section><h2>Maps</h2>${items.join("")}</section>`);
  }

  if (timelineIds.length > 0) {
    const timelines: TimelineSummary[] = await prisma.timeline.findMany({
      where: { workspaceId, id: { in: timelineIds } },
      include: { events: { orderBy: { createdAt: "desc" } } }
    });
    const items = timelines
      .map((timeline) => {
        const events = timeline.events
          .map((event) => `<li>${escapeHtml(event.title)}</li>`)
          .join("");
        return `<article><h3>${escapeHtml(timeline.name)}</h3><ul>${events || "<li>No events.</li>"}</ul></article>`;
      })
      .join("");
    sections.push(`<section><h2>Timelines</h2>${items}</section>`);
  }

  let html = `<html><body>${sections.join("") || "<p>No content selected.</p>"}</body></html>`;

  if (includeCredits) {
    const assets: AssetSummary[] = await prisma.asset.findMany({
      where: { workspaceId, softDeletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    const credits = assets
      .map(
        (asset) =>
          `<li>${escapeHtml(asset.storageKey)} ・ゑｽｷ ${escapeHtml(asset.author ?? "")} ・ゑｽｷ ${escapeHtml(asset.licenseId ?? "")} ・ゑｽｷ ${escapeHtml(asset.licenseUrl ?? "")} ・ゑｽｷ ${escapeHtml(asset.sourceUrl ?? "")}</li>`
      )
      .join("");
    html = `${html}<hr /><h2>Credits</h2><ul>${credits || "<li>No credits</li>"}</ul>`;
  }

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=print-set.pdf"
    }
  });
}


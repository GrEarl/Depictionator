import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { readFile } from "fs/promises";
import { Buffer } from "node:buffer";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";
type EntitySummary = {
  title: string;
  article: { baseRevision: { id: string; bodyMd: string } | null } | null;
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
type SourceRecordSummary = {
  sourceUrl: string;
  title: string | null;
  author: string | null;
  licenseId: string | null;
  licenseUrl: string | null;
  attributionText: string | null;
  targetType: string;
  targetId: string;
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

  const contentType = request.headers.get("content-type") || "";
  let workspaceId = "";
  let entityIds: string[] = [];
  let mapIds: string[] = [];
  let timelineIds: string[] = [];
  let boardIds: string[] = [];
  let entityQuery = "";
  let mapQuery = "";
  let timelineQuery = "";
  let includeCredits = false;
  let includeToc = true;
  let pageNumbers = true;
  let template = "default";

  // Support both JSON and FormData
  if (contentType.includes("application/json")) {
    const body = await request.json();
    workspaceId = String(body.workspaceId ?? "").trim();

    // Handle items array from new UI
    const items = body.items ?? [];
    entityIds = items.filter((i: any) => i.type === "entity").map((i: any) => i.id);
    mapIds = items.filter((i: any) => i.type === "map").map((i: any) => i.id);
    boardIds = items.filter((i: any) => i.type === "board").map((i: any) => i.id);
    timelineIds = items.filter((i: any) => i.type === "timeline").map((i: any) => i.id);

    // Also support direct ID arrays
    if (body.entityIds) entityIds = [...entityIds, ...body.entityIds];
    if (body.mapIds) mapIds = [...mapIds, ...body.mapIds];
    if (body.timelineIds) timelineIds = [...timelineIds, ...body.timelineIds];

    const options = body.options ?? {};
    includeCredits = options.includeCredits ?? body.includeCredits ?? false;
    includeToc = options.includeToc ?? true;
    pageNumbers = options.pageNumbers ?? true;
    template = options.template ?? "default";
  } else {
    const form = await request.formData();
    workspaceId = String(form.get("workspaceId") ?? "").trim();
    entityIds = String(form.get("entityIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    mapIds = String(form.get("mapIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    boardIds = String(form.get("boardIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    timelineIds = String(form.get("timelineIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    entityQuery = String(form.get("entityQuery") ?? "").trim();
    mapQuery = String(form.get("mapQuery") ?? "").trim();
    timelineQuery = String(form.get("timelineQuery") ?? "").trim();
    includeCredits = String(form.get("includeCredits") ?? "false") === "true";
    includeToc = String(form.get("includeToc") ?? "true") === "true";
    pageNumbers = String(form.get("pageNumbers") ?? "true") === "true";
    template = String(form.get("template") ?? "default");
  }

  if (!workspaceId) {
    return apiError("Workspace required", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const sections: string[] = [];
  const revisionIds: string[] = [];

  const parseTerms = (value: string) =>
    value
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);

  const entityIdsResolved = new Set(entityIds);
  const mapIdsResolved = new Set(mapIds);
  const timelineIdsResolved = new Set(timelineIds);
  const boardIdsResolved = new Set(boardIds);

  const unresolvedEntities: string[] = [];
  const unresolvedMaps: string[] = [];
  const unresolvedTimelines: string[] = [];

  const entityTerms = parseTerms(entityQuery);
  if (entityTerms.length > 0) {
    for (const term of entityTerms) {
      const matches = await prisma.entity.findMany({
        where: {
          workspaceId,
          softDeletedAt: null,
          OR: [
            { title: { equals: term, mode: "insensitive" } },
            { title: { contains: term, mode: "insensitive" } },
            { aliases: { has: term } }
          ]
        },
        select: { id: true }
      });
      if (matches.length === 0) {
        unresolvedEntities.push(term);
      } else {
        matches.forEach((m) => entityIdsResolved.add(m.id));
      }
    }
  }

  const mapTerms = parseTerms(mapQuery);
  if (mapTerms.length > 0) {
    for (const term of mapTerms) {
      const matches = await prisma.map.findMany({
        where: {
          workspaceId,
          softDeletedAt: null,
          OR: [
            { title: { equals: term, mode: "insensitive" } },
            { title: { contains: term, mode: "insensitive" } }
          ]
        },
        select: { id: true }
      });
      if (matches.length === 0) {
        unresolvedMaps.push(term);
      } else {
        matches.forEach((m) => mapIdsResolved.add(m.id));
      }
    }
  }

  const timelineTerms = parseTerms(timelineQuery);
  if (timelineTerms.length > 0) {
    for (const term of timelineTerms) {
      const matches = await prisma.timeline.findMany({
        where: {
          workspaceId,
          softDeletedAt: null,
          OR: [
            { name: { equals: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } }
          ]
        },
        select: { id: true }
      });
      if (matches.length === 0) {
        unresolvedTimelines.push(term);
      } else {
        matches.forEach((t) => timelineIdsResolved.add(t.id));
      }
    }
  }

  if (unresolvedEntities.length > 0 || unresolvedMaps.length > 0 || unresolvedTimelines.length > 0) {
    const parts = [
      unresolvedEntities.length > 0 ? `Entities not found: ${unresolvedEntities.join(", ")}` : null,
      unresolvedMaps.length > 0 ? `Maps not found: ${unresolvedMaps.join(", ")}` : null,
      unresolvedTimelines.length > 0 ? `Timelines not found: ${unresolvedTimelines.join(", ")}` : null
    ].filter(Boolean);
    return apiError(parts.join(" | "), 400);
  }

  const finalEntityIds = Array.from(entityIdsResolved);
  const finalMapIds = Array.from(mapIdsResolved);
  const finalTimelineIds = Array.from(timelineIdsResolved);
  const finalBoardIds = Array.from(boardIdsResolved);

  if (finalEntityIds.length > 0) {
    const entities: EntitySummary[] = await prisma.entity.findMany({
      where: { workspaceId, id: { in: finalEntityIds } },
      include: { article: { include: { baseRevision: true } } }
    });
    entities.forEach((entity) => {
      const revId = entity.article?.baseRevision?.id;
      if (revId) revisionIds.push(revId);
    });
    const items = entities
      .map((entity) => {
        const body = entity.article?.baseRevision?.bodyMd ?? "";
        return `<article><h3>${escapeHtml(entity.title)}</h3><pre>${escapeHtml(body)}</pre></article>`;
      })
      .join("");
    sections.push(`<section id="section-articles"><h2>Articles</h2>${items || "<p>No articles.</p>"}</section>`);
  }

  if (finalMapIds.length > 0) {
    const maps: MapSummary[] = await prisma.map.findMany({
      where: { workspaceId, id: { in: finalMapIds } },
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
    sections.push(`<section id="section-maps"><h2>Maps</h2>${items.join("")}</section>`);
  }

  if (finalTimelineIds.length > 0) {
    const timelines: TimelineSummary[] = await prisma.timeline.findMany({
      where: { workspaceId, id: { in: finalTimelineIds } },
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
    sections.push(`<section id="section-timelines"><h2>Timelines</h2>${items}</section>`);
  }

  if (finalBoardIds.length > 0) {
    const boards = await prisma.evidenceBoard.findMany({
      where: { workspaceId, id: { in: finalBoardIds } },
      include: {
        items: {
          where: { softDeletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 100,
          include: {
            entity: { select: { title: true } }
          }
        }
      }
    });
    const items = boards
      .map((board) => {
        const boardItems = board.items
          .map((item) => {
            const label = item.entity?.title ?? item.title ?? item.content ?? item.url ?? "";
            const typeLabel = item.type ? `(${item.type})` : "";
            return `<li>${escapeHtml(`${label} ${typeLabel}`.trim())}</li>`;
          })
          .join("");
        return `<article><h3>${escapeHtml(board.name)}</h3><p>${escapeHtml(board.description ?? "")}</p><ul>${boardItems || "<li>No items.</li>"}</ul></article>`;
      })
      .join("");
    sections.push(`<section id="section-boards"><h2>Boards</h2>${items}</section>`);
  }

  const tocItems = [
    finalEntityIds.length > 0 ? { label: "Articles", anchor: "section-articles" } : null,
    finalMapIds.length > 0 ? { label: "Maps", anchor: "section-maps" } : null,
    finalBoardIds.length > 0 ? { label: "Boards", anchor: "section-boards" } : null,
    finalTimelineIds.length > 0 ? { label: "Timelines", anchor: "section-timelines" } : null
  ].filter(Boolean) as { label: string; anchor: string }[];

  const tocHtml = includeToc
    ? `<section class="toc"><h2>Table of Contents</h2><ol>${tocItems.map((item) => `<li><a href="#${item.anchor}">${item.label}</a></li>`).join("")}</ol></section>`
    : "";

  const templateStyles: Record<string, string> = {
    default: "body{font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#111;} h2{margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:6px;} h3{margin-top:16px;} article{margin-bottom:16px;}",
    compact: "body{font-family:Arial,sans-serif;font-size:11px;line-height:1.4;color:#111;} h2{margin-top:18px;border-bottom:1px solid #eee;padding-bottom:4px;} h3{margin-top:12px;} article{margin-bottom:12px;}",
    presentation: "body{font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#111;} h2{margin-top:28px;border-bottom:2px solid #222;padding-bottom:8px;} h3{margin-top:18px;} article{margin-bottom:20px;}",
    wiki: "body{font-family:Georgia,serif;font-size:12px;line-height:1.6;color:#111;} h2{margin-top:22px;border-bottom:1px solid #999;padding-bottom:6px;} h3{margin-top:14px;} article{margin-bottom:16px;}"
  };

  const styleBlock = `<style>${templateStyles[template] ?? templateStyles.default} pre{white-space:pre-wrap;word-break:break-word;} .toc ol{padding-left:18px;}</style>`;

  const sectionHtml = sections.join("") || "<p>No content selected.</p>";
  let html = `<html><head>${styleBlock}</head><body>${tocHtml}${sectionHtml}</body></html>`;

  if (includeCredits) {
    const assets: AssetSummary[] = await prisma.asset.findMany({
      where: { workspaceId, softDeletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    const sourceRecords: SourceRecordSummary[] = await prisma.sourceRecord.findMany({
      where: {
        workspaceId,
        OR: [
          { targetType: "article_revision", targetId: { in: revisionIds } },
          { targetType: "map", targetId: { in: finalMapIds } }
        ]
      },
      orderBy: { createdAt: "desc" }
    });
    const credits = assets
      .map(
        (asset) =>
          `<li>${escapeHtml(asset.storageKey)}  |  ${escapeHtml(asset.author ?? "")}  |  ${escapeHtml(asset.licenseId ?? "")}  |  ${escapeHtml(asset.licenseUrl ?? "")}  |  ${escapeHtml(asset.sourceUrl ?? "")}</li>`
      )
      .join("");
    const sources = sourceRecords
      .map((record) => {
        const parts = [
          record.title ? `Title: ${record.title}` : null,
          record.author ? `Author: ${record.author}` : null,
          record.sourceUrl ? `Source: ${record.sourceUrl}` : null,
          record.licenseId ? `License: ${record.licenseId}` : null,
          record.licenseUrl ? `License URL: ${record.licenseUrl}` : null,
          record.attributionText ? `Attribution: ${record.attributionText}` : null
        ].filter(Boolean);
        return `<li>${escapeHtml(parts.join(" | "))}</li>`;
      })
      .join("");
    html = `${html}<hr /><h2>Credits</h2><h3>Assets</h3><ul>${credits || "<li>No asset credits</li>"}</ul><h3>Sources</h3><ul>${sources || "<li>No sources</li>"}</ul>`;
  }
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfOptions: any = { format: "A4", printBackground: true };
  if (pageNumbers) {
    pdfOptions.displayHeaderFooter = true;
    pdfOptions.headerTemplate = "<span></span>";
    pdfOptions.footerTemplate = `
      <div style="width:100%;font-size:10px;color:#666;padding:0 16px 8px;text-align:right;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `;
    pdfOptions.margin = { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" };
  }
  const pdf = await page.pdf(pdfOptions);
  await browser.close();

  const pdfBuffer = Buffer.from(pdf);
  const pdfBody = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  );

  return new NextResponse(pdfBody, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=print-set.pdf"
    }
  });
}

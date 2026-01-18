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
  const entityQuery = String(form.get("entityQuery") ?? "").trim();
  const mapQuery = String(form.get("mapQuery") ?? "").trim();
  const timelineQuery = String(form.get("timelineQuery") ?? "").trim();
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
  const revisionIds: string[] = [];

  const parseTerms = (value: string) =>
    value
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);

  const entityIdsResolved = new Set(entityIds);
  const mapIdsResolved = new Set(mapIds);
  const timelineIdsResolved = new Set(timelineIds);

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
    sections.push(`<section><h2>Articles</h2>${items || "<p>No articles.</p>"}</section>`);
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
    sections.push(`<section><h2>Maps</h2>${items.join("")}</section>`);
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
    sections.push(`<section><h2>Timelines</h2>${items}</section>`);
  }

  let html = `<html><body>${sections.join("") || "<p>No content selected.</p>"}</body></html>`;

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
  const pdf = await page.pdf({ format: "A4", printBackground: true });
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




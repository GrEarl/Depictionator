import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { Buffer } from "node:buffer";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";
import { prisma } from "@/lib/db";

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
};

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const html = String(form.get("html") ?? "").trim();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();
  const includeCredits = String(form.get("includeCredits") ?? "false") === "true";

  if (!html) {
    return apiError("HTML required", 400);
  }

  let finalHtml = html;
  if (includeCredits && workspaceId) {
    try {
      await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
    } catch {
      return apiError("Forbidden", 403);
    }
    const assets: AssetSummary[] = await prisma.asset.findMany({
      where: { workspaceId, softDeletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    const sourceRecords: SourceRecordSummary[] = await prisma.sourceRecord.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });
    const credits = assets
      .map(
        (asset) =>
          `<li>${asset.storageKey}  |  ${asset.author ?? ""}  |  ${asset.licenseId ?? ""}  |  ${asset.licenseUrl ?? ""}  |  ${asset.sourceUrl ?? ""}</li>`
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
        return `<li>${parts.join(" | ")}</li>`;
      })
      .join("");
    finalHtml = `${html}<hr /><h2>Credits</h2><h3>Assets</h3><ul>${credits || "<li>No asset credits</li>"}</ul><h3>Sources</h3><ul>${sources || "<li>No sources</li>"}</ul>`;
  }
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(finalHtml, { waitUntil: "networkidle0" });
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
      "Content-Disposition": "attachment; filename=export.pdf"
    }
  });
}



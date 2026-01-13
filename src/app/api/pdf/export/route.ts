import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";
import { prisma } from "@/lib/db";

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
    const assets = await prisma.asset.findMany({
      where: { workspaceId, softDeletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    const credits = assets
      .map(
        (asset) =>
          `<li>${asset.storageKey} · ${asset.author ?? ""} · ${asset.licenseId ?? ""} · ${asset.licenseUrl ?? ""} · ${asset.sourceUrl ?? ""}</li>`
      )
      .join("");
    finalHtml = `${html}<hr /><h2>Credits</h2><ul>${credits || "<li>No credits</li>"}</ul>`;
  }

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(finalHtml, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=export.pdf"
    }
  });
}

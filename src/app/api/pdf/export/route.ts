import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { requireApiSession, apiError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const html = String(form.get("html") ?? "").trim();

  if (!html) {
    return apiError("HTML required", 400);
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
      "Content-Disposition": "attachment; filename=export.pdf"
    }
  });
}

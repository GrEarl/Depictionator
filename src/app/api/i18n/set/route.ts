import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, apiError } from "@/lib/api";
import { normalizeLocale, setLocaleCookie } from "@/lib/locale";
import { logAudit } from "@/lib/audit";
import { toRedirectUrl } from "@/lib/redirect";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const localeValue = String(form.get("locale") ?? "").trim();
  const auditWorkspaceId = String(form.get("workspaceId") ?? "system").trim() || "system";
  const locale = normalizeLocale(localeValue);

  await prisma.user.update({
    where: { id: session.userId },
    data: { locale }
  });

  await logAudit({
    workspaceId: auditWorkspaceId,
    actorUserId: session.userId,
    action: "update_locale",
    targetType: "user",
    targetId: session.userId,
    meta: { locale }
  });

  const response = NextResponse.redirect(
    toRedirectUrl(request, request.headers.get("referer") ?? "/settings")
  );
  setLocaleCookie(response, locale);
  return response;
}

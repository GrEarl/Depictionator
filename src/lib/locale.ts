import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const UI_LOCALES = ["ja", "en"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

const DEFAULT_LOCALE = (process.env.DEFAULT_UI_LOCALE as UiLocale | undefined) ?? "ja";

export function normalizeLocale(value?: string | null): UiLocale {
  const raw = (value ?? "").trim().toLowerCase();
  if (UI_LOCALES.includes(raw as UiLocale)) {
    return raw as UiLocale;
  }
  return DEFAULT_LOCALE;
}

export async function getLocaleFromCookies(): Promise<UiLocale> {
  const store = await cookies();
  const cookieValue = store.get("ui_locale")?.value;
  return normalizeLocale(cookieValue);
}

export function setLocaleCookie(response: NextResponse, locale: UiLocale) {
  response.cookies.set("ui_locale", locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
}

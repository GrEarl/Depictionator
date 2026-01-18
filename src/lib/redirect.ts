export function toRedirectUrl(request: Request, target: string): URL {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const proto = forwardedProto || (request.url.startsWith("https:") ? "https" : "http");

  if (host) {
    return new URL(target, `${proto}://${host}`);
  }

  return new URL(target, request.url);
}

export function sanitizeRedirectPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

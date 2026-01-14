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

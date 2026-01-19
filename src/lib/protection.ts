export type ProtectionLevel = "none" | "editor" | "admin";

const PROTECTION_PREFIX = "protected:";

export function getProtectionLevel(tags: string[]): ProtectionLevel {
  if (!Array.isArray(tags)) return "none";
  const normalized = tags.map((tag) => String(tag).toLowerCase());
  if (normalized.includes(`${PROTECTION_PREFIX}admin`)) return "admin";
  if (normalized.includes(`${PROTECTION_PREFIX}editor`)) return "editor";
  return "none";
}

export function applyProtection(tags: string[], level: ProtectionLevel): string[] {
  const base = Array.isArray(tags) ? tags.filter((tag) => !String(tag).toLowerCase().startsWith(PROTECTION_PREFIX)) : [];
  if (level === "none") return base;
  return Array.from(new Set([...base, `${PROTECTION_PREFIX}${level}`]));
}

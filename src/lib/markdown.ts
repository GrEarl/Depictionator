export type HeadingInfo = {
  level: number;
  text: string;
  slug: string;
};

export function slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "section";
}

export function createSlugger() {
  const counts = new Map<string, number>();
  return (text: string) => {
    const base = slugify(text);
    const current = counts.get(base) ?? 0;
    counts.set(base, current + 1);
    return current === 0 ? base : `${base}-${current + 1}`;
  };
}

export function extractHeadings(
  markdown: string,
  options?: { minLevel?: number; maxLevel?: number }
): HeadingInfo[] {
  const minLevel = options?.minLevel ?? 1;
  const maxLevel = options?.maxLevel ?? 6;
  const slugger = createSlugger();
  const headings: HeadingInfo[] = [];
  let inFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (!match) continue;
    const level = match[1].length;
    if (level < minLevel || level > maxLevel) continue;
    const rawText = match[2].replace(/\s+#*$/, "").trim();
    if (!rawText) continue;
    const slug = slugger(rawText);
    headings.push({ level, text: rawText, slug });
  }

  return headings;
}

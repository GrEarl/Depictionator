export type HeadingInfo = {
  level: number;
  text: string;
  slug: string;
};

function stripMarkdown(text: string): string {
  return text
    .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\[\[(.*?)\]\]/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

export function slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
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
    const cleanedText = stripMarkdown(rawText);
    if (!cleanedText) continue;
    const slug = slugger(cleanedText);
    headings.push({ level, text: cleanedText, slug });
  }

  return headings;
}

export type AutoLinkTarget = {
  title: string;
  url: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protectMarkdownLinks(input: string) {
  const placeholders: string[] = [];
  const text = input.replace(/!\[[^\]]*?\]\([^)]+\)|\[[^\]]+?\]\([^)]+\)/g, (match) => {
    const key = `@@LINK_${placeholders.length}@@`;
    placeholders.push(match);
    return key;
  });
  return { text, placeholders };
}

function restoreMarkdownLinks(input: string, placeholders: string[]) {
  return input.replace(/@@LINK_(\d+)@@/g, (match, index) => {
    const value = placeholders[Number(index)];
    return value ?? match;
  });
}

export function autoLinkMarkdown(markdown: string, targets: AutoLinkTarget[]): string {
  if (!markdown.trim() || targets.length === 0) return markdown;

  const uniqueTargets = Array.from(
    new Map(
      targets
        .filter((target) => target.title.trim().length >= 2)
        .map((target) => [target.title, target])
    ).values()
  ).sort((a, b) => b.title.length - a.title.length);

  let inFence = false;
  const lines = markdown.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const segments = line.split(/(`[^`]*`)/g);
    const processed = segments.map((segment) => {
      if (segment.startsWith("`") && segment.endsWith("`")) return segment;
      const protectedLinks = protectMarkdownLinks(segment);
      let next = protectedLinks.text;
      uniqueTargets.forEach((target) => {
        const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(target.title)})(?=[^\\p{L}\\p{N}_]|$)`, "gu");
        next = next.replace(pattern, (match, prefix, title) => {
          return `${prefix}[${title}](${target.url})`;
        });
      });
      return restoreMarkdownLinks(next, protectedLinks.placeholders);
    });
    return processed.join("");
  });

  return lines.join("\n");
}

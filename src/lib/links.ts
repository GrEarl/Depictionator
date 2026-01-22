/**
 * Link extraction and backlink utilities for Depictionator
 * Based on AGENTS.md requirement: "バックリンク（どこから参照されているか）"
 */

// Wiki-style link patterns
const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(\/wiki\/([^)]+)\)/g;
const INTERNAL_LINK_PATTERN = /\[([^\]]+)\]\(\/articles\/([^)]+)\)/g;

export type ExtractedLink = {
  title: string;
  displayText?: string;
  type: "wiki" | "markdown" | "internal";
};

/**
 * Extract all internal links from markdown/wikitext content
 */
export function extractLinks(content: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seenTitles = new Set<string>();

  // Extract [[WikiStyle]] links
  let match: RegExpExecArray | null;
  const wikiPattern = new RegExp(WIKI_LINK_PATTERN);
  while ((match = wikiPattern.exec(content)) !== null) {
    const title = match[1].trim();
    if (title && !seenTitles.has(title.toLowerCase())) {
      seenTitles.add(title.toLowerCase());
      links.push({
        title,
        type: "wiki",
      });
    }
  }

  // Extract [Text](/wiki/Title) markdown links
  const mdPattern = new RegExp(MARKDOWN_LINK_PATTERN);
  while ((match = mdPattern.exec(content)) !== null) {
    const displayText = match[1].trim();
    const encodedTitle = match[2].trim();
    const title = decodeURIComponent(encodedTitle).replace(/_/g, " ");
    if (title && !seenTitles.has(title.toLowerCase())) {
      seenTitles.add(title.toLowerCase());
      links.push({
        title,
        displayText,
        type: "markdown",
      });
    }
  }

  // Extract [Text](/articles/id) internal links
  const internalPattern = new RegExp(INTERNAL_LINK_PATTERN);
  while ((match = internalPattern.exec(content)) !== null) {
    const displayText = match[1].trim();
    const id = match[2].trim();
    if (id && !seenTitles.has(id.toLowerCase())) {
      seenTitles.add(id.toLowerCase());
      links.push({
        title: id,
        displayText,
        type: "internal",
      });
    }
  }

  return links;
}

/**
 * Extract unique entity titles from content
 */
export function extractLinkedTitles(content: string): string[] {
  const links = extractLinks(content);
  return [...new Set(links.map((link) => link.title))];
}

/**
 * Check if content contains a link to a specific title
 */
export function containsLinkTo(content: string, targetTitle: string): boolean {
  const normalizedTarget = targetTitle.toLowerCase().trim();
  const links = extractLinks(content);
  return links.some((link) => link.title.toLowerCase().trim() === normalizedTarget);
}

/**
 * Replace wiki-style links with markdown links for rendering
 */
export function wikiLinksToMarkdown(
  content: string,
  linkResolver: (title: string) => string = (t) => `/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`
): string {
  return content.replace(WIKI_LINK_PATTERN, (match, title, displayText) => {
    const linkTitle = title.trim();
    const text = displayText ? displayText.trim() : linkTitle;
    const url = linkResolver(linkTitle);
    return `[${text}](${url})`;
  });
}

/**
 * Extract categories from wikitext [[Category:Name]]
 */
export function extractCategories(content: string): string[] {
  const pattern = /\[\[Category:([^\]]+)\]\]/gi;
  const categories: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const cat = match[1].trim();
    if (cat && !categories.includes(cat)) {
      categories.push(cat);
    }
  }
  return categories;
}

/**
 * Extract templates from wikitext {{TemplateName}}
 */
export function extractTemplates(content: string): string[] {
  const pattern = /\{\{([^}|]+)(?:\|[^}]*)?\}\}/g;
  const templates: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const template = match[1].trim();
    // Ignore common non-template patterns
    if (template && !template.startsWith("#") && !templates.includes(template)) {
      templates.push(template);
    }
  }
  return templates;
}

/**
 * Find entities that link to a specific entity (backlinks)
 * This queries the database for articles containing wiki links to the target
 */
export async function findBacklinks(
  workspaceId: string,
  title: string,
  aliases: string[] = [],
  limit: number = 50
): Promise<{ id: string; title: string; type: string }[]> {
  // Import prisma dynamically to avoid circular dependencies
  const { prisma } = await import("@/lib/prisma");

  // Build search patterns for [[Title]] and [[Alias]] style links
  const searchTerms = [title, ...aliases].filter(Boolean);

  // Get all entities with their article content
  const entities = await prisma.entity.findMany({
    where: {
      workspaceId,
      softDeletedAt: null,
      title: { not: title }, // Exclude self
      article: {
        baseRevision: { isNot: null }
      }
    },
    select: {
      id: true,
      title: true,
      type: true,
      article: {
        select: {
          baseRevision: {
            select: {
              bodyMd: true
            }
          }
        }
      }
    },
    take: 500 // Limit scan to 500 entities for performance
  });

  const backlinks: { id: string; title: string; type: string }[] = [];

  for (const entity of entities) {
    const content = entity.article?.baseRevision?.bodyMd ?? "";
    if (!content) continue;

    // Check if any of the search terms are linked in the content
    const hasLink = searchTerms.some(term => {
      // Check for [[Term]] or [[Term|Display]] style links
      const wikiPattern = new RegExp(`\\[\\[${escapeRegex(term)}(?:\\|[^\\]]+)?\\]\\]`, "i");
      // Check for [Text](/wiki/Term) style links
      const encodedTerm = encodeURIComponent(term.replace(/ /g, "_"));
      const mdPattern = new RegExp(`\\]\\(\\/wiki\\/${escapeRegex(encodedTerm)}\\)`, "i");

      return wikiPattern.test(content) || mdPattern.test(content);
    });

    if (hasLink) {
      backlinks.push({
        id: entity.id,
        title: entity.title,
        type: entity.type
      });

      if (backlinks.length >= limit) break;
    }
  }

  return backlinks;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * MediaWiki/WikiText parser for Depictionator
 * Converts WikiText to Markdown and handles internal links
 */

export type WikiLink = {
  target: string;
  display: string;
  isExternal: boolean;
};

export type WikiImage = {
  filename: string;
  caption?: string;
  options: string[];
};

export type ParsedWikiText = {
  markdown: string;
  links: WikiLink[];
  images: WikiImage[];
  categories: string[];
  templates: string[];
};

/**
 * Convert WikiText to Markdown
 */
export function wikiTextToMarkdown(wikitext: string): ParsedWikiText {
  const links: WikiLink[] = [];
  const images: WikiImage[] = [];
  const categories: string[] = [];
  const templates: string[] = [];

  let result = wikitext;

  // Handle redirects early
  const redirectMatch = result.match(/^#REDIRECT\s*\[\[([^\]]+)\]\]/i);
  if (redirectMatch) {
    const target = redirectMatch[1].trim();
    const slug = target.replace(/ /g, "_");
    return {
      markdown: `> Redirect to [${target}](/wiki/${encodeURIComponent(slug)})`,
      links: [{ target, display: target, isExternal: false }],
      images: [],
      categories: [],
      templates: [],
    };
  }

  // Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, "");

  // Extract and remove categories
  result = result.replace(/\[\[Category:([^\]]+)\]\]/gi, (_, cat) => {
    categories.push(cat.trim());
    return "";
  });

  // Handle templates (simplified - extract names and keep placeholder)
  result = result.replace(/\{\{([^{}|]+)(?:\|[^{}]*)?\}\}/g, (match, name) => {
    const templateName = name.trim();
    if (!templateName.startsWith("#")) {
      templates.push(templateName);
    }
    return `> Template: ${templateName}\n`;
  });

  // Handle images/files: [[File:name.jpg|options|caption]] or [[Image:...]]
  result = result.replace(
    /\[\[(?:File|Image|繝輔ぃ繧､繝ｫ|逕ｻ蜒楯繧ｫ繝・ざ繝ｪ):([^|\]]+)(?:\|([^\]]*))?\]\]/gi,
    (match, filename, rest) => {
      const parts = rest ? rest.split("|") : [];
      const options: string[] = [];
      let caption = "";

      for (const part of parts) {
        const p = part.trim();
        if (
          /^(thumb|thumbnail|frame|frameless|border|right|left|center|none|\d+px|\d+x\d+px|upright|alt=.*)$/i.test(
            p
          )
        ) {
          options.push(p);
        } else {
          caption = p;
        }
      }

      const rawFilename = filename.trim();
      images.push({ filename: rawFilename, caption, options });

      const imgCaption = caption || rawFilename;
      if (/^asset:/i.test(rawFilename)) {
        const assetId = rawFilename.replace(/^asset:/i, "").trim();
        return `![${imgCaption}](/api/assets/file/${encodeURIComponent(assetId)})`;
      }

      // Convert to Markdown image
      const cleanFilename = rawFilename.replace(/ /g, "_");
      return `![${imgCaption}](/api/wiki/image?file=${encodeURIComponent(cleanFilename)})`;
    }
  );

  // Handle internal links: [[Target|Display]] or [[Target]]
  result = result.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, display) => {
    const cleanTarget = target.trim();
    const cleanDisplay = display?.trim() || cleanTarget;

    // Skip special namespaces we've already handled
    if (/^(File|Image|Category|繝輔ぃ繧､繝ｫ|逕ｻ蜒楯繧ｫ繝・ざ繝ｪ):/i.test(cleanTarget)) {
      return "";
    }

    links.push({
      target: cleanTarget,
      display: cleanDisplay,
      isExternal: false,
    });

    // Convert to Markdown link (internal entity reference)
    const slug = cleanTarget.replace(/ /g, "_");
    return `[${cleanDisplay}](/wiki/${encodeURIComponent(slug)})`;
  });

  // Handle external links: [http://example.com Display text] or bare URLs
  result = result.replace(/\[(\s*https?:\/\/[^\s\]]+)\s*([^\]]*)\]/g, (match, url, text) => {
    const display = text.trim() || url;
    links.push({
      target: url.trim(),
      display,
      isExternal: true,
    });
    return `[${display}](${url.trim()})`;
  });

  // Convert headings: == Heading == to ## Heading
  result = result.replace(/^(={2,6})\s*(.+?)\s*\1\s*$/gm, (match, equals, text) => {
    const level = equals.length;
    const hashes = "#".repeat(level);
    return `${hashes} ${text}`;
  });

  // Convert bold: '''text''' to **text**
  result = result.replace(/'''([^']+)'''/g, "**$1**");

  // Convert italic: ''text'' to *text*
  result = result.replace(/''([^']+)''/g, "*$1*");

  // Convert unordered lists: * item to - item
  result = result.replace(/^\*\s+/gm, "- ");

  // Convert numbered lists: # item to 1. item
  result = result.replace(/^#\s+/gm, "1. ");

  // Convert definition lists: ; term : definition
  result = result.replace(/^;\s*(.+?)(?:\s*:\s*(.+))?$/gm, (match, term, def) => {
    if (def) {
      return `**${term}**: ${def}`;
    }
    return `**${term}**`;
  });

  // Convert horizontal rules: ---- to ---
  result = result.replace(/^-{4,}\s*$/gm, "---");

  // Convert <ref> tags to footnotes (simplified)
  let refCounter = 0;
  result = result.replace(/<ref[^>]*>([^<]*)<\/ref>/gi, (match, content) => {
    refCounter++;
    return `[^${refCounter}]`;
  });
  result = result.replace(/<ref[^/]*\/>/gi, "");

  // Remove remaining HTML tags (simplified)
  result = result.replace(/<br\s*\/?>/gi, "\n");
  result = result.replace(/<\/?(?:div|span|p|small|big|sub|sup|nowiki)[^>]*>/gi, "");

  // Clean up multiple blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return {
    markdown: result.trim(),
    links,
    images,
    categories,
    templates,
  };
}

/**
 * Convert Markdown back to WikiText (for editing compatibility)
 */
export function markdownToWikiText(markdown: string): string {
  let result = markdown;

  // Convert headings: ## Heading to == Heading ==
  result = result.replace(/^(#{2,6})\s+(.+)$/gm, (match, hashes, text) => {
    const level = hashes.length;
    const equals = "=".repeat(level);
    return `${equals} ${text} ${equals}`;
  });

  // Convert bold: **text** to '''text'''
  result = result.replace(/\*\*([^*]+)\*\*/g, "'''$1'''");

  // Convert italic: *text* to ''text''
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "''$1''");

  // Convert unordered lists: - item to * item
  result = result.replace(/^-\s+/gm, "* ");

  // Convert links: [text](url) to external or internal links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return `[${url} ${text}]`;
    }
    if (url.startsWith("/wiki/")) {
      const target = decodeURIComponent(url.replace("/wiki/", "")).replace(/_/g, " ");
      return text && text !== target ? `[[${target}|${text}]]` : `[[${target}]]`;
    }
    // Assume internal link fallback
    return `[[${text}]]`;
  });

  // Convert images: ![alt](/path) to [[File:name]]
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    if (url.startsWith("/api/assets/file/")) {
      const assetId = url.split("/").pop()?.split("?")[0] || "asset";
      return `[[File:asset:${decodeURIComponent(assetId)}|${alt || ""}]]`;
    }
    const filename = url.split("/").pop()?.split("?")[0] || "image";
    return `[[File:${decodeURIComponent(filename)}|${alt || ""}]]`;
  });

  return result;
}

/**
 * Extract entity references from text (both WikiText and Markdown)
 */
export function extractEntityReferences(text: string): string[] {
  const refs = new Set<string>();

  // WikiText internal links
  const wikiMatches = text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
  for (const match of wikiMatches) {
    const target = match[1].trim();
    if (!/^(File|Image|Category|繝輔ぃ繧､繝ｫ|逕ｻ蜒楯繧ｫ繝・ざ繝ｪ):/i.test(target)) {
      refs.add(target);
    }
  }

  // Markdown links to /wiki
  const mdMatches = text.matchAll(/\[([^\]]+)\]\(\/wiki\/([^)]+)\)/g);
  for (const match of mdMatches) {
    const decoded = decodeURIComponent(match[2]).replace(/_/g, " ");
    refs.add(decoded);
  }

  // Backward compatibility: legacy /articles?q= links
  const legacyMatches = text.matchAll(/\[([^\]]+)\]\(\/articles\?q=([^)]+)\)/g);
  for (const match of legacyMatches) {
    refs.add(decodeURIComponent(match[2]));
  }

  // @mentions
  const mentionMatches = text.matchAll(/@([A-Za-z0-9_\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+)/g);
  for (const match of mentionMatches) {
    refs.add(match[1]);
  }

  return Array.from(refs);
}


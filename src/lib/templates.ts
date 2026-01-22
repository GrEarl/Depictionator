/**
 * MediaWiki Template System for Depictionator
 * Provides standard MediaWiki-compatible templates
 */

export type TemplateParams = Record<string, string>;

export type TemplateDefinition = {
  name: string;
  aliases?: string[];
  description: string;
  render: (params: TemplateParams) => string;
};

/**
 * Parse template parameters from wikitext
 * {{Template|param1|param2|key=value}}
 */
export function parseTemplateParams(templateContent: string): TemplateParams {
  const params: TemplateParams = {};
  let positionalIndex = 1;

  // Split by | but respect nested brackets
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < templateContent.length; i++) {
    const char = templateContent[i];
    if (char === "{" || char === "[") {
      depth++;
      current += char;
    } else if (char === "}" || char === "]") {
      depth--;
      current += char;
    } else if (char === "|" && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex !== -1) {
      const key = part.slice(0, eqIndex).trim();
      const value = part.slice(eqIndex + 1).trim();
      params[key] = value;
    } else {
      params[String(positionalIndex)] = part;
      positionalIndex++;
    }
  }

  return params;
}

/**
 * Standard MediaWiki-compatible templates
 */
export const STANDARD_TEMPLATES: TemplateDefinition[] = [
  // Infobox templates
  {
    name: "Infobox",
    aliases: ["Infobox character", "Infobox person", "Infobox location", "Infobox faction"],
    description: "Standard infobox for entities",
    render: (params) => {
      const rows = Object.entries(params)
        .filter(([key]) => !["1", "title", "image", "caption"].includes(key))
        .map(([key, value]) => `| **${key}** | ${value} |`)
        .join("\n");

      const title = params.title || params["1"] || "Infobox";
      const image = params.image ? `![${params.caption || title}](${params.image})` : "";

      return `
> **${title}**
${image}

| Field | Value |
|-------|-------|
${rows}
`;
    },
  },

  // Citation templates
  {
    name: "Cite web",
    aliases: ["Cite news", "Cite journal"],
    description: "Citation for web sources",
    render: (params) => {
      const author = params.author || params.last || "";
      const title = params.title || "";
      const url = params.url || "";
      const date = params.date || params.accessdate || "";
      const publisher = params.publisher || params.website || "";

      let citation = "";
      if (author) citation += `${author}. `;
      if (title) {
        citation += url ? `[${title}](${url})` : `"${title}"`;
        citation += ". ";
      }
      if (publisher) citation += `*${publisher}*. `;
      if (date) citation += `(${date})`;

      return citation.trim() || "[Citation needed]";
    },
  },

  // Formatting templates
  {
    name: "Quote",
    aliases: ["Blockquote", "Quotation"],
    description: "Block quote",
    render: (params) => {
      const text = params["1"] || params.text || "";
      const source = params["2"] || params.source || params.author || "";
      return `> ${text}${source ? `\n> — *${source}*` : ""}`;
    },
  },

  {
    name: "Main",
    aliases: ["Main article", "See also"],
    description: "Reference to main article",
    render: (params) => {
      const target = params["1"] || "";
      const display = params["2"] || target;
      const slug = target.replace(/ /g, "_");
      return `*Main article: [${display}](/wiki/${encodeURIComponent(slug)})*`;
    },
  },

  {
    name: "Nihongo",
    description: "Japanese text with reading",
    render: (params) => {
      const english = params["1"] || "";
      const japanese = params["2"] || "";
      const romaji = params["3"] || "";
      return `${english} (${japanese}${romaji ? `, *${romaji}*` : ""})`;
    },
  },

  // Notice templates
  {
    name: "Stub",
    description: "Stub article notice",
    render: () => `> ⚠️ *This article is a stub. You can help by expanding it.*`,
  },

  {
    name: "Cleanup",
    aliases: ["Needs cleanup"],
    description: "Cleanup notice",
    render: (params) => {
      const reason = params["1"] || params.reason || "improve its quality";
      return `> 🧹 *This article needs cleanup: ${reason}*`;
    },
  },

  {
    name: "Spoiler",
    aliases: ["Spoilers"],
    description: "Spoiler warning",
    render: (params) => {
      const content = params["1"] || "";
      return `> ⚠️ **Spoiler Warning**\n>\n> ${content || "This section contains spoilers."}`;
    },
  },

  {
    name: "WIP",
    aliases: ["Under construction", "Draft"],
    description: "Work in progress notice",
    render: () => `> 🚧 *This article is a work in progress.*`,
  },

  // Date/Time templates
  {
    name: "Start date",
    description: "Start date formatting",
    render: (params) => {
      const year = params["1"] || "";
      const month = params["2"] || "";
      const day = params["3"] || "";
      return [year, month, day].filter(Boolean).join("-");
    },
  },

  // Navigation templates
  {
    name: "TOC",
    aliases: ["Table of contents"],
    description: "Table of contents placeholder",
    render: () => `<!-- TOC -->`,
  },

  {
    name: "NOTOC",
    description: "Hide table of contents",
    render: () => `<!-- NOTOC -->`,
  },
];

/**
 * Get template definition by name
 */
export function getTemplateDefinition(name: string): TemplateDefinition | null {
  const normalized = name.toLowerCase().trim();

  for (const template of STANDARD_TEMPLATES) {
    if (template.name.toLowerCase() === normalized) {
      return template;
    }
    if (template.aliases?.some((alias) => alias.toLowerCase() === normalized)) {
      return template;
    }
  }

  return null;
}

/**
 * Resolve a template with parameters
 */
export function resolveTemplate(name: string, params: TemplateParams): string {
  const definition = getTemplateDefinition(name);

  if (definition) {
    return definition.render(params);
  }

  // Fallback: render as generic template box
  const paramsDisplay = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return `<!-- Template:${name}${paramsDisplay ? ` (${paramsDisplay})` : ""} -->`;
}

/**
 * Process all templates in wikitext
 */
export function processTemplates(wikitext: string): string {
  // Match {{TemplateName|params}}
  return wikitext.replace(/\{\{([^{}]+)\}\}/g, (match, content) => {
    const pipeIndex = content.indexOf("|");
    const templateName = pipeIndex !== -1 ? content.slice(0, pipeIndex).trim() : content.trim();
    const paramsStr = pipeIndex !== -1 ? content.slice(pipeIndex + 1) : "";

    // Skip magic words
    if (templateName.startsWith("#") || templateName.startsWith("TEMPLATE:")) {
      return match;
    }

    const params = parseTemplateParams(paramsStr);
    return resolveTemplate(templateName, params);
  });
}

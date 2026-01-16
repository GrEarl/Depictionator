/**
 * MediaWiki Wikitext Parser
 *
 * Supports:
 * - Headings (==, ===, etc.)
 * - Bold/Italic (**bold**, ''italic'')
 * - Links ([[Page]], [[Page|Display]])
 * - External links ([url text])
 * - Templates {{template|param}}
 * - Tables {| |}
 * - Lists (*, #)
 * - Images [[File:name.jpg|options]]
 */

export interface WikitextParseOptions {
  resolveTemplate?: (name: string, params: string[]) => string;
  resolveLink?: (page: string, display?: string) => string;
  resolveImage?: (filename: string, options: string[]) => string;
}

export function parseWikitext(wikitext: string, options: WikitextParseOptions = {}): string {
  let html = wikitext;

  // 1. Templates {{template|param1|param2}}
  html = html.replace(/\{\{([^}|]+)(\|[^}]+)?\}\}/g, (match, templateName, params) => {
    const paramList = params ? params.slice(1).split('|') : [];
    if (options.resolveTemplate) {
      return options.resolveTemplate(templateName.trim(), paramList);
    }
    return `<span class="wiki-template">[Template: ${templateName.trim()}]</span>`;
  });

  // 2. Headings == H2 ==, === H3 ===, etc.
  html = html.replace(/^(={2,6})\s*(.+?)\s*\1\s*$/gm, (match, equals, title) => {
    const level = equals.length;
    return `<h${level}>${title.trim()}</h${level}>`;
  });

  // 3. Bold '''text'''
  html = html.replace(/'''(.+?)'''/g, '<strong>$1</strong>');

  // 4. Italic ''text''
  html = html.replace(/''(.+?)''/g, '<em>$1</em>');

  // 5. Internal links [[Page]] or [[Page|Display]]
  html = html.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, page, _, display) => {
    const linkText = display || page;
    if (options.resolveLink) {
      return options.resolveLink(page.trim(), linkText.trim());
    }
    return `<a href="/wiki/${encodeURIComponent(page.trim())}" class="wiki-link">${linkText.trim()}</a>`;
  });

  // 6. External links [http://example.com Display Text]
  html = html.replace(/\[((https?:\/\/[^\s]+)(\s+([^\]]+))?)\]/g, (match, full, url, _, text) => {
    const linkText = text || url;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="external-link">${linkText}</a>`;
  });

  // 7. Images [[File:name.jpg|thumb|caption]]
  html = html.replace(/\[\[(File|Image):([^\]|]+)(\|([^\]]+))?\]\]/gi, (match, type, filename, _, optionsStr) => {
    const opts = optionsStr ? optionsStr.split('|') : [];
    if (options.resolveImage) {
      return options.resolveImage(filename.trim(), opts);
    }
    const caption = opts[opts.length - 1] || filename;
    return `<figure class="wiki-image">
      <img src="/api/wiki/image/${encodeURIComponent(filename.trim())}" alt="${caption}" />
      <figcaption>${caption}</figcaption>
    </figure>`;
  });

  // 8. Unordered lists (* item)
  html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // 9. Ordered lists (# item)
  html = html.replace(/^#\s+(.+)$/gm, '<li class="ordered">$1</li>');
  html = html.replace(/(<li class="ordered">.*<\/li>\n?)+/g, '<ol>$&</ol>');

  // 10. Tables {| ... |}
  html = html.replace(/\{\|(.*?)\|\}/gs, (match, content) => {
    let tableHtml = '<table class="wiki-table">';

    // Parse rows |-
    const rows = content.split('|-').filter((r: string) => r.trim());

    rows.forEach((row: string) => {
      tableHtml += '<tr>';

      // Parse cells |
      const cells = row.split(/\n\|(?!\-)/).filter((c: string) => c.trim());

      cells.forEach((cell: string) => {
        const cellContent = cell.replace(/^\|/, '').trim();
        // Header cells start with !
        if (cellContent.startsWith('!')) {
          tableHtml += `<th>${cellContent.slice(1).trim()}</th>`;
        } else {
          tableHtml += `<td>${cellContent}</td>`;
        }
      });

      tableHtml += '</tr>';
    });

    tableHtml += '</table>';
    return tableHtml;
  });

  // 11. Line breaks
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // 12. Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

/**
 * Extract metadata from Wikitext (infoboxes, categories)
 */
export interface WikiMetadata {
  infobox?: Record<string, string>;
  categories: string[];
  interwiki: Record<string, string>;
}

export function extractWikitextMetadata(wikitext: string): WikiMetadata {
  const metadata: WikiMetadata = {
    categories: [],
    interwiki: {}
  };

  // Extract infobox
  const infoboxMatch = wikitext.match(/\{\{Infobox([^}]+)\}\}/is);
  if (infoboxMatch) {
    metadata.infobox = {};
    const params = infoboxMatch[1].split('|').slice(1);
    params.forEach(param => {
      const [key, ...valueParts] = param.split('=');
      if (key && valueParts.length) {
        metadata.infobox![key.trim()] = valueParts.join('=').trim();
      }
    });
  }

  // Extract categories [[Category:Name]]
  const categoryMatches = wikitext.matchAll(/\[\[Category:([^\]]+)\]\]/gi);
  for (const match of categoryMatches) {
    metadata.categories.push(match[1].trim());
  }

  // Extract interwiki links [[lang:Page]]
  const interwikiMatches = wikitext.matchAll(/\[\[([a-z]{2,3}):([^\]]+)\]\]/g);
  for (const match of interwikiMatches) {
    metadata.interwiki[match[1]] = match[2];
  }

  return metadata;
}

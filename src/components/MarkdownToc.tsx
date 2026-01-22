"use client";

import { extractHeadings, type HeadingInfo } from "@/lib/markdown";

type MarkdownTocProps = {
  value: string;
  title?: string;
  minLevel?: number;
  maxLevel?: number;
};

/**
 * Table of Contents component that properly reflects heading hierarchy
 * Based on AGENTS.md requirement: MediaWiki-compatible TOC
 */
export function MarkdownToc({
  value,
  title = "Contents",
  minLevel = 1,
  maxLevel = 4
}: MarkdownTocProps) {
  const headings = extractHeadings(value, { minLevel, maxLevel });
  if (headings.length === 0) return null;

  // Find the minimum level actually used to calculate proper indentation
  const actualMinLevel = Math.min(...headings.map(h => h.level));

  // Build hierarchical TOC items with numbering
  const buildTocItems = (items: HeadingInfo[]) => {
    const counters: number[] = [0, 0, 0, 0, 0, 0]; // For h1-h6

    return items.map((heading, index) => {
      // Reset lower level counters when moving to higher level
      for (let i = heading.level; i < 6; i++) {
        counters[i] = 0;
      }
      // Increment current level counter
      counters[heading.level - 1]++;

      // Build section number (e.g., "1.2.3")
      const sectionNumber = counters
        .slice(actualMinLevel - 1, heading.level)
        .filter(n => n > 0)
        .join(".");

      const indent = (heading.level - actualMinLevel) * 16;

      return {
        ...heading,
        sectionNumber,
        indent,
        index
      };
    });
  };

  const tocItems = buildTocItems(headings);

  return (
    <nav className="toc" aria-label="Table of contents">
      <strong className="toc-title">{title}</strong>
      <ol className="toc-list">
        {tocItems.map((item) => (
          <li
            key={`${item.slug}-${item.index}`}
            className={`toc-item toc-level-${item.level}`}
            style={{ paddingLeft: `${item.indent}px` }}
          >
            <a href={`#${item.slug}`} className="toc-link">
              <span className="toc-number">{item.sectionNumber}</span>
              <span className="toc-text">{item.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Compact inline TOC for sidebars
 */
export function MarkdownTocCompact({
  value,
  minLevel = 2,
  maxLevel = 3
}: Omit<MarkdownTocProps, "title">) {
  const headings = extractHeadings(value, { minLevel, maxLevel });
  if (headings.length === 0) return null;

  const actualMinLevel = Math.min(...headings.map(h => h.level));

  return (
    <nav className="toc-compact" aria-label="Quick navigation">
      <ul className="toc-compact-list">
        {headings.slice(0, 8).map((heading, index) => (
          <li
            key={`${heading.slug}-${index}`}
            className={`toc-compact-item level-${heading.level - actualMinLevel}`}
          >
            <a href={`#${heading.slug}`}>{heading.text}</a>
          </li>
        ))}
        {headings.length > 8 && (
          <li className="toc-compact-more">
            <span>...{headings.length - 8} more</span>
          </li>
        )}
      </ul>
    </nav>
  );
}

"use client";

import { extractHeadings, type HeadingInfo } from "@/lib/markdown";

type MarkdownTocProps = {
  value: string;
  title?: string;
  minLevel?: number;
  maxLevel?: number;
};

export function MarkdownToc({
  value,
  title = "Contents",
  minLevel = 2,
  maxLevel = 4
}: MarkdownTocProps) {
  const headings = extractHeadings(value, { minLevel, maxLevel });
  if (headings.length === 0) return null;

  return (
    <div className="toc">
      <strong>{title}</strong>
      <ul>
        {headings.map((heading: HeadingInfo) => (
          <li
            key={heading.slug}
            style={{ marginLeft: `${Math.max(0, heading.level - minLevel) * 12}px` }}
          >
            <a href={`#${heading.slug}`}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

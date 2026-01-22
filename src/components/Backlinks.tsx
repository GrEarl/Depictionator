import Link from "next/link";
import { toWikiPath } from "@/lib/wiki";

type BacklinkEntity = {
  id: string;
  title: string;
  type: string;
};

type BacklinksProps = {
  backlinks: BacklinkEntity[];
  currentTitle: string;
  maxDisplay?: number;
};

/**
 * Component to display backlinks (pages that link to the current page)
 * Based on AGENTS.md requirement: "バックリンク（どこから参照されているか）"
 */
export function Backlinks({ backlinks, currentTitle, maxDisplay = 10 }: BacklinksProps) {
  if (backlinks.length === 0) {
    return null;
  }

  const displayedLinks = backlinks.slice(0, maxDisplay);
  const remainingCount = backlinks.length - maxDisplay;

  return (
    <section className="backlinks-section">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
        What links here ({backlinks.length})
      </h4>
      <div className="backlinks-list space-y-1">
        {displayedLinks.map((entity) => (
          <Link
            key={entity.id}
            href={toWikiPath(entity.title)}
            className="backlink-item flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-elevated transition-colors group"
          >
            <span className={`entity-type-badge type-${entity.type} text-[9px]`}>
              {entity.type.slice(0, 3).toUpperCase()}
            </span>
            <span className="text-sm text-ink group-hover:text-accent transition-colors truncate">
              {entity.title}
            </span>
          </Link>
        ))}
        {remainingCount > 0 && (
          <Link
            href={`/wiki/Special:WhatLinksHere/${encodeURIComponent(currentTitle)}`}
            className="text-xs text-muted hover:text-accent transition-colors pl-2"
          >
            ...and {remainingCount} more
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * Compact inline version for sidebars
 */
export function BacklinksCompact({ backlinks }: { backlinks: BacklinkEntity[] }) {
  if (backlinks.length === 0) {
    return (
      <div className="text-xs text-muted italic">
        No pages link here yet.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {backlinks.slice(0, 5).map((entity) => (
        <Link
          key={entity.id}
          href={toWikiPath(entity.title)}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg border border-border rounded-full text-[10px] text-muted hover:text-accent hover:border-accent transition-colors"
        >
          {entity.title}
        </Link>
      ))}
      {backlinks.length > 5 && (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] text-muted">
          +{backlinks.length - 5} more
        </span>
      )}
    </div>
  );
}

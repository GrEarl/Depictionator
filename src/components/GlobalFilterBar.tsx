"use client";

import { useGlobalFilters } from "./GlobalFilterProvider";
import { cn } from "@/lib/utils";

type Era = { id: string; name: string };
type Chapter = { id: string; name: string };
type Viewpoint = { id: string; name: string; type: string };

type GlobalFilterBarProps = {
  eras?: Era[];
  chapters?: Chapter[];
  viewpoints?: Viewpoint[];
  showModeToggle?: boolean;
  compact?: boolean;
};

export function GlobalFilterBar({
  eras = [],
  chapters = [],
  viewpoints = [],
  showModeToggle = true,
  compact = false,
}: GlobalFilterBarProps) {
  const { eraId, chapterId, viewpointId, mode, setFilters } = useGlobalFilters();

  return (
    <div
      className={cn(
        "global-filter-bar flex items-center gap-4 px-4 py-2 bg-panel border-b border-border",
        compact && "py-1 gap-2"
      )}
    >
      {/* Current Lens Indicator */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
          Lens
        </span>
        <div className="flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent rounded-md text-xs font-semibold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          {mode === "canon" ? "Canon" : mode === "viewpoint" ? "Viewpoint" : "Compare"}
        </div>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Era Filter */}
      {eras.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Era
          </label>
          <select
            value={eraId}
            onChange={(e) => setFilters({ eraId: e.target.value })}
            className={cn(
              "bg-bg border border-border rounded-md text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-accent",
              compact && "text-[10px] px-1"
            )}
          >
            <option value="all">All Eras</option>
            {eras.map((era) => (
              <option key={era.id} value={era.id}>
                {era.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Chapter Filter */}
      {chapters.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Chapter
          </label>
          <select
            value={chapterId}
            onChange={(e) => setFilters({ chapterId: e.target.value })}
            className={cn(
              "bg-bg border border-border rounded-md text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-accent",
              compact && "text-[10px] px-1"
            )}
          >
            <option value="all">All Chapters</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Viewpoint Filter */}
      {viewpoints.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Viewpoint
          </label>
          <select
            value={viewpointId}
            onChange={(e) => setFilters({ viewpointId: e.target.value })}
            className={cn(
              "bg-bg border border-border rounded-md text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-accent",
              compact && "text-[10px] px-1"
            )}
          >
            <option value="canon">Canon (Omniscient)</option>
            {viewpoints.map((vp) => (
              <option key={vp.id} value={vp.id}>
                {vp.name} ({vp.type})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mode Toggle */}
      {showModeToggle && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-1 p-0.5 bg-bg border border-border rounded-lg">
            {(["canon", "viewpoint", "compare"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setFilters({ mode: m })}
                className={cn(
                  "px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                  mode === m
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Reset Button */}
      <button
        type="button"
        onClick={() =>
          setFilters({
            eraId: "all",
            chapterId: "all",
            viewpointId: "canon",
            mode: "canon",
          })
        }
        className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted hover:text-accent transition-colors"
      >
        Reset Filters
      </button>
    </div>
  );
}

/**
 * Compact version for embedding in headers
 */
export function GlobalFilterBadge() {
  const { eraId, chapterId, viewpointId, mode } = useGlobalFilters();

  const hasFilters = eraId !== "all" || chapterId !== "all" || viewpointId !== "canon" || mode !== "canon";

  if (!hasFilters) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-[10px] font-bold uppercase tracking-wider">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      Filtered
    </div>
  );
}

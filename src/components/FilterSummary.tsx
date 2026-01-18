"use client";

import { useGlobalFilters } from "./GlobalFilterProvider";

export function FilterSummary() {
  const filters = useGlobalFilters();
  const eraLabel = filters.eraId === "all" ? "All" : "Filtered";
  const chapterLabel = filters.chapterId === "all" ? "All" : "Filtered";
  const viewLabel = filters.viewpointId === "canon" ? "Canon" : "Viewpoint";
  return (
    <div className="filter-summary">
      <strong>Filter:</strong> Era {eraLabel} · Chapter {chapterLabel} · View {viewLabel} · {filters.mode}
    </div>
  );
}

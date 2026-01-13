"use client";

import { useGlobalFilters } from "./GlobalFilterProvider";

export function FilterSummary() {
  const filters = useGlobalFilters();
  return (
    <div className="filter-summary">
      <strong>Filter:</strong> Era {filters.eraId} · Chapter {filters.chapterId} · View {filters.viewpointId} · {filters.mode}
    </div>
  );
}

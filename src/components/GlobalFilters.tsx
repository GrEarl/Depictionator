"use client";

import { useGlobalFilters } from "./GlobalFilterProvider";

const ERA_OPTIONS = [
  { value: "all", label: "All Eras" }
];

const CHAPTER_OPTIONS = [
  { value: "all", label: "All Chapters" }
];

const VIEWPOINT_OPTIONS = [
  { value: "canon", label: "Omni (Canon)" }
];

export function GlobalFilters() {
  const { eraId, chapterId, viewpointId, mode, setFilters } = useGlobalFilters();

  return (
    <div className="filter-bar">
      <label>
        World Era
        <select
          value={eraId}
          onChange={(event) => setFilters({ eraId: event.target.value })}
        >
          {ERA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Story Chapter
        <select
          value={chapterId}
          onChange={(event) => setFilters({ chapterId: event.target.value })}
        >
          {CHAPTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Viewpoint
        <select
          value={viewpointId}
          onChange={(event) => setFilters({ viewpointId: event.target.value })}
        >
          {VIEWPOINT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mode
        <select value={mode} onChange={(event) => setFilters({ mode: event.target.value as typeof mode })}>
          <option value="canon">Canon</option>
          <option value="viewpoint">As Viewpoint</option>
          <option value="compare">Compare</option>
        </select>
      </label>
    </div>
  );
}

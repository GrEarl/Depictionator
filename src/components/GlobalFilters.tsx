"use client";
import { useGlobalFilters } from "./GlobalFilterProvider";

type Option = { value: string; label: string };

export function GlobalFilters({
  eras,
  chapters,
  viewpoints
}: {
  eras: Option[];
  chapters: Option[];
  viewpoints: Option[];
}) {
  const { eraId, chapterId, viewpointId, mode, setFilters } = useGlobalFilters();

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <div className="filter-item">
          <span className="filter-label">World Era</span>
          <select
            className="filter-select"
            value={eraId}
            onChange={(event) => setFilters({ eraId: event.target.value })}
          >
            {eras.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <span className="filter-label">Story Chapter</span>
          <select
             className="filter-select"
            value={chapterId}
            onChange={(event) => setFilters({ chapterId: event.target.value })}
          >
            {chapters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-divider"></div>

      <div className="filter-group">
        <div className="filter-item">
          <span className="filter-label">Viewpoint</span>
          <select
             className="filter-select"
            value={viewpointId}
            onChange={(event) => setFilters({ viewpointId: event.target.value })}
          >
            {viewpoints.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <span className="filter-label">Mode</span>
          <select
             className="filter-select"
            value={mode}
            onChange={(event) => setFilters({ mode: event.target.value as typeof mode })}
          >
            <option value="canon">Canon</option>
            <option value="viewpoint">As Viewpoint</option>
            <option value="compare">Compare</option>
          </select>
        </div>
      </div>
    </div>
  );
}
"use client";
import { useGlobalFilters } from "./GlobalFilterProvider";

type Option = { value: string; label: string };
type FilterLabels = {
  worldEra: string;
  storyChapter: string;
  viewpoint: string;
  mode: string;
  modeCanon: string;
  modeViewpoint: string;
  modeCompare: string;
};

export function GlobalFilters({
  eras,
  chapters,
  viewpoints,
  labels
}: {
  eras: Option[];
  chapters: Option[];
  viewpoints: Option[];
  labels: FilterLabels;
}) {
  const { eraId, chapterId, viewpointId, mode, setFilters } = useGlobalFilters();

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <div className="filter-item">
          <span className="filter-label">{labels.worldEra}</span>
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
          <span className="filter-label">{labels.storyChapter}</span>
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
          <span className="filter-label">{labels.viewpoint}</span>
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
          <span className="filter-label">{labels.mode}</span>
          <select
             className="filter-select"
            value={mode}
            onChange={(event) => setFilters({ mode: event.target.value as typeof mode })}
          >
            <option value="canon">{labels.modeCanon}</option>
            <option value="viewpoint">{labels.modeViewpoint}</option>
            <option value="compare">{labels.modeCompare}</option>
          </select>
        </div>
      </div>
    </div>
  );
}

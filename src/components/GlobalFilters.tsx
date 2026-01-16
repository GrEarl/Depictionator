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

  // Get current selection labels
  const currentEra = eras.find(e => e.value === eraId)?.label ?? eras[0]?.label;
  const currentChapter = chapters.find(c => c.value === chapterId)?.label ?? chapters[0]?.label;
  const currentViewpoint = viewpoints.find(v => v.value === viewpointId)?.label ?? viewpoints[0]?.label;

  // Check if filtering is active (not "all" or default)
  const isEraActive = eraId !== "all" && eraId !== "";
  const isChapterActive = chapterId !== "all" && chapterId !== "";
  const isViewpointActive = viewpointId !== "canon" && viewpointId !== "";
  const isModeActive = mode !== "canon";

  return (
    <div className="filter-bar">
      {/* Current Lens Display - Large and Visual */}
      <div className="current-lens-display">
        <span className="lens-label">🔭 Current Lens:</span>
        <div className="lens-chips">
          {isEraActive && (
            <span className="lens-chip lens-era">
              <span className="chip-icon">📅</span> {currentEra}
            </span>
          )}
          {isChapterActive && (
            <span className="lens-chip lens-chapter">
              <span className="chip-icon">📖</span> {currentChapter}
            </span>
          )}
          {isViewpointActive && (
            <span className="lens-chip lens-viewpoint">
              <span className="chip-icon">👁️</span> {currentViewpoint}
            </span>
          )}
          {isModeActive && (
            <span className="lens-chip lens-mode">
              <span className="chip-icon">🔄</span> {mode}
            </span>
          )}
          {!isEraActive && !isChapterActive && !isViewpointActive && !isModeActive && (
            <span className="lens-chip lens-default">
              <span className="chip-icon">✨</span> {labels.modeCanon} (All Time)</span>
          )}
        </div>
      </div>

      <div className="filter-divider"></div>

      {/* Filter Controls */}
      <div className="filter-group">
        <div className="filter-item">
          <span className="filter-label">{labels.worldEra}</span>
          <select
            className={`filter-select ${isEraActive ? 'filter-active' : ''}`}
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
            className={`filter-select ${isChapterActive ? 'filter-active' : ''}`}
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
            className={`filter-select ${isViewpointActive ? 'filter-active' : ''}`}
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
            className={`filter-select ${isModeActive ? 'filter-active' : ''}`}
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

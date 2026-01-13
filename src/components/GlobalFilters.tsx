"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const params = useSearchParams();
  const { eraId, chapterId, viewpointId, mode, setFilters } = useGlobalFilters();

  function updateUrl(next: { eraId?: string; chapterId?: string; viewpointId?: string; mode?: string }) {
    const search = new URLSearchParams(params.toString());
    if (next.eraId) search.set("era", next.eraId);
    if (next.chapterId) search.set("chapter", next.chapterId);
    if (next.viewpointId) search.set("viewpoint", next.viewpointId);
    if (next.mode) search.set("mode", next.mode);
    router.replace(`?${search.toString()}`);
  }

  return (
    <div className="filter-bar">
      <label>
        World Era
        <select
          value={eraId}
          onChange={(event) => {
            setFilters({ eraId: event.target.value });
            updateUrl({ eraId: event.target.value });
          }}
        >
          {eras.map((option) => (
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
          onChange={(event) => {
            setFilters({ chapterId: event.target.value });
            updateUrl({ chapterId: event.target.value });
          }}
        >
          {chapters.map((option) => (
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
          onChange={(event) => {
            setFilters({ viewpointId: event.target.value });
            updateUrl({ viewpointId: event.target.value });
          }}
        >
          {viewpoints.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mode
        <select
          value={mode}
          onChange={(event) => {
            setFilters({ mode: event.target.value as typeof mode });
            updateUrl({ mode: event.target.value });
          }}
        >
          <option value="canon">Canon</option>
          <option value="viewpoint">As Viewpoint</option>
          <option value="compare">Compare</option>
        </select>
      </label>
    </div>
  );
}

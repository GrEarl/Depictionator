"use client";

import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

type DisplayMode = "canon" | "viewpoint" | "compare";

type FilterState = {
  eraId: string;
  chapterId: string;
  viewpointId: string;
  mode: DisplayMode;
};

type FilterContextValue = FilterState & {
  setFilters: (next: Partial<FilterState>) => void;
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function GlobalFilterProvider({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const [state, setState] = useState<FilterState>({
    eraId: params.get("era") ?? "all",
    chapterId: params.get("chapter") ?? "all",
    viewpointId: params.get("viewpoint") ?? "canon",
    mode: (params.get("mode") as DisplayMode) ?? "canon"
  });

  useEffect(() => {
    setState({
      eraId: params.get("era") ?? "all",
      chapterId: params.get("chapter") ?? "all",
      viewpointId: params.get("viewpoint") ?? "canon",
      mode: (params.get("mode") as DisplayMode) ?? "canon"
    });
  }, [params]);

  const value = useMemo(
    () => ({
      ...state,
      setFilters: (next: Partial<FilterState>) =>
        setState((prev) => ({ ...prev, ...next }))
    }),
    [state]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useGlobalFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error("GlobalFilterProvider is missing");
  }
  return ctx;
}

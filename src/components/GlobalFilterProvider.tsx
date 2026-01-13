"use client";

import { createContext, useContext, useMemo, useState } from "react";

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
  const [state, setState] = useState<FilterState>({
    eraId: "all",
    chapterId: "all",
    viewpointId: "canon",
    mode: "canon"
  });

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

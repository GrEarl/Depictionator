"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  const router = useRouter();

  const state = useMemo(
    () => ({
      eraId: params.get("era") ?? "all",
      chapterId: params.get("chapter") ?? "all",
      viewpointId: params.get("viewpoint") ?? "canon",
      mode: (params.get("mode") as DisplayMode) ?? "canon"
    }),
    [params]
  );

  const setFilters = useCallback(
    (next: Partial<FilterState>) => {
      const search = new URLSearchParams(params.toString());
      if (next.eraId) search.set("era", next.eraId);
      if (next.chapterId) search.set("chapter", next.chapterId);
      if (next.viewpointId) search.set("viewpoint", next.viewpointId);
      if (next.mode) search.set("mode", next.mode);
      router.replace(`?${search.toString()}`);
    },
    [params, router]
  );

  const value = useMemo(
    () => ({
      ...state,
      setFilters
    }),
    [state, setFilters]
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

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import type { ChartFiltersV0 } from "../data/types";
import { filtersFromSearchParams, filtersToSearchParams } from "./filters";

export function useFiltersFromUrl(): ChartFiltersV0 {
  const searchParams = useSearchParams();
  return filtersFromSearchParams(searchParams);
}

export function useUpdateFiltersUrl() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (filters: ChartFiltersV0) => {
      const params = filtersToSearchParams(filters);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname]
  );
}

export function useFilters(): {
  filters: ChartFiltersV0;
  updateFilters: (filters: ChartFiltersV0) => void;
} {
  const filters = useFiltersFromUrl();
  const updateFilters = useUpdateFiltersUrl();

  return { filters, updateFilters };
}

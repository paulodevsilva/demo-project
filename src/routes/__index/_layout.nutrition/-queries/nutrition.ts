import { queryOptions } from "@tanstack/react-query";
import { getNutritionEntriesServerFn, getTodayNutritionSummaryServerFn } from "@/lib/nutrition.server";

export const nutritionEntriesPageQueryOptions = (page: number, pageSize: number) =>
  queryOptions({
    queryKey: ["nutrition-entries", page, pageSize],
    queryFn: () => getNutritionEntriesServerFn({ data: { page, pageSize } }),
    staleTime: 60 * 1000,
  });

export const nutritionEntriesQueryOptions = () =>
  queryOptions({
    queryKey: ["nutrition-entries", 1, 10],
    queryFn: () => getNutritionEntriesServerFn({ data: { page: 1, pageSize: 10 } }),
    staleTime: 60 * 1000,
  });

export const todayNutritionSummaryQueryOptions = () =>
  queryOptions({
    queryKey: ["nutrition-today-summary"],
    queryFn: () => getTodayNutritionSummaryServerFn(),
    staleTime: 30 * 1000,
  });

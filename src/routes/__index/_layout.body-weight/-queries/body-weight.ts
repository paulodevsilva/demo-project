import { queryOptions } from "@tanstack/react-query";
import { getBodyWeightEntriesServerFn, getLatestBodyWeightServerFn } from "@/lib/body-weight.server";

export const bodyWeightEntriesQueryOptions = () =>
  queryOptions({
    queryKey: ["body-weight-entries", 1, 10],
    queryFn: () => getBodyWeightEntriesServerFn({ data: { page: 1, pageSize: 10 } }),
    staleTime: 60 * 1000,
  });

export const bodyWeightEntriesPageQueryOptions = (page: number, pageSize: number) =>
  queryOptions({
    queryKey: ["body-weight-entries", page, pageSize],
    queryFn: () => getBodyWeightEntriesServerFn({ data: { page, pageSize } }),
    staleTime: 60 * 1000,
  });

export const latestBodyWeightQueryOptions = () =>
  queryOptions({
    queryKey: ["latest-body-weight"],
    queryFn: () => getLatestBodyWeightServerFn(),
    staleTime: 60 * 1000,
  });

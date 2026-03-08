import { getMovementProgressionServerFn, getWorkoutHistoryServerFn } from "@/lib/workouts.server";
import { queryOptions } from "@tanstack/react-query";

export const workoutHistoryQueryOptions = () =>
  queryOptions({
    queryKey: ["workout-history", 1, 10],
    queryFn: () => getWorkoutHistoryServerFn({ data: { page: 1, pageSize: 10 } }),
    staleTime: 2 * 60 * 1000,
  });

export const workoutHistoryPageQueryOptions = (page: number, pageSize: number) =>
  queryOptions({
    queryKey: ["workout-history", page, pageSize],
    queryFn: () => getWorkoutHistoryServerFn({ data: { page, pageSize } }),
    staleTime: 2 * 60 * 1000,
  });

export const movementProgressionQueryOptions = (movementId: string, metric: "max_weight" | "total_reps" | "total_volume") =>
  queryOptions({
    queryKey: ["movement-progression", movementId, metric],
    queryFn: () => getMovementProgressionServerFn({ data: { movementId, metric } }),
    enabled: Boolean(movementId),
    staleTime: 2 * 60 * 1000,
  });

import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { deleteWorkoutsServerFn } from "@/lib/workouts.server";
import { getMovementsServerFn } from "@/lib/movements.server";
import { Trash2 } from "lucide-react";
import { movementProgressionQueryOptions, workoutHistoryPageQueryOptions, workoutHistoryQueryOptions } from "./-queries/workout-history";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SimpleLineChart } from "@/components/ui/simple-line-chart";

type Movement = { id: string; name: string };
type WorkoutSet = { id: string; reps: number; weight: number; movement: Movement };
type Workout = { id: string; completedAt: string | null; sets: WorkoutSet[] };
type PaginatedWorkoutHistory = {
  items: Workout[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
type ProgressionPoint = { date: string; value: number };
type MovementSummary = { movementId: string; movementName: string; maxWeight: number; avgReps: number; numSets: number };
type PreparedWorkout = {
  id: string;
  completedAt: string | null;
  totalSets: number;
  movementSummaries: MovementSummary[];
  movementSummaryMap: Map<string, MovementSummary>;
};

const metricLabels = {
  max_weight: "Maximum Weight",
  total_reps: "Total Reps",
  total_volume: "Total Volume",
} as const;

type ProgressionMetric = keyof typeof metricLabels;

export const Route = createFileRoute("/__index/_layout/workout-history/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(workoutHistoryQueryOptions());
  },
  component: WorkoutHistoryPage,
});

function WorkoutHistoryPage() {
  const queryClient = useQueryClient();
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const { data: workoutsData, isFetching } = useQuery(workoutHistoryPageQueryOptions(page, pageSize));
  const paginatedWorkouts = workoutsData as PaginatedWorkoutHistory | undefined;
  const workouts = paginatedWorkouts?.items ?? [];
  const pagination = paginatedWorkouts?.pagination ?? {
    page,
    pageSize,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  const [selectedWorkouts, setSelectedWorkouts] = useState<Set<string>>(new Set());

  const preparedWorkouts = useMemo<PreparedWorkout[]>(
    () =>
      workouts.map((workout) => {
        const setsByMovement = new Map<string, { name: string; sets: WorkoutSet[] }>();
        workout.sets.forEach((set) => {
          const existing = setsByMovement.get(set.movement.id);
          if (existing) {
            existing.sets.push(set);
            return;
          }
          setsByMovement.set(set.movement.id, { name: set.movement.name, sets: [set] });
        });

        const movementSummaries = Array.from(setsByMovement.entries()).map(([movementId, data]) => {
          const maxWeight = Math.max(...data.sets.map((set) => set.weight));
          const avgReps = Math.round(data.sets.reduce((sum, set) => sum + set.reps, 0) / data.sets.length);
          const numSets = data.sets.length;
          return { movementId, movementName: data.name, maxWeight, avgReps, numSets };
        });

        return {
          id: workout.id,
          completedAt: workout.completedAt,
          totalSets: workout.sets.length,
          movementSummaries,
          movementSummaryMap: new Map(movementSummaries.map((summary) => [summary.movementId, summary])),
        };
      }),
    [workouts],
  );

  const { data: movementsData = [] } = useQuery({
    queryKey: ["movements"],
    queryFn: () => getMovementsServerFn(),
    staleTime: 2 * 60 * 1000,
  });
  const uniqueMovements = (movementsData as Movement[]).map((movement) => [movement.id, movement.name] as const);

  const [selectedMovementId, setSelectedMovementId] = useState<string>(uniqueMovements[0]?.[0] ?? "");
  const [metric, setMetric] = useState<ProgressionMetric>("max_weight");

  useEffect(() => {
    if (!selectedMovementId && uniqueMovements.length > 0) {
      setSelectedMovementId(uniqueMovements[0][0]);
    }
  }, [selectedMovementId, uniqueMovements]);

  const { data: progressionDataData = [] } = useQuery(movementProgressionQueryOptions(selectedMovementId, metric));
  const progressionData = progressionDataData as ProgressionPoint[];

  const deleteWorkoutsMutation = useMutation({
    mutationFn: (workoutIds: string[]) => deleteWorkoutsServerFn({ data: { workoutIds } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-history"] });
      queryClient.invalidateQueries({ queryKey: ["movement-progression"] });
      setSelectedWorkouts(new Set());
    },
  });

  const toggleWorkout = (id: string) => {
    setSelectedWorkouts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedWorkouts.size === preparedWorkouts.length) {
      setSelectedWorkouts(new Set());
    } else {
      setSelectedWorkouts(new Set(preparedWorkouts.map((workout) => workout.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedWorkouts.size === 0) return;
    deleteWorkoutsMutation.mutate(Array.from(selectedWorkouts));
  };

  useEffect(() => {
    if (!isFetching && preparedWorkouts.length === 0 && pagination.page > 1) {
      setPage((currentPage) => Math.max(1, currentPage - 1));
    }
  }, [isFetching, preparedWorkouts.length, pagination.page]);

  const progressionPoints = progressionData.map((point) => ({
    label: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: point.value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Workout History</h1>
        {isFetching ? <p className="text-xs text-slate-500">Updating page...</p> : null}
      </div>

      <Card className="relative z-0 overflow-hidden bg-white">
        <CardHeader className="space-y-4">
          <CardTitle>Movement Progression</CardTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select
              data-testid="progression-movement-select"
              value={selectedMovementId}
              onChange={(event) => setSelectedMovementId(event.target.value)}
              className="w-full">
              <option value="">Select movement</option>
              {uniqueMovements.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <Select
              data-testid="progression-metric-select"
              value={metric}
              onChange={(event) => setMetric(event.target.value as ProgressionMetric)}
              className="w-full">
              {Object.entries(metricLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selectedMovementId ? (
            <SimpleLineChart points={progressionPoints} yLabel={metricLabels[metric]} />
          ) : (
            <p className="text-sm text-slate-500">Select a movement to see progression.</p>
          )}
        </CardContent>
      </Card>

      <Card className="relative z-10 bg-white">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Completed Workouts</CardTitle>
          <Button
            data-testid="delete-selected-workouts"
            size="sm"
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={handleDeleteSelected}
            disabled={selectedWorkouts.size === 0}>
            <Trash2 className="mr-2 h-4 w-4" />
            {deleteWorkoutsMutation.isPending ? "Deleting..." : `Delete Selected (${selectedWorkouts.size})`}
          </Button>
        </CardHeader>
        <CardContent>
          {workouts.length === 0 ? (
            <p className="text-sm text-slate-500">No completed workouts yet.</p>
          ) : (
            <div className="max-h-[62vh] overflow-y-auto pr-1 scroll-smooth">
              <div className="space-y-3 md:hidden">
                {preparedWorkouts.map((workout) => {
                  return (
                    <article
                      key={workout.id}
                      className={`rounded-xl border px-3 py-3 ${selectedWorkouts.has(workout.id) ? "border-primary/40 bg-primary/10" : "border-slate-200 bg-white"}`}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {workout.completedAt
                              ? new Date(workout.completedAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "-"}
                          </p>
                          <p className="text-xs text-slate-500">{workout.totalSets} sets</p>
                        </div>
                        <input
                          data-testid={`select-workout-${workout.id}`}
                          type="checkbox"
                          checked={selectedWorkouts.has(workout.id)}
                          onChange={() => toggleWorkout(workout.id)}
                          className="mt-1 rounded border-gray-300"
                        />
                      </div>
                      <div className="space-y-1.5">
                        {uniqueMovements.map(([movementId, movementName]) => {
                          const summary = workout.movementSummaryMap.get(movementId);
                          if (!summary) return null;
                          return (
                            <p key={movementId} className="text-xs text-slate-600">
                              <span className="font-medium text-slate-800">{movementName}:</span> {summary.maxWeight} lbs /{" "}
                              {summary.avgReps} reps / {summary.numSets} sets
                            </p>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm" data-testid="workout-history-table">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="w-14 px-4 py-3 text-left align-middle">
                        <input
                          data-testid="select-all-workouts"
                          type="checkbox"
                          checked={selectedWorkouts.size === preparedWorkouts.length}
                          onChange={toggleAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Sets</th>
                      {uniqueMovements.map(([id, name]) => (
                        <th key={id} className="px-4 py-3 text-right font-medium text-slate-600">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preparedWorkouts.map((workout) => {
                      const isSelected = selectedWorkouts.has(workout.id);
                      return (
                        <tr
                          key={workout.id}
                          className={`border-b border-slate-100 ${isSelected ? "bg-primary/10" : "hover:bg-slate-50"}`}>
                          <td className="w-14 px-4 py-3 text-left align-middle">
                            <input
                              data-testid={`select-workout-${workout.id}`}
                              type="checkbox"
                              checked={selectedWorkouts.has(workout.id)}
                              onChange={() => toggleWorkout(workout.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {workout.completedAt
                              ? new Date(workout.completedAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{workout.totalSets}</td>
                          {uniqueMovements.map(([movementId]) => {
                            const summary = workout.movementSummaryMap.get(movementId);
                            if (!summary) {
                              return (
                                <td key={movementId} className="px-4 py-3 text-right text-slate-300">
                                  -
                                </td>
                              );
                            }
                            return (
                              <td key={movementId} className="px-4 py-3 text-right text-slate-600">
                                {summary.maxWeight} lbs / {summary.avgReps} reps / {summary.numSets} sets
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <p data-testid="workout-history-page-label" className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} workouts
            </p>
            <div className="flex gap-2">
              <Button
                data-testid="workout-history-prev-page"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={!pagination.hasPreviousPage}>
                Previous
              </Button>
              <Button
                data-testid="workout-history-next-page"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPage((currentPage) => currentPage + 1)}
                disabled={!pagination.hasNextPage}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

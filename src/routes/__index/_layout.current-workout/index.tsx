import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createWorkoutServerFn, completeWorkoutServerFn, addSetServerFn, deleteSetServerFn } from "@/lib/workouts.server";
import { Play, Check, Plus, X } from "lucide-react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { currentWorkoutQueryOptions, latestBodyWeightQueryOptions, movementsQueryOptions } from "./-queries/current-workout";
import { toast } from "react-toastify";

type MovementOption = {
  id: string;
  name: string;
  isBodyweight: boolean;
  defaultWeight: number | null;
  defaultReps: number | null;
};

type SetMovement = {
  id: string;
  name: string;
  isBodyweight: boolean;
};

type WorkoutSet = {
  id: string;
  reps: number;
  weight: number;
  movement: SetMovement;
};

type Workout = {
  id: string;
  completedAt: Date | null;
  sets: WorkoutSet[];
} | null;

type LatestBodyWeightEntry = {
  id: string;
  weight: number;
  measuredAt: Date;
} | null;

export const Route = createFileRoute("/__index/_layout/current-workout/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(currentWorkoutQueryOptions()),
      context.queryClient.ensureQueryData(movementsQueryOptions()),
      context.queryClient.ensureQueryData(latestBodyWeightQueryOptions()),
    ]);
  },
  component: CurrentWorkoutPage,
});

function CurrentWorkoutPage() {
  const queryClient = useQueryClient();
  const { data: workoutData } = useSuspenseQuery(currentWorkoutQueryOptions());
  const { data: movementsData } = useSuspenseQuery(movementsQueryOptions());
  const { data: latestBodyWeightData } = useSuspenseQuery(latestBodyWeightQueryOptions());
  const workout = workoutData as Workout;
  const movements = movementsData as MovementOption[];
  const latestBodyWeight = latestBodyWeightData as LatestBodyWeightEntry;

  const [selectedMovement, setSelectedMovement] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");

  const selectedMovementRecord = useMemo(
    () => movements.find((movement) => movement.id === selectedMovement),
    [movements, selectedMovement],
  );
  const isBodyweightSelected = Boolean(selectedMovementRecord?.isBodyweight);
  const hasBodyweightReference = Boolean(latestBodyWeight);

  const createWorkoutMutation = useMutation({
    mutationFn: () => createWorkoutServerFn(),
    onSuccess: (result) => {
      if (!result?.success || !result.workout) {
        const errorMessage = (result as { error?: string } | undefined)?.error;
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.error("Could not start workout.");
        }
        return;
      }
      queryClient.setQueryData(currentWorkoutQueryOptions().queryKey, {
        ...result.workout,
        sets: [],
      });
    },
    onError: () => toast.error("Failed to start workout."),
  });

  const completeWorkoutMutation = useMutation({
    mutationFn: () => completeWorkoutServerFn(),
    onSuccess: async (result) => {
      if (!result?.success) {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.error("Could not complete workout.");
        }
        return;
      }
      queryClient.setQueryData(currentWorkoutQueryOptions().queryKey, null);
      await queryClient.invalidateQueries({ queryKey: ["workout-history"] });
    },
    onError: () => toast.error("Failed to complete workout."),
  });

  const addSetMutation = useMutation({
    mutationFn: (data: { movementId: string; reps: number; weight?: number }) => addSetServerFn({ data }),
    onSuccess: (result) => {
      if (!result?.success || !result.set) {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.error("Could not add set.");
        }
        return;
      }
      queryClient.setQueryData(currentWorkoutQueryOptions().queryKey, (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          sets: [...previous.sets, result.set as WorkoutSet],
        };
      });
      setReps("");
      if (selectedMovementRecord?.isBodyweight && latestBodyWeight) {
        setWeight(String(latestBodyWeight.weight));
      } else {
        setWeight("");
      }
    },
    onError: () => toast.error("Failed to add set."),
  });

  const deleteSetMutation = useMutation({
    mutationFn: (setId: string) => deleteSetServerFn({ data: { setId } }),
    onSuccess: (result, setId) => {
      if (!result?.success) {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.error("Could not delete set.");
        }
        return;
      }
      queryClient.setQueryData(currentWorkoutQueryOptions().queryKey, (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          sets: previous.sets.filter((set) => set.id !== setId),
        };
      });
    },
    onError: () => toast.error("Failed to delete set."),
  });

  const handleAddSet = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedReps = Number.parseInt(reps, 10);
    const parsedWeight = isBodyweightSelected ? undefined : weight.trim() === "" ? undefined : Number.parseInt(weight, 10);
    if (!selectedMovement || !Number.isFinite(parsedReps)) return;
    if (isBodyweightSelected && !hasBodyweightReference) {
      toast.error("Add a body weight entry before logging this movement.");
      return;
    }
    if (parsedWeight !== undefined && !Number.isFinite(parsedWeight)) return;
    if (parsedWeight === undefined && !isBodyweightSelected) return;

    addSetMutation.mutate({
      movementId: selectedMovement,
      reps: parsedReps,
      weight: parsedWeight,
    });
  };

  if (!workout) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-900">Current Workout</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-slate-500">No active workout. Ready to start?</p>
            <Button data-testid="start-workout-button" onClick={() => createWorkoutMutation.mutate()} size="lg">
              <Play className="mr-2 h-4 w-4" />
              {createWorkoutMutation.isPending ? "Starting..." : "Start Workout"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Current Workout</h1>
        <Button
          data-testid="complete-workout-button"
          variant="outline"
          onClick={() => completeWorkoutMutation.mutate()}
          className="w-full sm:w-auto">
          <Check className="mr-2 h-4 w-4" />
          {completeWorkoutMutation.isPending ? "Completing..." : "Complete Workout"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddSet} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
            <Select
              data-testid="set-movement-select"
              value={selectedMovement}
              onChange={(e) => {
                const nextMovementId = e.target.value;
                setSelectedMovement(nextMovementId);
                const nextMovement = movements.find((movement) => movement.id === nextMovementId);
                if (!nextMovement) {
                  setWeight("");
                  return;
                }
                if (nextMovement.isBodyweight && latestBodyWeight) {
                  setWeight(String(latestBodyWeight.weight));
                  return;
                }
                setWeight("");
              }}
              className="w-full lg:col-span-5">
              <option value="">Select movement</option>
              {movements.map((movement) => (
                <option key={movement.id} value={movement.id}>
                  {movement.name}
                </option>
              ))}
            </Select>
            <Input
              data-testid="set-weight-input"
              type="number"
              placeholder={isBodyweightSelected ? "Auto from body weight" : "Weight"}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full lg:col-span-2"
              min={0}
              disabled={isBodyweightSelected}
            />
            <Input
              data-testid="set-reps-input"
              type="number"
              placeholder="Reps"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full lg:col-span-2"
              min={1}
            />
            <Button
              data-testid="add-set-button"
              type="submit"
              disabled={!selectedMovement || !reps || (isBodyweightSelected ? !hasBodyweightReference : !weight)}
              size="sm"
              className="w-full lg:col-span-3">
              <Plus className="mr-1 h-4 w-4" />
              {addSetMutation.isPending ? "Adding..." : "Add"}
            </Button>
            {selectedMovementRecord && selectedMovementRecord.isBodyweight && selectedMovementRecord.defaultReps !== null ? (
              <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-12">
                Default target for this movement: {selectedMovementRecord.defaultReps} reps. Weight is auto-filled from your latest body
                weight entry.
              </p>
            ) : null}
            {selectedMovementRecord && !selectedMovementRecord.isBodyweight && (selectedMovementRecord.defaultWeight !== null || selectedMovementRecord.defaultReps !== null) ? (
              <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-12">
                Default target for this movement: {selectedMovementRecord.defaultWeight ?? "-"} lbs •{" "}
                {selectedMovementRecord.defaultReps ?? "-"} reps. Reference only, you can log different values today.
              </p>
            ) : null}
          </form>
          {workout.sets.length === 0 ? (
            <p className="text-sm text-slate-500">No sets yet. Add exercises to your workout!</p>
          ) : (
            <ul className="max-h-[48vh] space-y-2 overflow-y-auto pr-1 scroll-smooth" data-testid="sets-list">
              {workout.sets.map((set) => (
                <li
                  key={set.id}
                  className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="font-medium">{set.movement.name}</span>
                    <span className="ml-2 text-slate-500 sm:inline">
                      {set.reps} reps × {set.weight} lbs
                    </span>
                  </div>
                  <Button
                    data-testid={`delete-set-${set.id}`}
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSetMutation.mutate(set.id)}
                    className="h-8 w-8 self-end text-slate-400 sm:self-auto">
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

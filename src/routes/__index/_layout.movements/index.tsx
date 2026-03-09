import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { movementsQueryOptions } from "./-queries/movements";
import { createMovementServerFn, deleteMovementServerFn, updateMovementServerFn } from "@/lib/movements.server";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/components/ui/app-toast";

type Movement = {
  id: string;
  name: string;
  isBodyweight: boolean;
  defaultWeight: number | null;
  defaultReps: number | null;
};

export const Route = createFileRoute("/__index/_layout/movements/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(movementsQueryOptions());
  },
  component: MovementsPage,
});

function MovementsPage() {
  const { queryClient } = Route.useRouteContext();
  const { data } = useSuspenseQuery(movementsQueryOptions());
  const movements = data as Movement[];
  const [name, setName] = useState("");
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [defaultWeight, setDefaultWeight] = useState("");
  const [defaultReps, setDefaultReps] = useState("");
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsBodyweight, setEditIsBodyweight] = useState(false);
  const [editDefaultWeight, setEditDefaultWeight] = useState("");
  const [editDefaultReps, setEditDefaultReps] = useState("");

  const createMovementMutation = useMutation({
    mutationFn: (data: { name: string; isBodyweight: boolean; defaultWeight?: number; defaultReps?: number }) =>
      createMovementServerFn({ data }),
    onSuccess: (result) => {
      if (!result?.success || !result.movement) {
        const errorMessage = (result as { error?: string } | undefined)?.error;
        showErrorToast("Could not create movement", errorMessage ?? "Please try again.");
        return;
      }
      const movement = result.movement as Movement;
      queryClient.setQueryData(movementsQueryOptions().queryKey, (previous: Movement[] | undefined) =>
        previous ? [...previous, movement].sort((a, b) => a.name.localeCompare(b.name)) : [movement],
      );
      setName("");
      setIsBodyweight(false);
      setDefaultWeight("");
      setDefaultReps("");
      showSuccessToast("Movement created", `${movement.name} was added.`);
    },
    onError: () => showErrorToast("Could not create movement", "Failed to create movement."),
  });

  const deleteMovementMutation = useMutation({
    mutationFn: (movementId: string) => deleteMovementServerFn({ data: { movementId } }),
    onSuccess: (result, movementId) => {
      if (!result?.success) {
        const errorMessage = (result as { error?: string } | undefined)?.error;
        showErrorToast("Could not delete movement", errorMessage ?? "Please try again.");
        return;
      }
      queryClient.setQueryData(movementsQueryOptions().queryKey, (previous: Movement[] | undefined) =>
        previous ? previous.filter((movement) => movement.id !== movementId) : previous,
      );
      showSuccessToast("Movement deleted");
    },
    onError: () => showErrorToast("Could not delete movement", "Failed to delete movement."),
  });

  const updateMovementMutation = useMutation({
    mutationFn: (data: {
      movementId: string;
      name: string;
      isBodyweight: boolean;
      defaultWeight?: number;
      defaultReps?: number;
    }) => updateMovementServerFn({ data }),
    onSuccess: (result, variables) => {
      if (!result?.success) {
        const errorMessage = (result as { error?: string } | undefined)?.error;
        showErrorToast("Could not update movement", errorMessage ?? "Please try again.");
        return;
      }
      queryClient.setQueryData(movementsQueryOptions().queryKey, (previous: Movement[] | undefined) =>
        previous
          ? previous
              .map((movement) =>
                movement.id === variables.movementId
                  ? {
                      ...movement,
                      name: variables.name,
                      isBodyweight: variables.isBodyweight,
                      defaultWeight: variables.defaultWeight ?? null,
                      defaultReps: variables.defaultReps ?? null,
                    }
                  : movement,
              )
              .sort((a, b) => a.name.localeCompare(b.name))
          : previous,
      );
      setEditingMovementId(null);
      setEditName("");
      setEditIsBodyweight(false);
      setEditDefaultWeight("");
      setEditDefaultReps("");
      showSuccessToast("Movement updated", `${variables.name} was updated.`);
    },
    onError: () => showErrorToast("Could not update movement", "Failed to update movement."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      showWarningToast("Movement name is required");
      return;
    }
    const parsedDefaultWeight = isBodyweight ? undefined : defaultWeight.trim() === "" ? undefined : Number.parseInt(defaultWeight, 10);
    const parsedDefaultReps = defaultReps.trim() === "" ? undefined : Number.parseInt(defaultReps, 10);

    if (parsedDefaultWeight !== undefined && (!Number.isFinite(parsedDefaultWeight) || parsedDefaultWeight < 0)) {
      showWarningToast("Invalid default weight", "Default weight must be zero or greater.");
      return;
    }
    if (parsedDefaultReps !== undefined && (!Number.isFinite(parsedDefaultReps) || parsedDefaultReps < 1)) {
      showWarningToast("Invalid default reps", "Default reps must be at least 1.");
      return;
    }

    createMovementMutation.mutate({
      name: trimmedName,
      isBodyweight,
      defaultWeight: parsedDefaultWeight,
      defaultReps: parsedDefaultReps,
    });
  };

  const handleStartEdit = (movement: Movement) => {
    setEditingMovementId(movement.id);
    setEditName(movement.name);
    setEditIsBodyweight(movement.isBodyweight);
    setEditDefaultWeight(movement.defaultWeight === null ? "" : String(movement.defaultWeight));
    setEditDefaultReps(movement.defaultReps === null ? "" : String(movement.defaultReps));
  };

  const handleCancelEdit = () => {
    setEditingMovementId(null);
    setEditName("");
    setEditIsBodyweight(false);
    setEditDefaultWeight("");
    setEditDefaultReps("");
  };

  const handleSaveEdit = (movementId: string) => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      showWarningToast("Movement name is required");
      return;
    }
    const parsedDefaultWeight = editIsBodyweight
      ? undefined
      : editDefaultWeight.trim() === ""
        ? undefined
        : Number.parseInt(editDefaultWeight, 10);
    const parsedDefaultReps = editDefaultReps.trim() === "" ? undefined : Number.parseInt(editDefaultReps, 10);

    if (parsedDefaultWeight !== undefined && (!Number.isFinite(parsedDefaultWeight) || parsedDefaultWeight < 0)) {
      showWarningToast("Invalid default weight", "Default weight must be zero or greater.");
      return;
    }
    if (parsedDefaultReps !== undefined && (!Number.isFinite(parsedDefaultReps) || parsedDefaultReps < 1)) {
      showWarningToast("Invalid default reps", "Default reps must be at least 1.");
      return;
    }

    updateMovementMutation.mutate({
      movementId,
      name: trimmedName,
      isBodyweight: editIsBodyweight,
      defaultWeight: parsedDefaultWeight,
      defaultReps: parsedDefaultReps,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Movements</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add New Movement</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                data-testid="movement-name-input"
                placeholder="Movement name (e.g. Bench Press)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
              />
              <Button data-testid="movement-create-submit" type="submit" disabled={!name.trim()} className="w-full sm:w-auto">
                {createMovementMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                data-testid="movement-default-weight-input"
                type="number"
                min={0}
                placeholder={isBodyweight ? "Auto from body weight" : "Default weight (optional)"}
                value={defaultWeight}
                onChange={(event) => setDefaultWeight(event.target.value)}
                disabled={isBodyweight}
              />
              <Input
                data-testid="movement-default-reps-input"
                type="number"
                min={1}
                placeholder="Default reps (optional)"
                value={defaultReps}
                onChange={(event) => setDefaultReps(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="movement-bodyweight-toggle">
              <input
                id="movement-bodyweight-toggle"
                data-testid="movement-bodyweight-toggle"
                type="checkbox"
                checked={isBodyweight}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setIsBodyweight(checked);
                  if (checked) {
                    setDefaultWeight("");
                  }
                }}
              />
              Body-weight movement
            </label>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>All Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-slate-500">No movements yet. Add one above!</p>
          ) : (
            <ul className="space-y-2" data-testid="movements-list">
              {movements.map((movement) => (
                <li
                  key={movement.id}
                  data-testid={`movement-item-${movement.id}`}
                  className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                  {editingMovementId === movement.id ? (
                    <div className="w-full space-y-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={editIsBodyweight}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setEditIsBodyweight(checked);
                              if (checked) {
                                setEditDefaultWeight("");
                              }
                            }}
                          />
                          Body-weight movement
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          type="number"
                          min={0}
                          placeholder={editIsBodyweight ? "Auto from body weight" : "Default weight (optional)"}
                          value={editDefaultWeight}
                          onChange={(event) => setEditDefaultWeight(event.target.value)}
                          disabled={editIsBodyweight}
                        />
                        <Input
                          type="number"
                          min={1}
                          placeholder="Default reps (optional)"
                          value={editDefaultReps}
                          onChange={(event) => setEditDefaultReps(event.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(movement.id)}
                          disabled={updateMovementMutation.isPending || !editName.trim()}>
                          {updateMovementMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex min-w-0 items-center gap-2">
                        <span>{movement.name}</span>
                        {movement.isBodyweight ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">BW</span>
                        ) : null}
                        {movement.isBodyweight && movement.defaultReps !== null ? (
                          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {movement.defaultReps} reps
                          </span>
                        ) : null}
                        {!movement.isBodyweight && (movement.defaultWeight !== null || movement.defaultReps !== null) ? (
                          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {movement.defaultWeight ?? "-"} lbs • {movement.defaultReps ?? "-"} reps
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleStartEdit(movement)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid={`movement-delete-${movement.id}`}
                          onClick={() => deleteMovementMutation.mutate(movement.id)}>
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

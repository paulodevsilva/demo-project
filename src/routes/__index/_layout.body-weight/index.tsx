import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SimpleLineChart } from "@/components/ui/simple-line-chart";
import { createBodyWeightEntryServerFn } from "@/lib/body-weight.server";
import { bodyWeightEntriesPageQueryOptions, bodyWeightEntriesQueryOptions, latestBodyWeightQueryOptions } from "./-queries/body-weight";

type BodyWeightEntry = {
  id: string;
  weight: number;
  measuredAt: Date;
};
type PaginatedBodyWeightEntries = {
  items: BodyWeightEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export const Route = createFileRoute("/__index/_layout/body-weight/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(bodyWeightEntriesQueryOptions()),
      context.queryClient.ensureQueryData(latestBodyWeightQueryOptions()),
    ]);
  },
  component: BodyWeightPage,
});

function BodyWeightPage() {
  const queryClient = useQueryClient();
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const { data: entriesData } = useSuspenseQuery(bodyWeightEntriesPageQueryOptions(page, pageSize));
  const { data: latestEntryData } = useSuspenseQuery(latestBodyWeightQueryOptions());
  const paginatedEntries = entriesData as PaginatedBodyWeightEntries;
  const entries = paginatedEntries.items;
  const pagination = paginatedEntries.pagination;
  const latestEntry = latestEntryData as BodyWeightEntry | null;
  const [weight, setWeight] = useState(latestEntry?.weight?.toString() ?? "");

  const createEntryMutation = useMutation({
    mutationFn: (value: number) => createBodyWeightEntryServerFn({ data: { weight: value } }),
    onSuccess: (result) => {
      if (!result?.success || !result.entry) {
        const errorMessage = (result as { error?: string } | undefined)?.error;
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.error("Could not save body weight entry.");
        }
        return;
      }
      const newEntry = result.entry as BodyWeightEntry;
      queryClient.invalidateQueries({ queryKey: ["body-weight-entries"] });
      queryClient.setQueryData(latestBodyWeightQueryOptions().queryKey, newEntry);
      setPage(1);
      setWeight("");
    },
    onError: () => {
      toast.error("Failed to save body weight. Please try again.");
    },
  });

  const points = useMemo(
    () =>
      [...entries]
        .reverse()
        .map((entry) => ({
          label: new Date(entry.measuredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          value: entry.weight,
        })),
    [entries],
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number.parseInt(weight, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    createEntryMutation.mutate(parsed);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Body Weight</h1>

      <Card>
        <CardHeader>
          <CardTitle>Log Today's Weight</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              data-testid="bodyweight-input"
              type="number"
              min={1}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="Weight (lbs)"
              className="w-full sm:w-48"
            />
            <Button
              data-testid="bodyweight-submit"
              type="submit"
              disabled={!weight.trim() || createEntryMutation.isPending}
              className="w-full sm:w-auto">
              {createEntryMutation.isPending ? "Saving..." : "Save weight"}
            </Button>
            {latestEntry && (
              <p className="text-sm text-slate-500">
                Latest entry: <span className="font-medium text-slate-700">{latestEntry.weight} lbs</span>
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weight Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleLineChart points={points} yLabel="Body weight in lbs" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">No entries yet.</p>
          ) : (
            <div className="max-h-[min(52vh,560px)] overflow-y-auto pr-1 scroll-smooth">
              <ul className="space-y-2">
                {entries.map((entry) => (
                  <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {new Date(entry.measuredAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="font-medium">{entry.weight} lbs</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <p data-testid="body-weight-page-label" className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} entries
            </p>
            <div className="flex gap-2">
              <Button
                data-testid="body-weight-prev-page"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={!pagination.hasPreviousPage}>
                Previous
              </Button>
              <Button
                data-testid="body-weight-next-page"
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

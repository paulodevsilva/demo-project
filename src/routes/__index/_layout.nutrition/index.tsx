import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createNutritionEntryServerFn } from "@/lib/nutrition.server";
import {
  nutritionEntriesPageQueryOptions,
  nutritionEntriesQueryOptions,
  todayNutritionSummaryQueryOptions,
} from "./-queries/nutrition";

type NutritionEntry = {
  id: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  measuredAt: Date;
};

type PaginatedNutritionEntries = {
  items: NutritionEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type TodayNutritionSummary = {
  entryCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const Route = createFileRoute("/__index/_layout/nutrition/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(nutritionEntriesQueryOptions()),
      context.queryClient.ensureQueryData(todayNutritionSummaryQueryOptions()),
    ]);
  },
  component: NutritionPage,
});

function NutritionPage() {
  const queryClient = useQueryClient();
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const { data: entriesData } = useSuspenseQuery(nutritionEntriesPageQueryOptions(page, pageSize));
  const { data: summaryData } = useSuspenseQuery(todayNutritionSummaryQueryOptions());
  const paginatedEntries = entriesData as PaginatedNutritionEntries;
  const entries = paginatedEntries.items;
  const pagination = paginatedEntries.pagination;
  const todaySummary = summaryData as TodayNutritionSummary;

  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const createEntryMutation = useMutation({
    mutationFn: (data: { calories: number; protein: number; carbs: number; fat: number }) => createNutritionEntryServerFn({ data }),
    onSuccess: (result) => {
      if (!result?.success) {
        toast.error("Could not save nutrition entry.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["nutrition-entries"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition-today-summary"] });
      setPage(1);
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
    },
    onError: () => {
      toast.error("Failed to save nutrition entry.");
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedCalories = Number.parseInt(calories, 10);
    const parsedProtein = Number.parseInt(protein, 10);
    const parsedCarbs = Number.parseInt(carbs, 10);
    const parsedFat = Number.parseInt(fat, 10);

    if (!Number.isFinite(parsedCalories) || parsedCalories < 0) return;
    if (!Number.isFinite(parsedProtein) || parsedProtein < 0) return;
    if (!Number.isFinite(parsedCarbs) || parsedCarbs < 0) return;
    if (!Number.isFinite(parsedFat) || parsedFat < 0) return;

    createEntryMutation.mutate({
      calories: parsedCalories,
      protein: parsedProtein,
      carbs: parsedCarbs,
      fat: parsedFat,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Nutrition</h1>

      <Card>
        <CardHeader>
          <CardTitle>Log Today's Intake</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              data-testid="nutrition-calories-input"
              type="number"
              min={0}
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              placeholder="Calories"
            />
            <Input
              data-testid="nutrition-protein-input"
              type="number"
              min={0}
              value={protein}
              onChange={(event) => setProtein(event.target.value)}
              placeholder="Protein (g)"
            />
            <Input
              data-testid="nutrition-carbs-input"
              type="number"
              min={0}
              value={carbs}
              onChange={(event) => setCarbs(event.target.value)}
              placeholder="Carbs (g)"
            />
            <Input
              data-testid="nutrition-fat-input"
              type="number"
              min={0}
              value={fat}
              onChange={(event) => setFat(event.target.value)}
              placeholder="Fat (g)"
            />
            <Button
              data-testid="nutrition-submit"
              type="submit"
              disabled={!calories || !protein || !carbs || !fat || createEntryMutation.isPending}
              className="w-full">
              {createEntryMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <SummaryItem label="Entries" value={String(todaySummary.entryCount)} />
            <SummaryItem label="Calories" value={`${todaySummary.calories} kcal`} />
            <SummaryItem label="Protein" value={`${todaySummary.protein} g`} />
            <SummaryItem label="Carbs" value={`${todaySummary.carbs} g`} />
            <SummaryItem label="Fat" value={`${todaySummary.fat} g`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">No nutrition entries yet.</p>
          ) : (
            <div className="max-h-[min(52vh,560px)] overflow-y-auto pr-1 scroll-smooth">
              <ul className="space-y-2">
                {entries.map((entry) => (
                  <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <div className="font-medium text-slate-800">
                      {new Date(entry.measuredAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <p className="text-slate-600">
                      {entry.calories} kcal · P {entry.protein} g · C {entry.carbs} g · F {entry.fat} g
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} entries
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={!pagination.hasPreviousPage}>
                Previous
              </Button>
              <Button
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

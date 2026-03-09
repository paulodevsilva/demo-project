import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SimpleLineChart } from "@/components/ui/simple-line-chart";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/components/ui/app-toast";
import { createNutritionEntryServerFn } from "@/lib/nutrition.server";
import {
  nutritionChartEntriesQueryOptions,
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

const progressRangeOptions = {
  "7d": { label: "1 week", days: 7 },
  "14d": { label: "2 weeks", days: 14 },
  "30d": { label: "1 month", days: 30 },
} as const;

type ProgressRange = keyof typeof progressRangeOptions;

export const Route = createFileRoute("/__index/_layout/nutrition/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(nutritionEntriesQueryOptions()),
      context.queryClient.ensureQueryData(nutritionChartEntriesQueryOptions()),
      context.queryClient.ensureQueryData(todayNutritionSummaryQueryOptions()),
    ]);
  },
  component: NutritionPage,
});

function NutritionPage() {
  const queryClient = useQueryClient();
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const [progressRange, setProgressRange] = useState<ProgressRange>("7d");
  const { data: entriesData } = useSuspenseQuery(nutritionEntriesPageQueryOptions(page, pageSize));
  const { data: chartEntriesData } = useSuspenseQuery(nutritionChartEntriesQueryOptions());
  const { data: summaryData } = useSuspenseQuery(todayNutritionSummaryQueryOptions());
  const paginatedEntries = entriesData as PaginatedNutritionEntries;
  const chartEntries = (chartEntriesData as PaginatedNutritionEntries).items;
  const entries = paginatedEntries.items;
  const pagination = paginatedEntries.pagination;
  const todaySummary = summaryData as TodayNutritionSummary;
  const progressRangeConfig = progressRangeOptions[progressRange];
  const nutritionProgressByDay = useMemo(() => {
    const byDay = new Map<string, { date: Date; calories: number }>();

    for (const entry of chartEntries) {
      const measuredAt = new Date(entry.measuredAt);
      const dayKey = `${measuredAt.getFullYear()}-${measuredAt.getMonth()}-${measuredAt.getDate()}`;
      const dayBucket = byDay.get(dayKey);

      if (dayBucket) {
        dayBucket.calories += entry.calories;
        continue;
      }

      byDay.set(dayKey, {
        date: measuredAt,
        calories: entry.calories,
      });
    }

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (progressRangeConfig.days - 1));

    return Array.from(byDay.values())
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .filter((item) => item.date >= cutoff)
      .slice(-progressRangeConfig.days);
  }, [chartEntries, progressRangeConfig.days]);

  const caloriesProgressPoints = useMemo(
    () =>
      nutritionProgressByDay.map((item) => ({
        label: item.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: item.calories,
      })),
    [nutritionProgressByDay],
  );

  const nutritionPeriodSummary = useMemo(() => {
    if (nutritionProgressByDay.length === 0) {
      return {
        totalCalories: 0,
        averageDailyCalories: 0,
        trackedDays: 0,
        trendDelta: 0,
      };
    }

    const totalCalories = nutritionProgressByDay.reduce((total, item) => total + item.calories, 0);
    const firstDayCalories = nutritionProgressByDay[0]?.calories ?? 0;
    const lastDayCalories = nutritionProgressByDay[nutritionProgressByDay.length - 1]?.calories ?? 0;

    return {
      totalCalories,
      averageDailyCalories: Math.round(totalCalories / nutritionProgressByDay.length),
      trackedDays: nutritionProgressByDay.length,
      trendDelta: lastDayCalories - firstDayCalories,
    };
  }, [nutritionProgressByDay]);

  const trendLabel =
    nutritionPeriodSummary.trendDelta > 0
      ? `+${nutritionPeriodSummary.trendDelta} kcal`
      : `${nutritionPeriodSummary.trendDelta} kcal`;

  const trendDirection =
    nutritionPeriodSummary.trendDelta === 0
      ? "No change"
      : nutritionPeriodSummary.trendDelta > 0
        ? "Increasing"
        : "Decreasing";

  const trendToneClass =
    nutritionPeriodSummary.trendDelta === 0
      ? "text-slate-700"
      : nutritionPeriodSummary.trendDelta > 0
        ? "text-amber-700"
        : "text-emerald-700";

  const trackedDaysLabel = `${nutritionPeriodSummary.trackedDays}/${progressRangeConfig.days}`;

  const averageTarget = 2200;
  const averageTargetProgress = Math.min(
    100,
    Math.round((nutritionPeriodSummary.averageDailyCalories / Math.max(averageTarget, 1)) * 100),
  );

  const averageTargetLabel =
    nutritionPeriodSummary.averageDailyCalories > 0
      ? `${nutritionPeriodSummary.averageDailyCalories} kcal / ${averageTarget} kcal target`
      : `No tracked calories`;

  const averageTargetToneClass =
    nutritionPeriodSummary.averageDailyCalories > averageTarget
      ? "bg-amber-500"
      : nutritionPeriodSummary.averageDailyCalories > 0
        ? "bg-emerald-500"
        : "bg-slate-300";

  const dailyCaloriesLabel = `Daily calories (${progressRangeConfig.label})`;

  const chartHasData = caloriesProgressPoints.length > 0;

  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const createEntryMutation = useMutation({
    mutationFn: (data: { calories: number; protein: number; carbs: number; fat: number }) => createNutritionEntryServerFn({ data }),
    onSuccess: (result) => {
      if (!result?.success) {
        showErrorToast("Could not save nutrition entry", "Please check values and try again.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["nutrition-entries"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition-today-summary"] });
      setPage(1);
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      showSuccessToast("Nutrition saved", `${result.entry.calories} kcal entry added.`);
    },
    onError: () => {
      showErrorToast("Could not save nutrition entry", "Failed to save nutrition entry.");
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedCalories = Number.parseInt(calories, 10);
    const parsedProtein = Number.parseInt(protein, 10);
    const parsedCarbs = Number.parseInt(carbs, 10);
    const parsedFat = Number.parseInt(fat, 10);

    if (!Number.isFinite(parsedCalories) || parsedCalories < 0) {
      showWarningToast("Invalid calories", "Calories must be zero or greater.");
      return;
    }
    if (!Number.isFinite(parsedProtein) || parsedProtein < 0) {
      showWarningToast("Invalid protein", "Protein must be zero or greater.");
      return;
    }
    if (!Number.isFinite(parsedCarbs) || parsedCarbs < 0) {
      showWarningToast("Invalid carbs", "Carbs must be zero or greater.");
      return;
    }
    if (!Number.isFinite(parsedFat) || parsedFat < 0) {
      showWarningToast("Invalid fat", "Fat must be zero or greater.");
      return;
    }

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
          <form noValidate onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      <Card data-testid="nutrition-progress-card">
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

      <Card data-testid="nutrition-today-summary-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Calories Progress</CardTitle>
          <div className="w-full sm:w-52">
            <Select
              data-testid="nutrition-progress-range-select"
              value={progressRange}
              onChange={(event) => setProgressRange(event.target.value as ProgressRange)}
              aria-label="Select nutrition progress range">
              {Object.entries(progressRangeOptions).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryItem label="Tracked days" value={trackedDaysLabel} />
            <SummaryItem label="Total calories" value={`${nutritionPeriodSummary.totalCalories} kcal`} />
            <SummaryItem label="Daily average" value={`${nutritionPeriodSummary.averageDailyCalories} kcal`} />
            <SummaryItem label={`${trendDirection} trend`} value={trendLabel} valueClassName={trendToneClass} />
          </div>
          <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
              <span>{averageTargetLabel}</span>
              <span>{averageTargetProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full ${averageTargetToneClass}`} style={{ width: `${averageTargetProgress}%` }} />
            </div>
          </div>
          <SimpleLineChart points={caloriesProgressPoints} yLabel={dailyCaloriesLabel} />
          {!chartHasData ? (
            <p className="mt-3 text-xs text-slate-500">Add entries during this period to see your calorie progression.</p>
          ) : null}
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
              <ul className="space-y-2" data-testid="nutrition-history-list">
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
            <p className="text-sm text-slate-500" data-testid="nutrition-page-label">
              Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} entries
            </p>
            <div className="flex gap-2">
              <Button
                data-testid="nutrition-prev-page"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={!pagination.hasPreviousPage}>
                Previous
              </Button>
              <Button
                data-testid="nutrition-next-page"
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

function SummaryItem({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold text-slate-800 ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}

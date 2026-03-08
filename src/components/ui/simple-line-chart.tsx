import { cn } from "@/lib/utils";

export type ChartPoint = {
  label: string;
  value: number;
};

type SimpleLineChartProps = {
  points: ChartPoint[];
  className?: string;
  yLabel?: string;
};

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = 28;

export function SimpleLineChart({ points, className, yLabel }: SimpleLineChartProps) {
  if (points.length === 0) {
    return (
      <div className={cn("h-64 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6", className)}>
        <p className="text-sm text-slate-500">Not enough data to render chart.</p>
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const coords = points.map((point, index) => {
    const x = PADDING + (index * (WIDTH - PADDING * 2)) / Math.max(points.length - 1, 1);
    const y = HEIGHT - PADDING - ((point.value - min) / range) * (HEIGHT - PADDING * 2);
    return { ...point, x, y };
  });

  const pathData = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="h-56 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 sm:h-64 sm:p-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-full w-full overflow-hidden"
          role="img"
          aria-label={yLabel ?? "progress chart"}>
          <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} stroke="#cbd5e1" />
          <line x1={PADDING} y1={PADDING} x2={PADDING} y2={HEIGHT - PADDING} stroke="#cbd5e1" />
          <path d={pathData} fill="none" stroke="#0f766e" strokeWidth={2.5} strokeLinecap="round" />
          {coords.map((point) => (
            <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r={4} fill="#0f766e" />
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
        {coords.slice(-8).map((point) => (
          <div key={`${point.label}-${point.value}`} className="rounded bg-slate-50 px-2 py-1">
            <p className="truncate">{point.label}</p>
            <p className="font-semibold text-slate-800">{point.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

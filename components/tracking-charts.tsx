"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/tracking";
import { formatUsd } from "@/lib/utils";

/**
 * Small multiples — one chart per metric, each on its own honest Y scale.
 *
 * These are deliberately NOT combined into one plot: daily LLM cost (cents),
 * reads (tens) and packets created (single digits) share no scale, and a shared
 * axis would flatten two of the three into the baseline.
 */
const CHARTS = [
  {
    key: "llmCost" as const,
    title: "LLM cost / day",
    color: "var(--chart-1)",
    format: (v: number) => formatUsd(v),
    tick: (v: number) => (v ? `$${v < 1 ? v.toFixed(2) : v.toFixed(0)}` : "0"),
  },
  {
    key: "reads" as const,
    title: "Reads / day",
    color: "var(--chart-2)",
    format: (v: number) => `${v} read${v === 1 ? "" : "s"}`,
    tick: (v: number) => String(v),
  },
  {
    key: "packetsCreated" as const,
    title: "Packets created / day",
    color: "var(--chart-3)",
    format: (v: number) => `${v} packet${v === 1 ? "" : "s"}`,
    tick: (v: number) => String(v),
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-04" → "04 Sep", without locale-dependent formatting. */
function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1] ?? ""}`;
}

export function TrackingCharts({ daily }: { daily: DailyPoint[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CHARTS.map((c) => {
        const total = daily.reduce((n, d) => n + d[c.key], 0);
        return (
          <div key={c.key} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">{c.title}</h3>
              <span className="text-xs font-semibold tabular-nums">{c.format(total)}</span>
            </div>
            <div className="h-32">
              {daily.length === 0 ? (
                <p className="flex h-full items-center text-xs text-muted-foreground">
                  No data in this range
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                    <CartesianGrid
                      vertical={false}
                      stroke="hsl(var(--border))"
                      strokeDasharray="2 3"
                    />
                    <XAxis
                      dataKey="day"
                      tickFormatter={shortDay}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickFormatter={c.tick}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "hsl(var(--card-foreground))",
                      }}
                      labelFormatter={(v) => shortDay(String(v))}
                      formatter={(v) => [c.format(Number(v)), c.title]}
                    />
                    {/* Linear, not smoothed: these are discrete daily totals,
                        and a curve would imply measurements between days that
                        were never taken (2.4 packets created, say). Dots mark
                        the real readings while the series is short enough. */}
                    <Line
                      type="linear"
                      dataKey={c.key}
                      stroke={c.color}
                      strokeWidth={2}
                      dot={daily.length <= 14 ? { r: 2.5, strokeWidth: 0, fill: c.color } : false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

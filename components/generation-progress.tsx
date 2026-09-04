"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";

interface JobState {
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  step: string;
  progress: number;
  stepLabel: string;
  error?: string | null;
  costUsd?: number;
  stats?: Record<string, number> | null;
  log?: string;
}

export function GenerationProgress({
  packetId,
  initialActive,
}: {
  packetId: string;
  initialActive: boolean;
}) {
  const router = useRouter();
  const [job, setJob] = useState<JobState | null>(null);
  const [running, setRunning] = useState(initialActive);
  const [showLog, setShowLog] = useState(false);
  const cancelled = useRef(false);

  const drive = useCallback(async () => {
    cancelled.current = false;
    setRunning(true);
    // Pull current state first.
    try {
      const s = await fetch(`/api/packets/${packetId}/job`).then((r) => r.json());
      if (s.job) setJob(s.job);
    } catch {
      /* ignore */
    }

    // Advance one step at a time.
    // eslint-disable-next-line no-constant-condition
    while (!cancelled.current) {
      let res: Response;
      try {
        // eslint-disable-next-line no-await-in-loop
        res = await fetch(`/api/packets/${packetId}/generate?retry=1`, { method: "POST" });
      } catch {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const data = await res.json();
      if (res.status === 404) {
        setRunning(false);
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      const s = await fetch(`/api/packets/${packetId}/job`).then((r) => r.json());
      if (s.job) setJob(s.job);

      if (data.done || data.status === "SUCCEEDED") {
        setRunning(false);
        // Full reload: the editor holds rounds/questions in local state, so a
        // soft router.refresh() wouldn't repopulate it. Also drops ?job= so a
        // later manual refresh doesn't restart polling.
        window.location.href = window.location.pathname;
        return;
      }
      if (data.status === "FAILED") {
        setRunning(false);
        router.refresh();
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 400));
    }
  }, [packetId, router]);

  useEffect(() => {
    if (initialActive) {
      drive();
    } else {
      // Not driving, but still fetch once so a FAILED / finished job renders
      // (its error + Retry button) instead of the component showing nothing.
      fetch(`/api/packets/${packetId}/job`)
        .then((r) => r.json())
        .then((s) => {
          if (s.job) setJob(s.job);
        })
        .catch(() => {});
    }
    return () => {
      cancelled.current = true;
    };
  }, [initialActive, drive, packetId]);

  if (!running && (!job || job.status === "SUCCEEDED")) {
    if (!job) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        Last generation finished · {formatUsd(job.costUsd ?? 0)} ·{" "}
        {statLine(job.stats)}
      </div>
    );
  }

  const failed = job?.status === "FAILED";

  return (
    <div
      className={`rounded-lg border p-4 ${
        failed ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {failed ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        {failed ? "Generation failed" : job?.stepLabel || "Starting…"}
        <span className="ml-auto text-xs text-muted-foreground">{formatUsd(job?.costUsd ?? 0)}</span>
      </div>

      {!failed && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-accent">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.max(5, job?.progress ?? 5)}%` }}
          />
        </div>
      )}

      {failed && job?.error && (
        <p className="mt-2 text-xs text-destructive">{job.error}</p>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{statLine(job?.stats)}</span>
        <button className="underline" onClick={() => setShowLog((v) => !v)}>
          {showLog ? "Hide log" : "Show log"}
        </button>
        {failed && !running && (
          <Button size="sm" variant="outline" onClick={drive}>
            <RotateCcw className="h-3.5 w-3.5" />
            Retry from failed step
          </Button>
        )}
      </div>

      {showLog && job?.log && (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed text-muted-foreground">
          {job.log}
        </pre>
      )}
    </div>
  );
}

function statLine(stats?: Record<string, number> | null): string {
  if (!stats) return "";
  const parts: string[] = [];
  if (stats.sheetFound != null) parts.push(`${stats.sheetFound} from sheet`);
  if (stats.webFound) parts.push(`${stats.webFound} from web`);
  if (stats.added != null) parts.push(`${stats.added} added`);
  if (stats.spillover) parts.push(`${stats.spillover} spillover`);
  return parts.join(" · ");
}

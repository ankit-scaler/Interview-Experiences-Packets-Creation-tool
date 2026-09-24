"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { AdminAction } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTION_LABEL } from "@/lib/labels";
import { cn, formatDateTime } from "@/lib/utils";

export interface ActivityEntry {
  id: string;
  actorEmail: string;
  action: AdminAction;
  packetLabel: string;
  packetSlug: string | null;
  detail: string | null;
  createdAt: string;
}

/** Colour families by what the action does, so the list scans at a glance. */
const TONE: Record<AdminAction, string> = {
  PACKET_CREATED: "bg-success/10 text-success",
  PACKET_PUBLISHED: "bg-success/10 text-success",
  GENERATION_STARTED: "bg-accent/10 text-accent",
  REGENERATION_STARTED: "bg-accent/10 text-accent",
  PACKET_EDITED: "bg-warning/10 text-warning",
  ROUND_ADDED: "bg-warning/10 text-warning",
  ROUND_EDITED: "bg-warning/10 text-warning",
  QUESTION_ADDED: "bg-warning/10 text-warning",
  QUESTION_EDITED: "bg-warning/10 text-warning",
  PACKET_UNPUBLISHED: "bg-destructive/10 text-destructive",
  PACKET_DELETED: "bg-destructive/10 text-destructive",
  ROUND_DELETED: "bg-destructive/10 text-destructive",
  QUESTION_DELETED: "bg-destructive/10 text-destructive",
};

export function ActivityLog({
  entries,
  appUrl,
  limit,
  from: initialFrom,
  to: initialTo,
}: {
  entries: ActivityEntry[];
  appUrl: string;
  limit: number;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [q, setQ] = useState("");
  const [action, setAction] = useState<AdminAction | "">("");
  const [pending, startTransition] = useTransition();

  // Actions actually present, so the filter never offers an empty result.
  const actions = useMemo(
    () => [...new Set(entries.map((e) => e.action))].sort((a, b) => ACTION_LABEL[a].localeCompare(ACTION_LABEL[b])),
    [entries],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (action && e.action !== action) return false;
      if (!needle) return true;
      return (
        e.actorEmail.toLowerCase().includes(needle) ||
        e.packetLabel.toLowerCase().includes(needle) ||
        (e.detail ?? "").toLowerCase().includes(needle)
      );
    });
  }, [entries, q, action]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Admin activity</h1>
          <p className="text-xs text-muted-foreground">
            Who created, edited, generated or published what.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9" />
          </label>
          <label className="text-xs">
            To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9" />
          </label>
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              startTransition(() => {
                router.push(`/activity?from=${from}&to=${to}`);
                router.refresh();
              })
            }
          >
            Apply
          </Button>
        </div>
      </div>

      <div
        aria-busy={pending}
        className={cn(
          "rounded-lg border border-border bg-card p-4 transition-opacity",
          pending && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by person, packet or detail"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterChip active={action === ""} onClick={() => setAction("")}>
              All
            </FilterChip>
            {actions.map((a) => (
              <FilterChip key={a} active={action === a} onClick={() => setAction(a)}>
                {ACTION_LABEL[a]}
              </FilterChip>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          {filtered.length} of {entries.length} entries
          {entries.length === limit && ` · showing the most recent ${limit} in this range`}
        </p>

        <div className="mt-2 max-h-[36rem] overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Packet</th>
                <th className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDateTime(e.createdAt)}</td>
                  <td className="px-3 py-2 text-xs">{e.actorEmail}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
                        TONE[e.action],
                      )}
                    >
                      {ACTION_LABEL[e.action]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {e.packetSlug ? (
                      <a
                        href={`${appUrl.replace(/\/$/, "")}/p/${e.packetSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {e.packetLabel}
                      </a>
                    ) : (
                      e.packetLabel
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.detail || "—"}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-sm text-muted-foreground">
                    {entries.length
                      ? "No entries match this filter."
                      : "No admin activity recorded in this date range."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-foreground/20 bg-subtle text-foreground"
          : "border-border text-muted-foreground hover:bg-subtle/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

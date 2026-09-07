"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { PacketListItem } from "@/lib/packets";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyLinkButton } from "@/components/copy-link-button";
import { TRACK_LABEL, YOE_LABEL } from "@/lib/labels";
import { formatUsd, formatDate } from "@/lib/utils";

const FILTERS = ["All", "Draft", "Published"] as const;

export function PacketList({ packets, appUrl }: { packets: PacketListItem[]; appUrl: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return packets.filter((p) => {
      if (filter === "Draft" && p.status !== "DRAFT") return false;
      if (filter === "Published" && p.status !== "PUBLISHED") return false;
      if (!needle) return true;
      return (
        p.company.toLowerCase().includes(needle) ||
        p.role.toLowerCase().includes(needle) ||
        TRACK_LABEL[p.track].toLowerCase().includes(needle)
      );
    });
  }, [packets, q, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, role or track…"
            className="pl-8"
          />
        </div>
        <div className="flex rounded-md border border-border p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                filter === f ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No packets{q || filter !== "All" ? " match your filters" : " yet"}.{" "}
          <Link href="/create" className="text-primary underline">
            Create one
          </Link>
          .
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 bg-card p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/packets/${p.id}`} className="font-medium hover:underline">
                    {p.company} — {p.role}
                  </Link>
                  {p.status === "PUBLISHED" ? (
                    <Badge variant="success">Published</Badge>
                  ) : (
                    <Badge variant="warning">Draft</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {TRACK_LABEL[p.track]} · {YOE_LABEL[p.yoeBucket]}
                  {p.stack ? ` · ${p.stack}` : ""} · {p.roundCount} rounds · {p.questionCount}{" "}
                  questions · {p.readCount} readers · {formatUsd(p.costUsd)} ·{" "}
                  {formatDate(p.lastGeneratedAt ?? p.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CopyLinkButton
                  url={`${appUrl.replace(/\/$/, "")}/p/${p.slug}`}
                  disabled={p.status !== "PUBLISHED"}
                />
                <Link
                  href={`/packets/${p.id}`}
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

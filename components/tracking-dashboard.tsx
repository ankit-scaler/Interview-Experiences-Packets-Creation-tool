"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Search, Star, Loader2 } from "lucide-react";
import type { TrackingSummary } from "@/lib/tracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MATCHED_LABEL } from "@/lib/labels";
import { formatUsd, formatDate, formatDateTime, formatDuration } from "@/lib/utils";

export function TrackingDashboard({
  data,
  appUrl,
  companies,
  roles,
}: {
  data: TrackingSummary;
  appUrl: string;
  companies: string[];
  roles: string[];
}) {
  const router = useRouter();
  const [from, setFrom] = useState(data.from);
  const [to, setTo] = useState(data.to);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const qs = `from=${from}&to=${to}`;
  const dl = (report: string) => `/api/tracking/export?report=${report}&${qs}`;

  function applyRange() {
    router.push(`/tracking?${qs}`);
    router.refresh(); // searchParam-only nav can serve a stale RSC payload otherwise
  }

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/tracking/sync", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Sync failed");
      const okCount = (d.results ?? []).filter((r: { ok: boolean }) => r.ok).length;
      setSyncMsg(`Synced ${okCount}/${(d.results ?? []).length} tabs to Google Sheets.`);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Tracking</h1>
          <p className="text-xs text-muted-foreground">
            Sheets last synced {formatDateTime(data.lastReadsSyncAt)}
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
          <Button size="sm" onClick={applyRange}>
            Apply
          </Button>
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync to Sheets
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/tracking/export?${qs}`} download>
              <Download className="h-4 w-4" />
              Everything
            </a>
          </Button>
        </div>
      </div>
      {syncMsg && <p className="text-xs text-muted-foreground">{syncMsg}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Packets created / updated"
          value={data.packetsCreated}
          sub={`${data.packetsNew} new · ${data.packetsAppended} appended`}
          href={dl("packets-created")}
        />
        <StatCard
          label="Reads"
          value={data.totalReads}
          sub={`${data.uniqueLearners} unique learners`}
          href={dl("reads")}
        />
        <StatCard
          label="Read log (learner × packet)"
          value={data.readLogCount}
          sub="who read what"
          href={dl("read-log")}
        />
        <StatCard
          label="Published packets, no reads"
          value={data.packetsWithNoReads}
          sub="in this date range"
          href={dl("no-reads")}
        />
        <StatCard label="LLM cost" value={formatUsd(data.llmCost)} sub="in this date range" href={dl("llm-cost")} />
        <StatCard
          label="Avg time / learner · packet"
          value={formatDuration(data.avgSecondsPerLearnerPacket)}
          sub="active reading time"
          href={dl("time-spent")}
        />
        <StatCard
          label="Repeat reads"
          value={data.repeatReadPairs}
          sub="same packet 2+ days / month"
          href={dl("repeat-reads")}
        />
        <StatCard label="Vault clicks" value={data.vaultClicks} sub="Explore vault CTA" href={dl("vault-clicks")} />
        <StatCard label="Feedback" value={data.feedbackCount} sub="submissions" href={dl("feedback")} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Top packets by reads" href={dl("reads")}>
          <table className="w-full text-sm">
            <tbody>
              {data.topPackets.map((p) => (
                <tr key={p.slug} className="border-b border-border last:border-0">
                  <td className="py-2">
                    <a
                      href={`${appUrl.replace(/\/$/, "")}/p/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {p.company} — {p.role}
                    </a>
                  </td>
                  <td className="py-2 text-right font-medium">{p.reads}</td>
                </tr>
              ))}
              {!data.topPackets.length && (
                <tr>
                  <td className="py-3 text-sm text-muted-foreground">No reads in this range</td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <Panel title="Recent feedback" href={dl("feedback")}>
          <ul className="space-y-2 text-sm">
            {data.recentFeedback.map((f, i) => (
              <li key={i} className="border-b border-border pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <Stars n={f.stars} />
                  <span className="text-xs text-muted-foreground">
                    {f.company} — {f.role} · {MATCHED_LABEL[f.matched as "YES" | "PARTLY" | "NO"]}
                  </span>
                </div>
                {f.comment && <p className="mt-0.5 text-xs">{f.comment}</p>}
              </li>
            ))}
            {!data.recentFeedback.length && (
              <li className="text-sm text-muted-foreground">No feedback in this range</li>
            )}
          </ul>
        </Panel>
      </div>

      <Panel title={`Read log — learner × packet (${data.readLog.length})`} href={dl("read-log")}>
        <div className="max-h-[28rem] overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Learner</th>
                <th className="px-3 py-2 font-medium">Packet</th>
                <th className="px-3 py-2 font-medium">First read</th>
                <th className="px-3 py-2 font-medium">Last read</th>
                <th className="px-3 py-2 font-medium">Days</th>
                <th className="px-3 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.readLog.map((r, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">
                    <a href={r.link} target="_blank" rel="noreferrer" className="hover:underline">
                      {r.company} — {r.role}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.firstRead}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.lastRead}</td>
                  <td className="px-3 py-2">{r.days}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.timeSpent}</td>
                </tr>
              ))}
              {!data.readLog.length && (
                <tr>
                  <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={6}>
                    No reads in this date range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <PacketDirectory companies={companies} roles={roles} />

      <LearnerLookup />
    </div>
  );
}

function PacketDirectory({ companies, roles }: { companies: string[]; roles: string[] }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ headers: string[]; rows: (string | number)[][] } | null>(null);

  function query() {
    const p = new URLSearchParams();
    if (company.trim()) p.set("company", company.trim());
    if (role.trim()) p.set("role", role.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tracking/roster?${query()}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const at = (row: (string | number)[], header: string) => {
    const i = data?.headers.indexOf(header) ?? -1;
    return i >= 0 ? String(row[i] ?? "") : "";
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Packet directory</h3>
          <p className="text-[11px] text-muted-foreground">
            Packets by company / role and last-created-or-edited date, with unique
            non-Scaler readers.
          </p>
        </div>
        {data && (
          <a
            href={`/api/tracking/export?report=packet-roster&${query()}`}
            download
            className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </a>
        )}
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label className="text-xs">
          Company
          <Input
            list="pd-companies"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="any"
            className="mt-1 h-9 w-40"
          />
          <datalist id="pd-companies">
            {companies.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="text-xs">
          Role
          <Input
            list="pd-roles"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="any"
            className="mt-1 h-9 w-40"
          />
          <datalist id="pd-roles">
            {roles.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="text-xs">
          Edited from
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9" />
        </label>
        <label className="text-xs">
          Edited to
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9" />
        </label>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
        </Button>
      </form>

      {data && (
        <div className="mt-3 max-h-[28rem] overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Last edited</th>
                <th className="px-3 py-2 font-medium">Unique reads</th>
                <th className="px-3 py-2 font-medium">Reader emails</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <a
                      href={at(r, "Packet link")}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {at(r, "Company")}
                    </a>
                  </td>
                  <td className="px-3 py-2">{at(r, "Role")}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {at(r, "Last created / edited")}
                  </td>
                  <td className="px-3 py-2">{at(r, "Unique reads")}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {at(r, "Reader emails") || "—"}
                  </td>
                </tr>
              ))}
              {!data.rows.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-sm text-muted-foreground">
                    No packets match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LearnerLookup() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    internal?: boolean;
    reads: { company: string; role: string; slug: string; firstReadAt: string; lastReadAt: string; readDays: number }[];
    feedback: { company: string; role: string; stars: number; matched: "YES" | "PARTLY" | "NO"; comment: string | null }[];
  } | null>(null);

  async function lookup() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tracking/learner?email=${encodeURIComponent(email.trim())}`);
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">Learner lookup</h3>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="learner@example.com"
            className="pl-8"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
        </Button>
      </form>
      {result && (
        <div className="mt-4 space-y-3">
          {result.internal && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              This is a Scaler staff account — its activity is excluded from all
              tracking metrics.
            </p>
          )}
          <p className="text-xs font-medium text-muted-foreground">
            Packets read ({result.reads.length})
          </p>
          <ul className="divide-y divide-border text-sm">
            {result.reads.map((r) => (
              <li key={r.slug} className="flex items-center justify-between py-2">
                <span>
                  {r.company} — {r.role}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.readDays} day{r.readDays === 1 ? "" : "s"} · {formatDate(r.firstReadAt)} →{" "}
                  {formatDate(r.lastReadAt)}
                </span>
              </li>
            ))}
            {!result.reads.length && <li className="py-2 text-sm text-muted-foreground">No reads.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <a
          href={href}
          download
          title="Download CSV for this date range"
          className="text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Panel({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {href && (
          <a href={href} download className="text-muted-foreground hover:text-foreground">
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
        />
      ))}
    </span>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Upload, CornerDownRight, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WEB_SOURCES,
  ALL_SOURCE_IDS,
  DEFAULT_SOURCE_IDS,
  PRACTICE_SOURCE_IDS,
} from "@/lib/web-sources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/combobox";
import { normalizeCompany, normalizeRole } from "@/lib/normalize";

interface Suggest {
  companies: { company: string; companyNorm: string; roles: string[] }[];
  existing: {
    company: string;
    role: string;
    companyNorm: string;
    roleNorm: string;
    yoeBucket: string;
    slug: string;
  }[];
}

export function CreateForm({ llmReady, sheetsReady }: { llmReady: boolean; sheetsReady: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    track: "",
    company: "",
    role: "",
    yoeBucket: "B2_5",
    stack: "",
    location: "India",
    sourceMode: llmReady ? "SHEET_PLUS_WEB" : "SHEET_ONLY",
  });
  const [jdText, setJdText] = useState("");
  const [jdFileName, setJdFileName] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<Suggest>({ companies: [], existing: [] });
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCE_IDS);
  const practiceOn = sources.some((s) => PRACTICE_SOURCE_IDS.includes(s));

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Load company/role suggestions once a track is chosen.
  useEffect(() => {
    if (!form.track) {
      setSuggest({ companies: [], existing: [] });
      setLoadingSuggest(false);
      return;
    }
    let cancelled = false;
    setLoadingSuggest(true);
    fetch(`/api/suggest?track=${form.track}`)
      .then((r) => (r.ok ? r.json() : { companies: [], existing: [] }))
      .then((d) => {
        if (!cancelled) setSuggest(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingSuggest(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.track]);

  const companyOptions = useMemo(
    () => suggest.companies.map((c) => c.company),
    [suggest],
  );
  const matchedCompany = useMemo(() => {
    const ck = normalizeCompany(form.company);
    return suggest.companies.find((c) => c.companyNorm === ck) ?? null;
  }, [suggest, form.company]);
  const roleOptions = useMemo(() => {
    if (matchedCompany?.roles.length) return matchedCompany.roles;
    return [...new Set(suggest.companies.flatMap((c) => c.roles))].sort();
  }, [suggest, matchedCompany]);

  const existingMatch = useMemo(() => {
    const ck = normalizeCompany(form.company);
    const rk = normalizeRole(form.role);
    if (!ck || !rk) return null;
    return (
      suggest.existing.find(
        (e) => e.companyNorm === ck && e.roleNorm === rk && e.yoeBucket === form.yoeBucket,
      ) ?? null
    );
  }, [suggest, form.company, form.role, form.yoeBucket]);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/jd", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setJdText(data.text);
      setJdFileName(data.fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.track) {
      setError("Pick a track to continue.");
      return;
    }
    if (form.sourceMode === "SHEET_PLUS_WEB" && sources.length === 0) {
      setError("Pick at least one web source, or switch to Sheet only.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          webSources: form.sourceMode === "SHEET_PLUS_WEB" ? sources : [],
          stack: form.stack || undefined,
          jdText: jdText || undefined,
          jdFileName: jdFileName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create packet");
      router.push(`/packets/${data.packetId}?job=${data.jobId}${data.created ? "" : "&append=1"}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {!sheetsReady && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          Google Sheets is not configured yet — packets can&apos;t pull questions until{" "}
          <code>GOOGLE_SA_*</code> is set.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="track">Track *</Label>
          <Select id="track" value={form.track} onChange={(e) => set("track", e.target.value)}>
            <option value="" disabled>
              Select a track…
            </option>
            <option value="ACADEMY">Academy</option>
            <option value="DEVOPS">DevOps</option>
            <option value="AIML">AI / ML</option>
            <option value="DSML">DS / ML</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="yoe">Years of experience *</Label>
          <Select id="yoe" value={form.yoeBucket} onChange={(e) => set("yoeBucket", e.target.value)}>
            <option value="LT2">Less than 2 years</option>
            <option value="B2_5">2 – 5 years</option>
            <option value="GT5">5+ years</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company *</Label>
          <Combobox
            id="company"
            value={form.company}
            onChange={(v) => set("company", v)}
            options={companyOptions}
            disabled={!form.track}
            loading={loadingSuggest}
            placeholder={form.track ? "e.g. Flipkart" : "Select a track first"}
            emptyHint="New company — will be added"
          />
          <p className="text-[11px] text-muted-foreground">
            {!form.track
              ? "Pick a track above to load company suggestions."
              : loadingSuggest
                ? "Loading companies from the sheet…"
                : `${companyOptions.length} companies documented in this track.`}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Role *</Label>
          <Combobox
            id="role"
            value={form.role}
            onChange={(v) => set("role", v)}
            options={roleOptions}
            disabled={!form.track}
            loading={loadingSuggest}
            placeholder={form.track ? "e.g. SDE 2 / Application Engineer 2" : "Select a track first"}
            emptyHint={
              matchedCompany
                ? `New role for ${matchedCompany.company}`
                : "New role — will be added"
            }
          />
          <p className="text-[11px] text-muted-foreground">
            {matchedCompany
              ? `${matchedCompany.roles.length} role${matchedCompany.roles.length === 1 ? "" : "s"} seen at ${matchedCompany.company}.`
              : form.track
                ? "Showing all roles in this track — pick a company to narrow."
                : " "}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stack">Tech stack / specialization</Label>
          <Input
            id="stack"
            value={form.stack}
            onChange={(e) => set("stack", e.target.value)}
            placeholder="e.g. Java + Spring Boot (optional)"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={form.location} onChange={(e) => set("location", e.target.value)} />
        </div>
      </div>

      {existingMatch && (
        <p className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <CornerDownRight className="h-4 w-4 shrink-0 text-primary" />
          <span>
            A packet already exists for{" "}
            <span className="font-medium">
              {existingMatch.company} — {existingMatch.role}
            </span>{" "}
            at this experience. New questions will be{" "}
            <span className="font-medium">appended to it</span> (no duplicate).{" "}
            <Link href={`/packets`} className="text-primary underline">
              view packets
            </Link>
          </span>
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="jd">Job description (optional)</Label>
        <Textarea
          id="jd"
          value={jdText}
          onChange={(e) => {
            setJdText(e.target.value);
            setJdFileName(null);
          }}
          rows={5}
          placeholder="Paste the JD here, or upload a file below. Techs named here that aren't covered by the questions get a Frequently Asked Question Based on JD section."
        />
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {jdFileName ? `Uploaded: ${jdFileName}` : "Upload .pdf / .docx / .txt"}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <Label>Where should questions come from?</Label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="sourceMode"
            className="mt-1"
            checked={form.sourceMode === "SHEET_ONLY"}
            onChange={() => set("sourceMode", "SHEET_ONLY")}
          />
          <span>
            <span className="font-medium">Sheet only</span> — pull from the interview-experiences
            sheet. No web calls, lowest cost.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="sourceMode"
            className="mt-1"
            disabled={!llmReady}
            checked={form.sourceMode === "SHEET_PLUS_WEB"}
            onChange={() => set("sourceMode", "SHEET_PLUS_WEB")}
          />
          <span>
            <span className="font-medium">Sheet + web</span> — also research questions from the
            sources you pick below.
            {!llmReady && " Requires OPENROUTER_API_KEY."}
          </span>
        </label>

        {form.sourceMode === "SHEET_PLUS_WEB" && (
          <div className="mt-2 rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Search these sources</p>
              <button
                type="button"
                className="text-[11px] text-primary underline"
                onClick={() =>
                  setSources(sources.length === ALL_SOURCE_IDS.length ? [] : ALL_SOURCE_IDS)
                }
              >
                {sources.length === ALL_SOURCE_IDS.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEB_SOURCES.map((s) => {
                const on = sources.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    title={s.hint}
                    onClick={() =>
                      setSources(
                        on ? sources.filter((x) => x !== s.id) : [...sources, s.id],
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Only the selected sources are searched. Each search costs ~$0.01, so fewer
              sources means a cheaper packet.
              {!practiceOn && (
                <>
                  {" "}
                  <span className="text-amber-600 dark:text-amber-400">
                    LeetCode and GeeksforGeeks are both off — practice links won&apos;t be
                    fetched automatically.
                  </span>
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} size="lg">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create packet
      </Button>
      <p className="text-xs text-muted-foreground">
        If a packet already exists for this company · role · experience, new questions are
        appended to it instead of creating a duplicate.
      </p>
    </form>
  );
}

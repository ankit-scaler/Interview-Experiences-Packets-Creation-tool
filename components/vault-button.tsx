"use client";

import { ArrowRight } from "lucide-react";

const VAULT_URL = "https://scaler-ie.vercel.app/";

function log(slug?: string) {
  fetch("/api/vault-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
    keepalive: true,
  }).catch(() => {});
  window.open(VAULT_URL, "_blank", "noopener");
}

/** Compact Interview Vault CTA — sits in the reader's rail (desktop) or under the content (phone). */
export function VaultCard({ slug }: { slug?: string }) {
  return (
    <div className="rounded-xl bg-primary p-3.5 text-primary-foreground">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-90">Interview vault</p>
      <p className="mt-0.5 text-[15px] font-bold leading-tight">500+ companies × roles</p>
      <p className="mt-0.5 text-xs opacity-90">Questions, assignments and prep material</p>
      <button
        type="button"
        onClick={() => log(slug)}
        className="group mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-md bg-background px-3 text-[13px] font-bold text-primary transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
      >
        Open vault
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-[3px]" />
      </button>
    </div>
  );
}

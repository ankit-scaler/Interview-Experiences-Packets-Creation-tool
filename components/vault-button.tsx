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

/** Interview Vault CTA card under the packet header. */
export function VaultCard({ slug }: { slug?: string }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-primary px-[18px] py-4 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-[22px] sm:py-[18px]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Interview vault</p>
        <p className="mt-0.5 text-xl font-bold leading-tight sm:text-[22px]">500+ companies × roles</p>
        <p className="mt-0.5 text-[13px] sm:text-sm">Questions, assignments and prep material</p>
      </div>
      <button
        type="button"
        onClick={() => log(slug)}
        className="group inline-flex h-[43px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-background px-[22px] text-[15px] font-bold text-primary transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground sm:w-auto"
      >
        Open vault
        <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-[3px]" />
      </button>
    </div>
  );
}

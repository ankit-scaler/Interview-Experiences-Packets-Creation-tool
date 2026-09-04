"use client";

import { ArrowRight, Sparkles } from "lucide-react";

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

/** Full-width CTA bar under the header — attention-seeking, mobile-friendly. */
export function VaultBar({ slug }: { slug?: string }) {
  return (
    <button
      type="button"
      onClick={() => log(slug)}
      className="group flex w-full items-center justify-center gap-2 border-b border-primary/20 bg-primary/[0.09] px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.14] dark:bg-primary/[0.12] dark:hover:bg-primary/20 sm:text-sm"
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span>Explore the Interview Experiences vault</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-1" />
    </button>
  );
}

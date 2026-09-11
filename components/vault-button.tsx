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
      className="group flex w-full cursor-pointer flex-col items-start gap-2.5 border-l-[3px] border-[#818CF8] bg-[linear-gradient(90deg,#1E1B4B_0%,#312E81_100%)] px-6 py-3 text-left transition-[filter] duration-150 ease-out hover:brightness-[1.08] sm:h-[52px] sm:flex-row sm:items-center sm:justify-center sm:gap-4 sm:py-0"
    >
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Sparkles className="h-4 w-4 shrink-0 animate-sparkle-pulse text-[#A5B4FC]" />
        <span className="text-[15px] font-bold text-white">500+ companies × roles</span>
        <span className="text-[13px] font-normal text-[#C7D2FE] sm:text-sm">
          · questions, assignments, prep material
        </span>
      </span>
      <span className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#6366F1] px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-150 ease-out group-hover:bg-[#818CF8] sm:w-auto">
        Open vault
        <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-[3px]" />
      </span>
    </button>
  );
}

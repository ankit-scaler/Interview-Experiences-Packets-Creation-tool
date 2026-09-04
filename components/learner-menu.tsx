"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";

export function LearnerMenu({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
      >
        <User className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card p-1 text-sm shadow-lg">
          {email && (
            <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{email}</p>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

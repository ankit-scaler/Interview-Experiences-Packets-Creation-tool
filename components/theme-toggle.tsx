"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon button by default; `label` renders the text variant ("Dark mode" / "Light mode"). */
export function ThemeToggle({ className, label }: { className?: string; label?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  if (label) {
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={cn(
          "inline-flex h-[30px] items-center rounded-md border border-border bg-card px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-subtle",
          className,
        )}
      >
        {/* Fixed width until mounted, so the label doesn't flash the wrong mode. */}
        <span className={cn("min-w-[4.5rem] text-center", !mounted && "invisible")}>
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground hover:bg-subtle",
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

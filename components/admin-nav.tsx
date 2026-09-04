"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, PlusCircle, BarChart3, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth-buttons";
import { ScalerLogo } from "@/components/scaler-logo";

const LINKS = [
  { href: "/packets", label: "Packets", icon: FileText },
  { href: "/create", label: "Create", icon: PlusCircle },
  { href: "/tracking", label: "Tracking", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: History },
];

export function AdminNav({ email }: { email?: string | null }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link href="/packets" className="mr-4 flex items-center gap-2">
          <ScalerLogo />
          <span className="hidden text-sm font-semibold text-muted-foreground sm:inline">
            Interview Packets
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {email ? <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span> : null}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

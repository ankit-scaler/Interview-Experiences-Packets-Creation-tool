"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyLinkButton({
  url,
  label = "Copy learner link",
  size = "sm",
  variant = "outline",
  className,
  disabled = false,
  disabledTitle = "Publish this packet to share its learner link",
}: {
  url: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost";
  className?: string;
  /** Drafts have no shareable learner link yet. */
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      onClick={async () => {
        if (disabled) return;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

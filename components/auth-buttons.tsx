"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// Both calls hand off to a full-page redirect, so the spinner stays up until the
// browser leaves; it only resets if the call itself fails.

export function GoogleSignInButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="lg"
      loading={pending}
      onClick={() => {
        setPending(true);
        signIn("google", { callbackUrl }).catch(() => setPending(false));
      }}
    >
      <LogIn className="h-4 w-4" />
      {pending ? "Redirecting to Google…" : "Continue with Google"}
    </Button>
  );
}

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() => {
        setPending(true);
        signOut({ callbackUrl: "/signin" }).catch(() => setPending(false));
      }}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}

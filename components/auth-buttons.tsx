"use client";

import { signIn, signOut } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  return (
    <Button onClick={() => signIn("google", { callbackUrl })} size="lg">
      <LogIn className="h-4 w-4" />
      Continue with Google
    </Button>
  );
}

export function SignOutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/signin" })}>
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}

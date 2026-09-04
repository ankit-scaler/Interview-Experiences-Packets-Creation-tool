import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { env } from "@/lib/env";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScalerLogo } from "@/components/scaler-logo";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const user = await currentUser();
  const callbackUrl = searchParams.callbackUrl || "/";
  if (user) redirect(callbackUrl);

  const isLearnerLink = callbackUrl.startsWith("/p/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <ScalerLogo className="h-7" />
        </div>
        {isLearnerLink ? (
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold">Your interview packet is ready</h1>
            <p className="text-sm text-muted-foreground">
              Built from interviews that already happened.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold">Interview Packets</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with your Google account to continue.
            </p>
          </div>
        )}
        <GoogleSignInButton callbackUrl={callbackUrl} />
        {!isLearnerLink && (
          <p className="text-xs text-muted-foreground">
            Scaler team members (<span className="font-mono">@{env.adminEmailDomain}</span>) get
            packet-creation access automatically.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Beta · issues to{" "}
        <Link href={`mailto:${env.contactEmail}`} className="underline">
          {env.contactEmail}
        </Link>
      </p>
    </main>
  );
}

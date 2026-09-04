import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { env } from "@/lib/env";
import { SignOutButton } from "@/components/auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  if (user.role === "ADMIN") redirect("/packets");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeToggle />
        <SignOutButton />
      </div>
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">You&apos;re signed in</h1>
        <p className="text-sm text-muted-foreground">
          Open the packet link you were given to read your interview questions. Signed in as{" "}
          <span className="font-medium text-foreground">{user.email}</span>.
        </p>
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

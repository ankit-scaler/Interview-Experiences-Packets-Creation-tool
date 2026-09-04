import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/auth";
import { env } from "@/lib/env";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=/packets");
  if (user.role !== "ADMIN") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">No admin access</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Packet creation is limited to Scaler team accounts (@{env.adminEmailDomain}). You are
          signed in as {user.email}.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <AdminNav email={user.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted-foreground">
        Beta version · report issues to{" "}
        <Link href={`mailto:${env.contactEmail}`} className="underline">
          {env.contactEmail}
        </Link>
      </footer>
    </div>
  );
}

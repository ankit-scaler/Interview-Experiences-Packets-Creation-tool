import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

function roleForEmail(email?: string | null): "ADMIN" | "LEARNER" {
  if (!email) return "LEARNER";
  return email.toLowerCase().endsWith(`@${env.adminEmailDomain}`) ? "ADMIN" : "LEARNER";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  trustHost: true,
  pages: { signIn: "/signin" },
  providers: [
    Google({
      authorization: {
        params: { prompt: "select_account", access_type: "offline" },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Recompute role from the domain rule so a promoted domain takes effect.
        const desired = roleForEmail(user.email);
        session.user.role = desired;
        if ((user as { role?: string }).role !== desired) {
          await db.user.update({ where: { id: user.id }, data: { role: desired } });
        }
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const desired = roleForEmail(user.email);
      if (user.id && (user as { role?: string }).role !== desired) {
        await db.user.update({ where: { id: user.id }, data: { role: desired } });
      }
    },
  },
});

export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

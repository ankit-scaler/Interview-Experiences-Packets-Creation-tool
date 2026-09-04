import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "LEARNER";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "ADMIN" | "LEARNER";
  }
}

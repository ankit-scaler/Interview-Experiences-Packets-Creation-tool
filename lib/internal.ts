import { env } from "./env";

/**
 * Scaler staff (@scaler.com) open packets to review and QA them. That activity
 * must never land in learner metrics, so it is neither recorded nor reported.
 */
export function isInternalEmail(email?: string | null): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${env.adminEmailDomain}`));
}

const suffix = `@${env.adminEmailDomain}`;

/** Prisma `NOT` fragment for models with a `userEmail` column. */
export const NOT_INTERNAL = {
  userEmail: { endsWith: suffix, mode: "insensitive" as const },
};

/** Prisma `NOT` fragment for models that reach the email via `packetRead`. */
export const NOT_INTERNAL_VIA_READ = {
  packetRead: { userEmail: { endsWith: suffix, mode: "insensitive" as const } },
};

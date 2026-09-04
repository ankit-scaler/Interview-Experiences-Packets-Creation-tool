import { NextResponse } from "next/server";
import { currentUser } from "@/auth";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Guard an admin API route. Returns the user or a NextResponse to return early. */
export async function guardAdmin() {
  const user = await currentUser();
  if (!user) return { error: apiError("Sign in required.", 401) as NextResponse };
  if (user.role !== "ADMIN") return { error: apiError("Admin access required.", 403) as NextResponse };
  return { user };
}

/** Guard any authenticated (learner or admin) API route. */
export async function guardAuthed() {
  const user = await currentUser();
  if (!user) return { error: apiError("Sign in required.", 401) as NextResponse };
  return { user };
}

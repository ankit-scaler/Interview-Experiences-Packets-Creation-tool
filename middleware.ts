import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight first gate: if there's no session cookie at all, bounce to /signin
 * before the page (and its DB queries) run. Real authorization — admin vs learner,
 * session validity — is enforced in the route/layout with the Prisma adapter.
 */
const PROTECTED = [
  /^\/packets(\/|$)/,
  /^\/create(\/|$)/,
  /^\/tracking(\/|$)/,
  /^\/activity(\/|$)/,
  /^\/p\//,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();

  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/packets/:path*",
    "/create/:path*",
    "/tracking/:path*",
    "/activity/:path*",
    "/p/:path*",
  ],
};

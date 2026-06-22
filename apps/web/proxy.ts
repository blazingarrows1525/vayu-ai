import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Edge proxy (Next 16's successor to `middleware`). Optimistic guard that
 * bounces unauthenticated users away from app routes before they hit the
 * server. Authoritative checks still run per-page via requireSession().
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/research/:path*",
    "/agents/:path*",
    "/vault/:path*",
    "/docs/:path*",
    "/settings/:path*",
  ],
};

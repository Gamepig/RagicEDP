import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const devBypassAuth = process.env.PORTAL_DEV_BYPASS_AUTH === "true";

  if (devBypassAuth) {
    return NextResponse.next();
  }

  // Allow auth-related routes and static assets
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // NextAuth v5 beta may use AUTH_SECRET or NEXTAUTH_SECRET
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  // NextAuth v5 uses "authjs.session-token" cookie; on HTTPS it's "__Secure-authjs.session-token"
  const secureCookie = req.nextUrl.protocol === "https:";
  const cookieName = secureCookie
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const token = await getToken({ req, secret, secureCookie, cookieName, salt: cookieName });

  if (!token) {
    // Log for debugging
    const cookies = req.cookies.getAll().map(c => c.name);
    console.error("[middleware] No token. Cookies:", cookies.join(", "), "| secret defined:", !!secret);
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon\\.ico|.*\\.).*)"],
};

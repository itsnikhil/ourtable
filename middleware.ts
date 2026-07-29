import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig, PENDING_INVITE_COOKIE } from "@/lib/auth.config";
import { isAuthBypassEnabled } from "@/lib/auth-bypass-flag";

function withInviteCookie(req: NextRequest, response: NextResponse) {
  if (req.nextUrl.pathname.startsWith("/join/")) {
    const token = req.nextUrl.pathname.split("/")[2];
    if (token) {
      response.cookies.set(PENDING_INVITE_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  }
  return response;
}

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isAuthBypassEnabled()) {
    return withInviteCookie(req, NextResponse.next());
  }

  const isLoggedIn = !!req.auth;
  const isAuthRoute =
    pathname.startsWith("/sign-in") || pathname.startsWith("/join");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isCronApi = pathname.startsWith("/api/cron");
  const isUploadApi = pathname.startsWith("/api/uploads");
  const isPushApi = pathname.startsWith("/api/push");

  const response = withInviteCookie(req, NextResponse.next());

  if (isAuthApi || isCronApi) {
    return response;
  }

  if (!isLoggedIn && (isUploadApi || isPushApi)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLoggedIn && !isAuthRoute) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isLoggedIn && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

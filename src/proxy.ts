import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const roleRoutes = {
  "/admin": ["ADMIN"],
  "/staff": ["STAFF", "ADMIN"],
  "/approver": ["APPROVER", "ADMIN"],
} as const;

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackURL", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const matchedRoute = Object.entries(roleRoutes).find(([route]) =>
    request.nextUrl.pathname.startsWith(route),
  );

  if (matchedRoute) {
    const [, allowedRoles] = matchedRoute;
    const role = (session.user as { role?: string }).role;

    if (!role || !allowedRoles.includes(role as never)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/staff/:path*",
    "/approver/:path*",
    "/dashboard/:path*",
    "/consult/:path*",
    "/quotation/:path*",
    "/tor/:path*",
    "/requests/:path*",
  ],
};

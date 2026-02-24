import { NextRequest, NextResponse } from "next/server";

type AppRole = "cliente" | "profissional" | "estabelecimento";

function redirectHome(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

function hasRole(allowedRoles: AppRole[], roleCookie: string | undefined) {
  if (!roleCookie) return false;
  return allowedRoles.includes(roleCookie as AppRole);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const authCookie = request.cookies.get("ep_auth")?.value;
  const roleCookie = request.cookies.get("ep_role")?.value;
  const isAuthenticated = authCookie === "1";

  const isDashboardRoot = pathname === "/dashboard";
  const isClientDashboard = pathname.startsWith("/dashboard/cliente");
  const isProfessionalDashboard = pathname.startsWith("/dashboard/profissional");
  const isEstablishmentDashboard = pathname.startsWith("/dashboard/estabelecimento");
  const isTokensPage = pathname.startsWith("/tokens");
  const isProfessionalProfileView = pathname.startsWith("/profissional/");
  const isEstablishmentProfileView = pathname.startsWith("/estabelecimento/");

  if (
    !isDashboardRoot &&
    !isClientDashboard &&
    !isProfessionalDashboard &&
    !isEstablishmentDashboard &&
    !isTokensPage &&
    !isProfessionalProfileView &&
    !isEstablishmentProfileView
  ) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return redirectHome(request);
  }

  if (isDashboardRoot) {
    if (!hasRole(["cliente", "profissional", "estabelecimento"], roleCookie)) {
      return redirectHome(request);
    }
    return NextResponse.next();
  }

  if (isClientDashboard && !hasRole(["cliente"], roleCookie)) {
    return redirectHome(request);
  }

  if (isProfessionalDashboard && !hasRole(["profissional"], roleCookie)) {
    return redirectHome(request);
  }

  if (isEstablishmentDashboard && !hasRole(["estabelecimento"], roleCookie)) {
    return redirectHome(request);
  }

  if (isTokensPage && !hasRole(["profissional", "estabelecimento"], roleCookie)) {
    return redirectHome(request);
  }

  if ((isProfessionalProfileView || isEstablishmentProfileView) && !hasRole(["cliente"], roleCookie)) {
    return redirectHome(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/tokens/:path*", "/profissional/:path*", "/estabelecimento/:path*"],
};

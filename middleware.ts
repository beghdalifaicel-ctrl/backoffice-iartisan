import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me-in-production");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // ─── Séparation domaines : app.iartisan.io = espace client/admin uniquement ───
  // Sur app.iartisan.io, les pages publiques (landing, CGV, mentions...) redirigent vers www
  const isAppDomain = hostname.startsWith("app.");
  const isPublicPage = !pathname.startsWith("/client") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/favicon") &&
    !pathname.startsWith("/test-agents");

  if (isAppDomain && isPublicPage) {
    // Rediriger vers le dashboard client si connecté, sinon login
    const token = req.cookies.get("ia-session")?.value;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, secret);
        const role = (payload as any).role;
        if (role === "admin") {
          return NextResponse.redirect(new URL("/admin", req.url));
        }
        return NextResponse.redirect(new URL("/client", req.url));
      } catch {
        return NextResponse.redirect(new URL("/client/login", req.url));
      }
    }
    return NextResponse.redirect(new URL("/client/login", req.url));
  }

  // Sur www (ou localhost), les pages publiques (landing, CGV, etc.) passent librement
  if (!isAppDomain && isPublicPage) {
    return NextResponse.next();
  }

  // Routes publiques — ne pas protéger
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/client/login") ||
    pathname.startsWith("/client/forgot-password") ||
    pathname.startsWith("/client/signup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/client/auth") ||
    pathname.startsWith("/api/leads") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/integrations") ||
    pathname.startsWith("/api/oauth/") ||
    pathname.startsWith("/api/agents/worker") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/test") ||
    pathname.startsWith("/test-agents") ||
    pathname.startsWith("/api/admin/knowledge/seed") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Vérifier le token — cookie OU Bearer header
  const cookieToken = req.cookies.get("ia-session")?.value;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    // Redirect clients vs admins to their respective login
    const loginUrl = pathname.startsWith("/client") ? "/client/login" : "/login";
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as any).role;

    // Vérifier que les routes /client ne sont accessibles qu'aux clients (ou admin)
    if (pathname.startsWith("/client") || pathname.startsWith("/api/client/")) {
      if (role !== "client" && role !== "admin") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/client/login", req.url));
      }
    }

    // Vérifier que les routes /admin ne sont accessibles qu'aux admins
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin") || pathname.startsWith("/api/stats") || pathname.startsWith("/api/clients")) {
      if (role !== "admin") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    return NextResponse.next();
  } catch {
    // Token invalide ou expiré
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Session expirée" }, { status: 401 });
    }
    const loginUrl = pathname.startsWith("/client") ? "/client/login" : "/login";
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT static assets (_next/static, _next/image, favicon.ico)
     * This is needed so the middleware can redirect public pages on app.iartisan.io
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

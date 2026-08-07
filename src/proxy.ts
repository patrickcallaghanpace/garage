import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";
import { env, isSupabaseConfigured } from "@/lib/env";

const handleI18nRouting = createIntlMiddleware(routing);

const ADMIN_RE = /^\/(en\/)?admin(\/.*)?$/;
const ADMIN_LOGIN_RE = /^\/(en\/)?admin\/login\/?$/;

export default async function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = ADMIN_RE.test(pathname);
  if (!isAdminRoute) {
    return response;
  }

  const isLoginRoute = ADMIN_LOGIN_RE.test(pathname);
  const isEnglish = pathname.startsWith("/en/") || pathname === "/en";

  // Supabase isn't configured yet (fresh clone, no keys set up): every admin
  // page depends on it, so send everything to /admin/login, which renders a
  // friendly "not configured" message instead of every dashboard page
  // crashing on its own data fetch.
  if (!isSupabaseConfigured) {
    if (isLoginRoute) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = isEnglish ? "/en/admin/login" : "/admin/login";
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isLoginRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = isEnglish ? "/en/admin/login" : "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (isLoginRoute && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = isEnglish ? "/en/admin" : "/admin";
    dashboardUrl.search = "";
    const redirect = NextResponse.redirect(dashboardUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

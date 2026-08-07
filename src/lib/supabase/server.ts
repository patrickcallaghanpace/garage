import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Server Component / Route Handler client, anon key + request cookies.
 * Used only to read the admin's auth session (e.g. in the /admin layout).
 * All actual data access goes through lib/supabase/admin.ts.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — safe to ignore since
          // middleware refreshes the session cookie on every request.
        }
      },
    },
  });
}

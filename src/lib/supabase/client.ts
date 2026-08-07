import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Browser client, anon key only. Used exclusively for the Supabase Auth
 * flows (admin sign-in/sign-out) — never queries app tables directly, since
 * those have no RLS policies for the anon/authenticated roles.
 */
export function getSupabaseBrowserClient() {
  return createBrowserClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!);
}

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client: bypasses RLS entirely. This is how the whole app
 * (booking engine, admin dashboard data, notifications) talks to Postgres —
 * every table has RLS enabled with no policies, so this key is the only way
 * in. Server-only; importing this from a client component is a build error.
 *
 * Deliberately untyped (no `Database` generic): supabase-js's generated-types
 * machinery is strict about the exact shape of Row/Insert/Update/Relationships,
 * and our hand-written types in lib/types/database.ts are meant to document
 * the schema for callers, not to drive PostgREST's builder inference. Service
 * functions annotate their own return types instead (see scheduling.ts).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local (see docs/SETUP.md)."
    );
  }
  if (!cached) {
    cached = createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}

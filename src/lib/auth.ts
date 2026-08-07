import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Returns the authenticated admin user, or null. There is a single admin account. */
export async function getAdminUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

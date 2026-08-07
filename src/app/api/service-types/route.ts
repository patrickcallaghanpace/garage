import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toErrorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("service_types")
      .select("id, name_fr, name_en, default_duration_minutes, active, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ serviceTypes: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

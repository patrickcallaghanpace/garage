import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toErrorResponse } from "@/lib/api-utils";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("service_types")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ serviceTypes: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

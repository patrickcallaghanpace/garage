import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toErrorResponse } from "@/lib/api-utils";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { date } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("daily_overrides").delete().eq("date", date);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

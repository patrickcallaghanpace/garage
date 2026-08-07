import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { dailyOverrideSchema } from "@/lib/validation";
import { toErrorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const supabase = getSupabaseAdmin();
    let query = supabase.from("daily_overrides").select("*").order("date", { ascending: true });
    if (from) query = query.gte("date", from);
    if (to) query = query.lt("date", to);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ overrides: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = dailyOverrideSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("daily_overrides")
      .upsert(
        {
          date: body.date,
          start_anchor_type: body.startAnchorType,
          custom_lat: body.customLat ?? null,
          custom_lng: body.customLng ?? null,
        },
        { onConflict: "date" }
      )
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ override: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

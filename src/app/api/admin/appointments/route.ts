import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { adminBookingSchema } from "@/lib/validation";
import { adminCreateBooking } from "@/lib/services/scheduling";
import { toErrorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json(
        { error: "validation_error", message: "from and to query params are required (yyyy-MM-dd)." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "*, clients(id, name, phone, email, preferred_language), service_types(id, name_fr, name_en)"
      )
      .gte("scheduled_start", `${from}T00:00:00.000Z`)
      .lt("scheduled_start", `${to}T00:00:00.000Z`)
      .neq("status", "cancelled")
      .order("scheduled_start", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ appointments: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = adminBookingSchema.parse(await request.json());
    const result = await adminCreateBooking(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

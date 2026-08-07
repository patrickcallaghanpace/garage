import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { updateAppointmentSchema } from "@/lib/validation";
import { toErrorResponse } from "@/lib/api-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = updateAppointmentSchema.parse(await request.json());

    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) patch.status = body.status;
    if (body.paymentStatus !== undefined) patch.payment_status = body.paymentStatus;
    if (body.notes !== undefined) patch.notes = body.notes;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "validation_error", message: "Nothing to update." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ appointment: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { serviceTypeUpdateSchema } from "@/lib/validation";
import { toErrorResponse } from "@/lib/api-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = serviceTypeUpdateSchema.parse(await request.json());
    const patch: Record<string, unknown> = {};
    if (body.active !== undefined) patch.active = body.active;
    if (body.defaultDurationMinutes !== undefined) patch.default_duration_minutes = body.defaultDurationMinutes;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("service_types")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ serviceType: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

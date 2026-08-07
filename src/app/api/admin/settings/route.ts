import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { adminSettingsSchema } from "@/lib/validation";
import { geocodeAddress } from "@/lib/google-maps";
import { toErrorResponse } from "@/lib/api-utils";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("admin_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = adminSettingsSchema.parse(await request.json());
    const patch: Record<string, unknown> = {};

    if (body.homeAddress !== undefined) {
      if (body.homeAddress === null) {
        Object.assign(patch, {
          home_address_street: null,
          home_address_postal_code: null,
          home_address_locality: null,
          home_address_canton: null,
          home_lat: null,
          home_lng: null,
        });
      } else {
        const location = await geocodeAddress(body.homeAddress);
        Object.assign(patch, {
          home_address_street: body.homeAddress.street,
          home_address_postal_code: body.homeAddress.postalCode,
          home_address_locality: body.homeAddress.locality,
          home_address_canton: body.homeAddress.canton,
          home_lat: location?.lat ?? null,
          home_lng: location?.lng ?? null,
        });
      }
    }

    if (body.workAddress !== undefined) {
      if (body.workAddress === null) {
        Object.assign(patch, {
          work_address_street: null,
          work_address_postal_code: null,
          work_address_locality: null,
          work_address_canton: null,
          work_lat: null,
          work_lng: null,
        });
      } else {
        const location = await geocodeAddress(body.workAddress);
        Object.assign(patch, {
          work_address_street: body.workAddress.street,
          work_address_postal_code: body.workAddress.postalCode,
          work_address_locality: body.workAddress.locality,
          work_address_canton: body.workAddress.canton,
          work_lat: location?.lat ?? null,
          work_lng: location?.lng ?? null,
        });
      }
    }

    if (body.defaultStartAnchor !== undefined) patch.default_start_anchor = body.defaultStartAnchor;
    if (body.workingHours !== undefined) patch.working_hours = body.workingHours;
    if (body.lunchBreakStart !== undefined) patch.lunch_break_start = body.lunchBreakStart;
    if (body.lunchBreakEnd !== undefined) patch.lunch_break_end = body.lunchBreakEnd;
    if (body.hardRadiusMinutes !== undefined) patch.hard_radius_minutes = body.hardRadiusMinutes;
    if (body.efficiencyCapEnabled !== undefined) patch.efficiency_cap_enabled = body.efficiencyCapEnabled;
    if (body.efficiencyCapMinutes !== undefined) patch.efficiency_cap_minutes = body.efficiencyCapMinutes;
    if (body.notificationPrefs !== undefined) patch.notification_prefs = body.notificationPrefs;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_settings")
      .update(patch)
      .eq("id", 1)
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ settings: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

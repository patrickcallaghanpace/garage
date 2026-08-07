import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { previewImpactSchema } from "@/lib/validation";
import { previewManualBookingImpact } from "@/lib/services/scheduling";
import { toErrorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = previewImpactSchema.parse(await request.json());
    const impact = await previewManualBookingImpact(body);
    return NextResponse.json({ impact });
  } catch (err) {
    return toErrorResponse(err);
  }
}

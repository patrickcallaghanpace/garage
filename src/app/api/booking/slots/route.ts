import { NextResponse, type NextRequest } from "next/server";
import { findSlotsSchema } from "@/lib/validation";
import { findAvailableSlots } from "@/lib/services/scheduling";
import { toErrorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = findSlotsSchema.parse(await request.json());
    const slots = await findAvailableSlots(body);
    return NextResponse.json({ slots });
  } catch (err) {
    return toErrorResponse(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { createBookingSchema } from "@/lib/validation";
import { createBooking } from "@/lib/services/scheduling";
import { toErrorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = createBookingSchema.parse(await request.json());
    const { appointment } = await createBooking({ ...body, source: "online" });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

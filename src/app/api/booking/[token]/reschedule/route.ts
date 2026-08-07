import { NextResponse, type NextRequest } from "next/server";
import { rescheduleBookingSchema } from "@/lib/validation";
import { findAvailableSlotsForReschedule, rescheduleBooking } from "@/lib/services/scheduling";
import { toErrorResponse } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const slots = await findAvailableSlotsForReschedule(token);
    return NextResponse.json({ slots });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = rescheduleBookingSchema.parse(await request.json());
    const { appointment } = await rescheduleBooking(token, body.chosenStartIso);
    return NextResponse.json({ appointment });
  } catch (err) {
    return toErrorResponse(err);
  }
}

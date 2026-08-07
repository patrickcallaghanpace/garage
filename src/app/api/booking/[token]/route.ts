import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/services/scheduling";
import { toErrorResponse } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const booking = await getBookingByToken(token);
    if (!booking) {
      return NextResponse.json({ error: "not_found", message: "Booking not found." }, { status: 404 });
    }
    return NextResponse.json({ booking });
  } catch (err) {
    return toErrorResponse(err);
  }
}

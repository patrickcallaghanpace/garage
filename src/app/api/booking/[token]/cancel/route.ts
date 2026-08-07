import { NextResponse } from "next/server";
import { cancelBooking } from "@/lib/services/scheduling";
import { toErrorResponse } from "@/lib/api-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    await cancelBooking(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

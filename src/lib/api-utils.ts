import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AddressNotGeocodableError,
  AdminNotConfiguredError,
  BookingConflictError,
  BookingNotFoundError,
  InvalidServiceTypeError,
  SchedulingError,
  SlotNoLongerAvailableError,
} from "@/lib/services/scheduling";
import { GoogleMapsNotConfiguredError } from "@/lib/google-maps";

/** Maps known service-layer/validation errors to an HTTP response; logs anything unexpected. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "validation_error", message: "Invalid request.", issues: err.issues },
      { status: 400 }
    );
  }
  if (err instanceof AddressNotGeocodableError) {
    return NextResponse.json({ error: "address_not_geocodable", message: err.message }, { status: 422 });
  }
  if (err instanceof InvalidServiceTypeError) {
    return NextResponse.json({ error: "invalid_service_type", message: err.message }, { status: 422 });
  }
  if (err instanceof SlotNoLongerAvailableError) {
    return NextResponse.json({ error: "slot_unavailable", message: err.message }, { status: 409 });
  }
  if (err instanceof BookingConflictError) {
    return NextResponse.json({ error: "booking_conflict", message: err.message }, { status: 409 });
  }
  if (err instanceof BookingNotFoundError) {
    return NextResponse.json({ error: "not_found", message: err.message }, { status: 404 });
  }
  if (err instanceof GoogleMapsNotConfiguredError || err instanceof AdminNotConfiguredError) {
    return NextResponse.json({ error: "not_configured", message: err.message }, { status: 503 });
  }
  if (err instanceof SchedulingError) {
    return NextResponse.json({ error: "scheduling_error", message: err.message }, { status: 400 });
  }

  console.error("Unhandled API error:", err);
  return NextResponse.json({ error: "internal_error", message: "Something went wrong." }, { status: 500 });
}

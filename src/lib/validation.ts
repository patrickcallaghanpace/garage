import { z } from "zod";

export const swissAddressSchema = z.object({
  street: z.string().min(3).max(200),
  postalCode: z.string().regex(/^\d{4}$/, "Swiss postal codes have 4 digits"),
  locality: z.string().min(1).max(100),
  canton: z.string().min(2).max(30),
});

export const clientContactSchema = z.object({
  name: z.string().min(2).max(150),
  phone: z.string().min(6).max(30),
  email: z.string().email(),
  preferredLanguage: z.enum(["fr", "en"]).default("fr"),
});

export const findSlotsSchema = z.object({
  serviceTypeId: z.string().uuid(),
  address: swissAddressSchema,
});

export const createBookingSchema = z.object({
  serviceTypeId: z.string().uuid(),
  address: swissAddressSchema,
  client: clientContactSchema,
  chosenStartIso: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

export const rescheduleBookingSchema = z.object({
  chosenStartIso: z.string().datetime(),
});

export const adminBookingSchema = z.object({
  serviceTypeId: z.string().uuid(),
  address: swissAddressSchema,
  client: clientContactSchema,
  startIso: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480),
  source: z.enum(["phone", "admin_manual"]),
  notes: z.string().max(1000).optional(),
});

export const previewImpactSchema = z.object({
  serviceTypeId: z.string().uuid(),
  address: swissAddressSchema,
  startIso: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
  paymentStatus: z.enum(["unpaid", "paid_onsite", "paid_online"]).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const dailyOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startAnchorType: z.enum(["home", "work", "current_location"]),
  customLat: z.number().optional(),
  customLng: z.number().optional(),
});

const workingHoursDaySchema = z.object({
  open: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  end: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
});

export const adminSettingsSchema = z.object({
  homeAddress: swissAddressSchema.nullable().optional(),
  workAddress: swissAddressSchema.nullable().optional(),
  defaultStartAnchor: z.enum(["home", "work"]).optional(),
  workingHours: z
    .object({
      "1": workingHoursDaySchema,
      "2": workingHoursDaySchema,
      "3": workingHoursDaySchema,
      "4": workingHoursDaySchema,
      "5": workingHoursDaySchema,
      "6": workingHoursDaySchema,
      "7": workingHoursDaySchema,
    })
    .optional(),
  lunchBreakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lunchBreakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hardRadiusMinutes: z.number().int().min(1).optional(),
  efficiencyCapEnabled: z.boolean().optional(),
  efficiencyCapMinutes: z.number().int().min(1).nullable().optional(),
  notificationPrefs: z
    .object({
      email_enabled: z.boolean(),
      whatsapp_enabled: z.boolean(),
      admin_email: z.string().email().nullable(),
      admin_whatsapp_number: z.string().nullable(),
    })
    .optional(),
});

export const serviceTypeUpdateSchema = z.object({
  active: z.boolean().optional(),
  defaultDurationMinutes: z.number().int().min(5).max(480).optional(),
});

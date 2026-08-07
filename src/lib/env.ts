/**
 * Central place for reading env vars and deriving feature flags. Nothing in
 * this file throws — missing optional integrations degrade gracefully, and
 * callers check the relevant `is*Configured` flag before using a client.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  googleMapsApiKey,
  resendApiKey,
  resendFromEmail,
  twilioAccountSid,
  twilioAuthToken,
  twilioWhatsappFrom,
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey
);

export const isGoogleMapsConfigured = Boolean(googleMapsApiKey);

export const isEmailConfigured = Boolean(resendApiKey && resendFromEmail);

export const isWhatsappConfigured = Boolean(
  twilioAccountSid && twilioAuthToken && twilioWhatsappFrom
);

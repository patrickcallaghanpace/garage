# Garage Mobile — route-efficient booking app

A booking app for an independent mobile mechanic (garagiste) based in Switzerland. Clients book online at `/book`; the scheduling engine only ever offers time slots that keep the admin's driving route efficient, based on real drive times between job addresses (Google Distance Matrix). The admin manages everything from a mobile-first dashboard at `/admin`.

## Tech stack

- **Next.js (App Router) + TypeScript** — deployed on Vercel
- **Supabase** — Postgres database, Auth (admin login)
- **Google Maps Platform** — Geocoding API + Distance Matrix API (the scheduling engine)
- **Resend** — transactional email
- **Twilio WhatsApp Business API** — WhatsApp confirmations/reminders
- **next-intl** — French (default) / English, structured so German can be added later
- **Tailwind CSS + shadcn/ui (Base UI)**
- **Vitest** — unit tests for the scheduling engine

## Quickstart

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app runs in **degraded-but-functional mode** with any/all of the third-party integrations left unconfigured:

- No Supabase → every page that needs the database shows a friendly "not configured" message instead of crashing (including `/admin`, which redirects to a login screen explaining what's missing).
- No Google Maps key → `/book` shows "booking temporarily unavailable, please call".
- No Resend/Twilio → bookings still work, notifications are silently skipped (logged to the server console).

**Full setup instructions for every third-party service, from scratch, are in [docs/SETUP.md](docs/SETUP.md).** Start there.

## Project structure

```
src/
  app/[locale]/            # all pages (public + admin), French unprefixed, English at /en/*
    book/                  # client booking wizard
    booking/[token]/       # reschedule/cancel via unguessable token, no login
    admin/login/           # admin sign-in
    admin/(dashboard)/     # calendar, new phone booking, settings — auth-gated
  app/api/                 # REST API wrapping the service layer (see below)
  lib/services/
    scheduling-core.ts     # pure slot-finding geometry — no I/O, fully unit-tested
    scheduling.ts          # orchestrator: DB + Google Maps + scheduling-core
    notifications.ts       # email/WhatsApp, feature-flagged
  lib/google-maps.ts       # Geocoding + Distance Matrix
  lib/supabase/            # admin.ts (service role, all real data access),
                            # client.ts/server.ts (anon key, admin auth only)
supabase/migrations/       # schema — run these against your Supabase project
messages/{fr,en}.json       # translations
docs/SETUP.md               # step-by-step third-party setup
```

The booking/scheduling logic lives entirely in `src/lib/services/*.ts` (`findAvailableSlots`, `createBooking`, `getBookingByToken`, `cancelBooking`, `rescheduleBooking`, `adminCreateBooking`), exposed through `src/app/api/**/route.ts`. This is deliberate: a future AI voice receptionist can call the same functions directly instead of going through forms.

## Development

```bash
npm run dev          # dev server
npm run build         # production build + typecheck
npm run test           # scheduling engine unit tests (vitest)
npm run lint            # eslint
```

## Database migrations

Apply `supabase/migrations/*.sql` in order (via the Supabase CLI or the SQL editor in the dashboard — see [docs/SETUP.md](docs/SETUP.md)). They set up the schema, seed the default service types, and enable Row Level Security with no policies: every table is only ever reachable from the server via the service-role key (`src/lib/supabase/admin.ts`), never directly from the browser.

## Payments

`payment_status` (unpaid / paid on-site / paid online) is tracked now; the admin marks jobs paid on-site from the dashboard. The schema already has `payment_amount`, `payment_currency` (CHF) and a nullable Stripe payment intent id ready for a later phase — Stripe (card + Twint) isn't wired up yet.

## Deploying

Deploy to Vercel, set the environment variables from `.env.example` in the Vercel project settings, and point your domain's DNS at Vercel. The Google Business Profile "Book" button should link to `https://yourdomain.com/book`. See [docs/SETUP.md](docs/SETUP.md) for the full walkthrough, including the daily WhatsApp/email reminder cron job (`vercel.json`).

## Privacy & security

- Vercel serves everything over HTTPS by default.
- Every table has Row Level Security enabled with **no policies at all** — the browser's anon/authenticated keys can't read or write client/appointment data under any circumstance. All real data access happens server-side through the service-role key (`src/lib/supabase/admin.ts`), which is never sent to the browser.
- The reschedule/cancel link uses a 192-bit random token (`reschedule_cancel_token`) rather than a login — unguessable, but treat it like a password when sharing it (it's only ever sent to the client's own email/WhatsApp).
- Concurrent bookings for overlapping times are rejected at the database level (a Postgres exclusion constraint), not just in application code — so a race condition can't double-book the admin.
- Only collect what's needed for the job at hand (name, phone, email, address) — there's no tracking, analytics, or data sharing built in.

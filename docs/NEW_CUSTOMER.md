# Onboarding a new customer

This app runs as **one deployment per customer** — same GitHub repo, but each garagiste gets their own Supabase project (their data lives in a fully isolated database) and their own Vercel project (their own domain and env vars). There is no shared multi-tenant database, so there's no risk of one customer's data ever crossing into another's.

Patrick owns and manages every underlying account (Supabase, Vercel, Google Maps, Resend, Twilio) — customers just use the app. This doc is the fast checklist once you've done it once; see [SETUP.md](SETUP.md) for the full from-scratch walkthrough of each service if you need more detail on a step.

## Checklist for customer N

1. **Supabase** — new project (region near Switzerland). Run the 3 files in `supabase/migrations/` in order via the SQL Editor. Create the customer's admin login in Authentication → Users. Copy the Project URL, publishable/anon key, and secret/service-role key.

2. **Google Maps** — reuse the existing shared Google Cloud project and `GOOGLE_MAPS_API_KEY`. The key is server-only (never sent to the browser), so sharing it across customers is safe, and it keeps billing/quota in one place. Only spin up a separate Google Cloud project for a customer if their volume later needs isolated billing or quota.

3. **Resend** — reuse the existing Resend account. Add and verify the new customer's sending domain (Domains → Add Domain, then the DNS records it gives you) — Resend supports multiple verified domains on one account. Set that customer's `RESEND_FROM_EMAIL` to `"<Customer Name> <booking@customerdomain.ch>"`.

4. **Twilio WhatsApp** — reuse the existing Twilio account, but register a **new WhatsApp sender** for this customer (Messaging → Senders → WhatsApp senders) so messages come from their own business identity, not a shared number. Set that customer's `TWILIO_WHATSAPP_FROM`.

5. **Vercel** — Add New → Project → import the **same** GitHub repo (Vercel allows one repo to back multiple projects). Set environment variables for this project:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — this customer's Supabase project
   - `GOOGLE_MAPS_API_KEY` — shared
   - `RESEND_API_KEY` — shared, `RESEND_FROM_EMAIL` — this customer's
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — shared, `TWILIO_WHATSAPP_FROM` — this customer's
   - `BUSINESS_NAME` — this customer's business name (shown in the header/browser tab)
   - `NEXT_PUBLIC_APP_URL` — this customer's final domain, e.g. `https://garagedupont.ch`
   - `CRON_SECRET` — generate a fresh random value (`openssl rand -hex 32`) per customer, don't reuse one across deployments

6. **Domain** — Vercel project → Settings → Domains → add the customer's domain, update their DNS as instructed.

7. **Google Business Profile** — set the customer's "Book" button to `https://customerdomain.ch/book`.

8. **First run** — log into `/admin` and fill in **Settings**: home/work address, working hours, lunch break, hard radius cap, efficiency cap, admin alert email/WhatsApp number.

## Shipping updates to everyone

Since every customer deploys from the same repo/branch, a normal `git push` to `main` triggers a redeploy on every customer's Vercel project automatically — no per-customer merging needed. Just be mindful that a change goes out to all customers at once; there's no gradual rollout or per-customer feature flagging built in today.

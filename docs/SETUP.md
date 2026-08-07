# Setup guide

Everything here can be done from scratch with a free-tier account on each service. Do the sections in order — later ones assume earlier ones are done. Skip any section and the app keeps working in degraded mode (see the README); come back to it later.

Every value you collect goes into `.env.local` for local development, and into your Vercel project's Environment Variables for production (Vercel → your project → Settings → Environment Variables). Use `.env.example` as the checklist.

## 1. Supabase (database + admin login)

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project (pick a region close to Switzerland, e.g. Frankfurt).
2. Once the project is ready, go to **Project Settings → API**. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (click "reveal") → `SUPABASE_SERVICE_ROLE_KEY` — treat this like a password, it bypasses all database security rules. Never put it in a `NEXT_PUBLIC_*` variable or client-side code.
3. Run the migrations to create the schema. Two options:
   - **SQL editor (no CLI needed):** in the Supabase dashboard, open **SQL Editor**, and run each file in `supabase/migrations/` in order (`0001_init.sql`, `0002_seed_service_types.sql`, `0003_reminder_sent_at.sql`) — paste the contents, click Run.
   - **Supabase CLI:** `npx supabase login`, `npx supabase link --project-ref <your-project-ref>`, then `npx supabase db push`.
4. Create the admin account: dashboard → **Authentication → Users → Add user**. Use the garagiste's real email and a strong password — this is the only login for `/admin`. (There's no self-signup flow in the app on purpose — this is a single-admin tool.)
5. Confirm `admin_settings` has exactly one row (the migration inserts it automatically) — you'll fill in the actual home/work addresses etc. from the **Settings** tab inside `/admin` once the app is running.

## 2. Google Maps Platform (the scheduling engine)

The engine needs two APIs: **Geocoding API** (turns an address into coordinates) and **Distance Matrix API** (real drive times between two points).

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or reuse one).
2. **Enable billing** on the project — both APIs require it, even though Google gives a monthly free credit that comfortably covers a single mobile mechanic's booking volume. APIs & Services → Library won't let you enable the APIs below without billing attached.
3. Go to **APIs & Services → Library**, search for and enable:
   - **Geocoding API**
   - **Distance Matrix API**
4. Go to **APIs & Services → Credentials → Create Credentials → API key**.
5. Click into the new key and **restrict** it (important — an unrestricted key billed to your card is a real risk):
   - **Application restrictions**: "IP addresses" is simplest for a server-only key (Vercel's outbound IPs aren't static on the free/Pro plan, so in practice leaving this as "None" but relying on the API restriction below is the pragmatic choice for this app, since the key is only ever used server-side and never shipped to the browser).
   - **API restrictions**: restrict the key to exactly "Geocoding API" and "Distance Matrix API".
6. Copy the key into `GOOGLE_MAPS_API_KEY`.
7. Set a budget alert (Billing → Budgets & alerts) so you hear about unexpected usage — good practice for any pay-as-you-go API key.

## 3. Resend (confirmation/alert emails)

1. Go to [resend.com](https://resend.com) and sign up.
2. **Add and verify your domain**: Domains → Add Domain, then add the DNS records (SPF/DKIM) it gives you at your domain registrar. Verification usually takes a few minutes to a few hours.
   - No domain yet, or don't want to wait? Skip this for now — Resend also gives you a shared `onboarding@resend.dev` sender for testing, but production email must use a verified domain (better deliverability, and required to send to arbitrary client addresses reliably).
3. API Keys → Create API Key → copy it into `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL` to something like `Garage Dupont <booking@yourdomain.com>` (must be `@` your verified domain).

## 4. Twilio WhatsApp Business API (WhatsApp confirmations/reminders)

1. Go to [twilio.com](https://twilio.com) and sign up. Copy your **Account SID** and **Auth Token** from the console dashboard into `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
2. **For testing immediately:** Twilio gives every account a free WhatsApp Sandbox (Messaging → Try it out → Send a WhatsApp message). Set `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` (the standard sandbox number) and have the admin's phone (and any test client phone) send the given join code to that number on WhatsApp once — sandbox messages only reach numbers that have joined.
3. **For production:** you need a real WhatsApp Business sender, which means:
   - A Meta Business Manager account, verified.
   - Register a phone number for WhatsApp Business (can't be a number already active on personal WhatsApp) through Twilio's WhatsApp Senders flow (Messaging → Senders → WhatsApp senders).
   - Submit for WhatsApp Business Platform approval (Meta reviews this — can take a few days).
   - Once approved, set `TWILIO_WHATSAPP_FROM=whatsapp:+<your approved number>`.
4. Note: outside a 24-hour window since the client's last message, WhatsApp requires pre-approved **message templates** for business-initiated messages (like a booking confirmation or reminder). Twilio's console lets you submit templates for approval under Messaging → Content Template Builder. This app currently sends free-form text, which works within the 24h session window (e.g. right after a client submits a booking) — for reminders sent well after that window, you'll likely need to set up an approved template and adjust `src/lib/services/notifications.ts` accordingly once your account requires it.

## 5. Daily reminder job

`vercel.json` schedules `/api/cron/reminders` to run once a day (17:00 UTC) via Vercel Cron — no extra setup beyond deploying to Vercel. It sends the day-before WhatsApp/email reminder for tomorrow's appointments.

Generate a random secret (e.g. `openssl rand -hex 32`) and set it as `CRON_SECRET` in your Vercel environment variables. Vercel automatically sends it as a Bearer token when it triggers the cron job; without it, the route stays disabled (returns 503) so it can't be hit by anyone who finds the URL.

## 6. Domain + Vercel deployment

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Go to [vercel.com](https://vercel.com) → Add New → Project → import the repo.
3. In **Environment Variables**, add everything from `.env.example` that you've collected above (`NEXT_PUBLIC_APP_URL` should be your final production URL, e.g. `https://yourdomain.com`).
4. Deploy.
5. Add your custom domain: Project → Settings → Domains → add it, then update your domain registrar's DNS as instructed.
6. **Google Business Profile:** in the Business Profile Manager, edit your profile and set the "Book" / "Book online" button URL to `https://yourdomain.com/book`. Since French is the default locale and unprefixed, this link always renders the French booking page unless a visitor manually switches to English.

## 7. First run

Once Supabase + Google Maps are configured and deployed:

1. Sign in at `/admin/login` with the account you created in step 1.
2. Go to **Settings** and fill in:
   - Home and/or work address (used as the day's default starting point)
   - Working hours, lunch break (defaults to Mon–Fri 08:00–18:00, lunch 12:00–13:30)
   - Hard radius cap (defaults to 90 min) and, optionally, the efficiency cap
   - Notification email/WhatsApp number for admin alerts
3. Try a booking yourself at `/book` to confirm the scheduling engine returns sensible slots, then check the appointment shows up on the admin calendar.

-- Tracks whether the day-before WhatsApp/email reminder has gone out for an
-- appointment, so the daily reminder cron (src/app/api/cron/reminders) never
-- double-sends if it runs more than once for the same day.
alter table appointments add column reminder_sent_at timestamptz;

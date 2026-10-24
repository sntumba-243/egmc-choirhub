-- Multi-day events: optional end date.
--
-- end_date NULL = single-day event (every existing row, unchanged).
-- last_date is the event's final day (generated: end_date ?? date) so server
-- filters like "upcoming" are one column — `.gte('last_date', today)` keeps a
-- running convention listed until its last day. Never written by clients.
--
-- No policy changes: RLS keys on church/targeting, not dates.
-- Idempotent: safe to re-run.

alter table public.events add column if not exists end_date date;

alter table public.events drop constraint if exists events_end_date_check;
alter table public.events add constraint events_end_date_check
  check (end_date is null or end_date >= date);

alter table public.events add column if not exists last_date date
  generated always as (coalesce(end_date, date)) stored;

create index if not exists events_last_date_idx on public.events (last_date);

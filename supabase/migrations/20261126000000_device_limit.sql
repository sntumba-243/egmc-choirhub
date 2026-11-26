-- Device limit (branch device-limit). ADDITIVE ONLY: new tables + new
-- functions; no existing object is changed.
--
-- What it does when ENFORCED for an account:
--   • Each browser/app keeps a random device id (localStorage) and sends it to
--     device_check() after every sign-in and on app start when online. The id
--     is recorded against the Supabase Auth session (public.device_sessions).
--   • Devices, not sessions, are counted: an account's active sessions (used in
--     the last 30 days) are grouped by device id; legacy sessions with no id are
--     grouped by user agent.
--   • A device already known (same id on another session, or — when the id is
--     missing — the same user agent on a session idle > 65 min) replaces its old
--     session(s) and never counts as new.
--   • Only a NEW device while `limit` other devices are active is refused: its
--     session is revoked (auth.sessions row deleted → refresh token dead) and an
--     event is logged in public.device_limit_events.
--   • Sessions unused for 30 days are pruned.
-- Limit: 2 for members and guests; admins and super admins are exempt; the
-- super admin can set a per-account override (a number, or exempt).
--
-- FEATURE FLAG: device_limit_config.enforce_all (default false). While false,
-- device_check() only RECORDS the device id (no pruning, no revoking) except for
-- accounts whose override row has enforce_test = true (the throwaway test
-- member). Turning it on for everyone: update public.device_limit_config set
-- enforce_all = true;  — run the cut-down dry run first
-- (scripts/device-limit-cutdown.mjs).
--
-- Not covered: the Neon failover client (no Supabase Auth sessions there).
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.

-- ───────────────────────── tables ─────────────────────────

create table if not exists public.device_limit_config (
  id boolean primary key default true check (id),
  enforce_all boolean not null default false,
  default_limit integer not null default 2 check (default_limit between 1 and 20),
  updated_at timestamptz not null default now()
);
insert into public.device_limit_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.device_limit_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_devices integer check (max_devices between 1 and 20),
  exempt boolean not null default false,
  enforce_test boolean not null default false,   -- enforce while the global flag is off
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.device_sessions (
  session_id uuid primary key,                   -- auth.sessions.id
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text check (device_id is null or length(device_id) between 8 and 100),
  first_check_at timestamptz not null default now(),
  last_check_at timestamptz not null default now()
);
create index if not exists device_sessions_user_idx on public.device_sessions (user_id);

create table if not exists public.device_limit_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('refused', 'sign_out_all', 'sign_out_others')),
  user_id uuid references auth.users(id) on delete set null,
  member_id uuid,
  church_id uuid,
  device_id text,
  user_agent text,
  ip inet,
  active_devices integer,
  device_limit integer,
  alert boolean not null default false,          -- raised an alert (max 1 per member per hour)
  seen_at timestamptz,                           -- super admin acknowledged the alert
  actor_id uuid,                                 -- who did it (sign-outs)
  created_at timestamptz not null default now()
);
create index if not exists device_limit_events_user_idx on public.device_limit_events (user_id, created_at desc);
create index if not exists device_limit_events_church_idx on public.device_limit_events (church_id, created_at desc);

-- RLS: super admin reads all events, a church admin reads their church's,
-- members nothing. Every write goes through the SECURITY DEFINER functions.
alter table public.device_limit_config enable row level security;
alter table public.device_limit_overrides enable row level security;
alter table public.device_sessions enable row level security;
alter table public.device_limit_events enable row level security;

drop policy if exists device_limit_events_select on public.device_limit_events;
create policy device_limit_events_select on public.device_limit_events
  for select to authenticated
  using (public.msg_is_super() or (church_id is not null and public.msg_is_church_admin(church_id)));

drop policy if exists device_limit_overrides_select on public.device_limit_overrides;
create policy device_limit_overrides_select on public.device_limit_overrides
  for select to authenticated using (public.msg_is_super());

drop policy if exists device_limit_config_select on public.device_limit_config;
create policy device_limit_config_select on public.device_limit_config
  for select to authenticated using (public.msg_is_super());

revoke all on public.device_limit_config, public.device_limit_overrides,
              public.device_sessions, public.device_limit_events from anon;
revoke insert, update, delete on public.device_limit_config, public.device_limit_overrides,
              public.device_sessions, public.device_limit_events from authenticated;

-- ───────────────────────── helpers ─────────────────────────

-- Last activity of an auth session (refreshed_at is UTC without time zone).
create or replace function public.device_session_last_used(s auth.sessions)
returns timestamptz language sql immutable set search_path to '' as $$
  select greatest(s.created_at, coalesce(s.updated_at, s.created_at),
                  coalesce(s.refreshed_at at time zone 'UTC', s.created_at))
$$;

-- Member row for a login (by email, case-insensitive).
create or replace function public.device_member_of(p_uid uuid)
returns table (member_id uuid, church_id uuid, role text, full_name text, email text)
language sql stable security definer set search_path to '' as $$
  select m.id, m.church_id, m.role, trim(coalesce(m.first_name,'') || ' ' || coalesce(m.last_name,'')), u.email
  from auth.users u
  left join public.members m on lower(m.email) = lower(u.email)
  where u.id = p_uid
  limit 1
$$;

-- Device limit for a login: null = exempt.
create or replace function public.device_limit_for(p_uid uuid)
returns integer language plpgsql stable security definer set search_path to '' as $$
declare
  o public.device_limit_overrides;
  r text;
  is_super boolean;
begin
  select * into o from public.device_limit_overrides where user_id = p_uid;
  if o.exempt then return null; end if;
  if o.max_devices is not null then return o.max_devices; end if;
  select role into r from public.device_member_of(p_uid);
  select coalesce(u.is_super_admin, false) into is_super from public.users u where u.id = p_uid;
  if r in ('admin', 'super_admin') or coalesce(is_super, false) then return null; end if;
  return (select default_limit from public.device_limit_config);
end $$;

create or replace function public.device_limit_enforced(p_uid uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select coalesce((select enforce_all from public.device_limit_config), false)
      or coalesce((select enforce_test from public.device_limit_overrides where user_id = p_uid), false)
$$;

-- Active (≤ 30 days) sessions of a login with their device key.
-- Key: 'id:<device id>' when recorded, else 'ua:<user agent>' (legacy sessions).
create or replace function public.device_active_sessions(p_uid uuid)
returns table (session_id uuid, device_key text, device_id text, user_agent text, ip inet, last_used timestamptz)
language sql stable security definer set search_path to '' as $$
  select s.id,
         case when ds.device_id is not null then 'id:' || ds.device_id
              else 'ua:' || coalesce(s.user_agent, '?') end,
         ds.device_id, s.user_agent, s.ip, public.device_session_last_used(s)
  from auth.sessions s
  left join public.device_sessions ds on ds.session_id = s.id
  where s.user_id = p_uid
    and public.device_session_last_used(s) > now() - interval '30 days'
$$;

-- Distinct active devices of a login.
create or replace function public.device_count(p_uid uuid)
returns integer language sql stable security definer set search_path to '' as $$
  select count(distinct device_key)::int from public.device_active_sessions(p_uid)
$$;

-- Can the caller manage this login's devices? Same rule as reset-password:
-- super admin any; church admin only their church, never a super admin, never
-- another admin (their own account is fine).
create or replace function public.device_can_manage(p_uid uuid)
returns boolean language plpgsql stable security definer set search_path to '' as $$
declare
  t record;
  t_super boolean;
begin
  if auth.uid() is null then return false; end if;
  if public.msg_is_super() then return true; end if;
  if p_uid = auth.uid() then return true; end if;
  select * into t from public.device_member_of(p_uid);
  if t.member_id is null or t.church_id is null then return false; end if;
  select coalesce(u.is_super_admin, false) into t_super from public.users u where u.id = p_uid;
  if coalesce(t_super, false) or t.role = 'super_admin' or t.role = 'admin' then return false; end if;
  return public.msg_role() = 'admin' and public.msg_is_church_admin(t.church_id);
end $$;

-- ───────────────────────── device_check ─────────────────────────
-- Called by the app after every sign-in and on app start (online).
create or replace function public.device_check(p_device_id text default null)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  dev text := nullif(trim(coalesce(p_device_id, '')), '');
  cur auth.sessions;
  was_recorded boolean;
  known boolean;
  enforced boolean;
  lim integer;
  others integer;
  mem record;
  recent_alert boolean;
begin
  if uid is null or sid is null then
    return jsonb_build_object('ok', true, 'skipped', 'no_session');
  end if;
  if dev is not null and length(dev) not between 8 and 100 then dev := null; end if;

  select * into cur from auth.sessions where id = sid and user_id = uid;
  if cur.id is null then
    -- This session was revoked (signed out elsewhere / refused): tell the app.
    return jsonb_build_object('ok', false, 'reason', 'session_revoked');
  end if;

  was_recorded := exists (select 1 from public.device_sessions where session_id = sid);
  insert into public.device_sessions (session_id, user_id, device_id)
  values (sid, uid, dev)
  on conflict (session_id) do update
    set device_id = coalesce(excluded.device_id, public.device_sessions.device_id),
        last_check_at = now();
  -- The recorded id wins for the rest of this call.
  select coalesce(dev, device_id) into dev from public.device_sessions where session_id = sid;

  enforced := public.device_limit_enforced(uid);
  lim := public.device_limit_for(uid);

  if not enforced then
    return jsonb_build_object('ok', true, 'enforced', false, 'limit', lim,
                              'devices', public.device_count(uid));
  end if;

  -- Prune sessions unused for 30 days (refresh tokens cascade).
  delete from auth.sessions s
   where s.user_id = uid and s.id <> sid
     and public.device_session_last_used(s) <= now() - interval '30 days';
  delete from public.device_sessions ds
   where ds.user_id = uid and not exists (select 1 from auth.sessions s where s.id = ds.session_id);

  -- Is this device already known?
  known := was_recorded
        or (dev is not null and exists (
              select 1 from public.device_active_sessions(uid) a
              where a.session_id <> sid and a.device_id = dev))
        or exists (
              select 1 from public.device_active_sessions(uid) a
              where a.session_id <> sid and a.device_id is null
                and a.user_agent is not distinct from cur.user_agent
                and a.last_used < now() - interval '65 minutes');

  -- Known device: its older sessions are replaced by this one.
  delete from auth.sessions s
   using public.device_active_sessions(uid) a
   where s.id = a.session_id and a.session_id <> sid
     and ((dev is not null and a.device_id = dev)
          or (a.device_id is null and a.user_agent is not distinct from cur.user_agent
              and a.last_used < now() - interval '65 minutes'));
  delete from public.device_sessions ds
   where ds.user_id = uid and not exists (select 1 from auth.sessions s where s.id = ds.session_id);

  -- Other devices (legacy sessions with this device's user agent are treated as this device).
  select count(distinct a.device_key)::int into others
    from public.device_active_sessions(uid) a
   where a.session_id <> sid
     and a.device_key <> coalesce('id:' || dev, '')
     and not (a.device_id is null and a.user_agent is not distinct from cur.user_agent);

  if lim is null or known or others < lim then
    return jsonb_build_object('ok', true, 'enforced', true, 'limit', lim, 'devices', others + 1);
  end if;

  -- Refuse: revoke this new device's session and log it.
  delete from auth.sessions where id = sid;
  delete from public.device_sessions where session_id = sid;
  select * into mem from public.device_member_of(uid);
  recent_alert := exists (select 1 from public.device_limit_events e
                          where e.user_id = uid and e.alert and e.created_at > now() - interval '1 hour');
  insert into public.device_limit_events
    (kind, user_id, member_id, church_id, device_id, user_agent, ip, active_devices, device_limit, alert)
  values ('refused', uid, mem.member_id, mem.church_id, dev, cur.user_agent, cur.ip, others, lim, not recent_alert);

  return jsonb_build_object('ok', false, 'reason', 'device_limit', 'limit', lim, 'devices', others,
    'message', format('This account is already in use on %s devices. Sign out on one of them, or ask your choir admin.', lim));
end $$;

-- ───────────────────────── member self-service ─────────────────────────

create or replace function public.device_my_status()
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('devices', public.device_count(auth.uid()),
                            'limit', public.device_limit_for(auth.uid()),
                            'enforced', public.device_limit_enforced(auth.uid()))
  where auth.uid() is not null
$$;

create or replace function public.device_sign_out_others()
returns integer language plpgsql volatile security definer set search_path to '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  n integer;
  mem record;
begin
  if uid is null or sid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from auth.sessions where user_id = uid and id <> sid;
  get diagnostics n = row_count;
  delete from public.device_sessions ds
   where ds.user_id = uid and not exists (select 1 from auth.sessions s where s.id = ds.session_id);
  select * into mem from public.device_member_of(uid);
  insert into public.device_limit_events (kind, user_id, member_id, church_id, active_devices, actor_id)
  values ('sign_out_others', uid, mem.member_id, mem.church_id, n, uid);
  return n;
end $$;

-- ───────────────────────── admin ─────────────────────────

-- Accounts with device counts. Super admin: every church (or p_church_id).
-- Church admin: their own church only.
create or replace function public.device_overview(p_church_id uuid default null)
returns table (
  user_id uuid, member_id uuid, full_name text, email text, role text,
  church_id uuid, church_name text, devices integer, device_limit integer,
  override_max integer, override_exempt boolean, enforce_test boolean,
  last_sign_in timestamptz, refused_7d integer, last_refused timestamptz, can_manage boolean)
language plpgsql stable security definer set search_path to '' as $$
declare
  scope uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if public.msg_is_super() then
    scope := p_church_id;
  elsif public.msg_role() = 'admin' then
    scope := public.msg_church_id();
  else
    raise exception 'only admins can view devices' using errcode = '42501';
  end if;

  return query
  select u.id, m.id, trim(coalesce(m.first_name,'') || ' ' || coalesce(m.last_name,'')), m.email, m.role,
         m.church_id, c.name, public.device_count(u.id), public.device_limit_for(u.id),
         o.max_devices, coalesce(o.exempt, false), coalesce(o.enforce_test, false),
         u.last_sign_in_at,
         (select count(*)::int from public.device_limit_events e
           where e.user_id = u.id and e.kind = 'refused' and e.created_at > now() - interval '7 days'),
         (select max(e.created_at) from public.device_limit_events e
           where e.user_id = u.id and e.kind = 'refused'),
         public.device_can_manage(u.id)
  from public.members m
  join auth.users u on lower(u.email) = lower(m.email)
  left join public.churches c on c.id = m.church_id
  left join public.device_limit_overrides o on o.user_id = u.id
  where scope is null or m.church_id = scope;
end $$;

create or replace function public.device_events_for(p_user_id uuid)
returns setof public.device_limit_events
language plpgsql stable security definer set search_path to '' as $$
begin
  if not (public.msg_is_super() or public.device_can_manage(p_user_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select * from public.device_limit_events e
   where e.user_id = p_user_id order by e.created_at desc limit 100;
end $$;

create or replace function public.device_sign_out_all(p_user_id uuid)
returns integer language plpgsql volatile security definer set search_path to '' as $$
declare
  n integer;
  mem record;
begin
  if not public.device_can_manage(p_user_id) then
    raise exception 'you can''t sign out this account' using errcode = '42501', hint = 'not_allowed';
  end if;
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics n = row_count;
  delete from public.device_sessions where user_id = p_user_id;
  select * into mem from public.device_member_of(p_user_id);
  insert into public.device_limit_events (kind, user_id, member_id, church_id, active_devices, actor_id)
  values ('sign_out_all', p_user_id, mem.member_id, mem.church_id, n, auth.uid());
  return n;
end $$;

-- Super admin only: per-account override. p_max null + p_exempt false = default.
create or replace function public.device_set_override(
  p_user_id uuid, p_max integer, p_exempt boolean, p_enforce_test boolean default null)
returns void language plpgsql volatile security definer set search_path to '' as $$
begin
  if not public.msg_is_super() then
    raise exception 'only the super admin can change device limits' using errcode = '42501';
  end if;
  insert into public.device_limit_overrides (user_id, max_devices, exempt, enforce_test, updated_by, updated_at)
  values (p_user_id, p_max, coalesce(p_exempt, false), coalesce(p_enforce_test, false), auth.uid(), now())
  on conflict (user_id) do update set
    max_devices = excluded.max_devices,
    exempt = excluded.exempt,
    enforce_test = coalesce(p_enforce_test, public.device_limit_overrides.enforce_test),
    updated_by = excluded.updated_by,
    updated_at = now();
end $$;

-- Super admin dashboard: unseen alerts.
create or replace function public.device_alerts()
returns table (id bigint, created_at timestamptz, user_id uuid, full_name text, church_name text,
               active_devices integer, device_limit integer, user_agent text, seen boolean)
language plpgsql stable security definer set search_path to '' as $$
begin
  if not public.msg_is_super() then raise exception 'super admin only' using errcode = '42501'; end if;
  return query
  select e.id, e.created_at, e.user_id,
         coalesce(nullif(trim(coalesce(m.first_name,'') || ' ' || coalesce(m.last_name,'')), ''), u.email::text),
         c.name, e.active_devices, e.device_limit, e.user_agent, e.seen_at is not null
  from public.device_limit_events e
  left join auth.users u on u.id = e.user_id
  left join public.members m on m.id = e.member_id
  left join public.churches c on c.id = e.church_id
  where e.alert and e.created_at > now() - interval '30 days'
  order by e.created_at desc limit 50;
end $$;

create or replace function public.device_alerts_mark_seen()
returns integer language plpgsql volatile security definer set search_path to '' as $$
declare n integer;
begin
  if not public.msg_is_super() then raise exception 'super admin only' using errcode = '42501'; end if;
  update public.device_limit_events set seen_at = now() where alert and seen_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────────────────────── grants ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'device_session_last_used(auth.sessions)', 'device_member_of(uuid)', 'device_limit_for(uuid)',
    'device_limit_enforced(uuid)', 'device_active_sessions(uuid)', 'device_count(uuid)',
    'device_can_manage(uuid)', 'device_check(text)', 'device_my_status()', 'device_sign_out_others()',
    'device_overview(uuid)', 'device_events_for(uuid)', 'device_sign_out_all(uuid)',
    'device_set_override(uuid, integer, boolean, boolean)', 'device_alerts()', 'device_alerts_mark_seen()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
  end loop;
  -- Internal helpers: not callable by clients.
  foreach f in array array[
    'device_session_last_used(auth.sessions)', 'device_member_of(uuid)', 'device_limit_for(uuid)',
    'device_limit_enforced(uuid)', 'device_active_sessions(uuid)', 'device_count(uuid)', 'device_can_manage(uuid)']
  loop
    execute format('revoke all on function public.%s from authenticated', f);
  end loop;
  -- Client RPCs.
  foreach f in array array[
    'device_check(text)', 'device_my_status()', 'device_sign_out_others()', 'device_overview(uuid)',
    'device_events_for(uuid)', 'device_sign_out_all(uuid)',
    'device_set_override(uuid, integer, boolean, boolean)', 'device_alerts()', 'device_alerts_mark_seen()']
  loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- RLS lockdown (Supabase alert rls_disabled_in_public + silent equivalents).
--
-- Census 2026-09-29: 9 public tables had RLS DISABLED (churches,
-- church_song_status, 7 backup tables) and many more had permissive
-- true/true policies — incl. anon SELECT on members/users (PII) and
-- any-member UPDATE on members (self-promotion to admin).
--
-- Identity: auth.uid() != members.id for most users, so every rule resolves
-- the caller members-by-email through the msg_* helpers
-- (20260719000000_messaging_phase1_repair). Legacy rows that stored the auth
-- uid in member_id are still honoured where the app reads/writes them.
--
-- Service-role callers (api/*, edge functions, backups) bypass RLS.

-- ════════════════════════════════════════════════════════════════════════
-- Helpers (same shape as msg_*: STABLE SECURITY DEFINER, empty search_path)
-- ════════════════════════════════════════════════════════════════════════

-- Super admin, or an admin of the given church.
create or replace function public.msg_is_church_admin(cid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select public.msg_is_super()
      or (cid is not null and public.msg_role() = 'admin' and cid = public.msg_church_id())
$$;

create or replace function public.msg_event_church_id(eid uuid)
returns uuid language sql stable security definer set search_path to ''
as $$ select e.church_id from public.events e where e.id = eid $$;

-- Event is visible church-wide to the caller: global, or in the caller's church.
create or replace function public.msg_event_in_my_church(eid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select public.msg_is_super() or exists (
    select 1 from public.events e
    where e.id = eid
      and (coalesce(e.is_global, false) or e.church_id = public.msg_church_id())
  )
$$;

-- Caller may manage the event (and its songs): super admin, or a church
-- admin for a non-global event in their own church.
create or replace function public.msg_can_admin_event(eid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select public.msg_is_super() or exists (
    select 1 from public.events e
    where e.id = eid
      and not coalesce(e.is_global, false)
      and public.msg_is_church_admin(e.church_id)
  )
$$;

-- Church of a member id — accepts members.id or a legacy auth uid.
create or replace function public.msg_church_of_member(mid uuid)
returns uuid language sql stable security definer set search_path to ''
as $$
  select coalesce(
    (select m.church_id from public.members m where m.id = mid),
    (select m.church_id from public.members m
       join auth.users a on lower(a.email) = lower(m.email)
      where a.id = mid limit 1)
  )
$$;

-- Caller owns this member id (members.id or legacy auth uid).
create or replace function public.msg_is_me(mid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select mid is not null and (mid = public.msg_member_id() or mid = auth.uid()) $$;

-- Login-page branding without exposing members/churches to anon.
create or replace function public.login_branding(p_email text)
returns table (name text, short_name text, logo_url text)
language sql stable security definer set search_path to ''
as $$
  select c.name, c.short_name, c.logo_url
  from public.members m join public.churches c on c.id = m.church_id
  where lower(m.email) = lower(trim(p_email))
  limit 1
$$;
revoke all on function public.login_branding(text) from public;
grant execute on function public.login_branding(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Internal tables: service-role only
-- ════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array[
    'backup_metadata_20251029', 'backup_policies_20251029',
    'backup_profiles_20251029', 'backup_song_views_20251029',
    'backup_songs_20251029', 'backup_table_info_20251029',
    'pre_multitenant_backup_metadata',
    'working_state_events', 'working_state_metadata',
    'working_state_permissions', 'working_state_policies',
    'working_state_profiles', 'working_state_songs',
    'working_state_voice_parts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- churches — public read; super admin insert/delete; church admin updates own
-- ════════════════════════════════════════════════════════════════════════
alter table public.churches enable row level security;
drop policy if exists churches_select on public.churches;
create policy churches_select on public.churches for select using (true);
drop policy if exists churches_insert on public.churches;
create policy churches_insert on public.churches for insert to authenticated
  with check (public.msg_is_super());
drop policy if exists churches_update on public.churches;
create policy churches_update on public.churches for update to authenticated
  using (public.msg_is_church_admin(id)) with check (public.msg_is_church_admin(id));
drop policy if exists churches_delete on public.churches;
create policy churches_delete on public.churches for delete to authenticated
  using (public.msg_is_super());

-- ════════════════════════════════════════════════════════════════════════
-- church_song_status — church members read; church admin writes
-- ════════════════════════════════════════════════════════════════════════
alter table public.church_song_status enable row level security;
drop policy if exists css_select on public.church_song_status;
create policy css_select on public.church_song_status for select to authenticated
  using (public.msg_is_super() or church_id = public.msg_church_id());
drop policy if exists css_insert on public.church_song_status;
create policy css_insert on public.church_song_status for insert to authenticated
  with check (public.msg_is_church_admin(church_id));
drop policy if exists css_update on public.church_song_status;
create policy css_update on public.church_song_status for update to authenticated
  using (public.msg_is_church_admin(church_id)) with check (public.msg_is_church_admin(church_id));
drop policy if exists css_delete on public.church_song_status;
create policy css_delete on public.church_song_status for delete to authenticated
  using (public.msg_is_church_admin(church_id));

-- ════════════════════════════════════════════════════════════════════════
-- members — same-church read; church admin writes; self-update of own row
-- (privileged columns guarded by trigger). Anon read removed → login_branding.
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists "Admins can only manage own church members" on public.members;
drop policy if exists "Authenticated users can manage members" on public.members;
drop policy if exists "Allow anon to lookup email by member_id for login" on public.members;
drop policy if exists "Authenticated users can view all members" on public.members;

drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (public.msg_is_super() or church_id = public.msg_church_id()
         or lower(email) = lower(auth.email()));
drop policy if exists members_insert on public.members;
create policy members_insert on public.members for insert to authenticated
  with check (public.msg_is_church_admin(church_id));
drop policy if exists members_update on public.members;
create policy members_update on public.members for update to authenticated
  using (public.msg_is_church_admin(church_id) or id = public.msg_member_id())
  with check (public.msg_is_church_admin(church_id) or id = public.msg_member_id());
drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete to authenticated
  using (public.msg_is_church_admin(church_id));

create or replace function public.members_guard_privileged()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  -- Service role / direct SQL: no JWT subject, no restriction.
  if auth.uid() is null or public.msg_is_super() then
    return new;
  end if;
  -- Only super admins mint super admins.
  if new.role = 'super_admin'
     and (tg_op = 'INSERT' or old.role is distinct from 'super_admin') then
    raise exception 'only a super admin can grant super_admin' using errcode = '42501';
  end if;
  -- Non-admins editing their own row: profile fields only.
  if tg_op = 'UPDATE' and not public.msg_is_church_admin(old.church_id) then
    if new.role is distinct from old.role
       or new.church_id is distinct from old.church_id
       or lower(new.email) is distinct from lower(old.email)
       or new.status is distinct from old.status
       or new.member_id is distinct from old.member_id then
      raise exception 'members may not change role, church, email, status or member id'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists members_guard_privileged on public.members;
create trigger members_guard_privileged
  before insert or update on public.members
  for each row execute function public.members_guard_privileged();

-- ════════════════════════════════════════════════════════════════════════
-- users — own row; same-church admins; super admin. Anon read removed.
-- (No client write policies, as before: writes are service-role only.)
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists "Allow member_id lookup for login" on public.users;
drop policy if exists users_select_church_admin on public.users;
create policy users_select_church_admin on public.users for select to authenticated
  using (public.msg_is_church_admin(church_id));

-- ════════════════════════════════════════════════════════════════════════
-- events — church-scoped with visibility rules; admin writes own church;
-- global events are super-admin managed.
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists "Admins can do everything with events" on public.events;
drop policy if exists "Members can view events based on visibility" on public.events;
drop policy if exists "Members see own church events only" on public.events;

drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (
    public.msg_is_super()
    or coalesce(is_global, false)
    or (church_id = public.msg_church_id() and (
         public.msg_role() = 'admin'
         or visibility is null or visibility = 'all'
         or (visibility = 'voice_part' and exists (
               select 1 from unnest(allowed_voice_parts) v where lower(v) = public.msg_voice()))
         or (visibility = 'role' and public.msg_role() = any (allowed_roles))
         or (visibility = 'specific_users' and exists (
               select 1 from public.event_user_access eua
               where eua.event_id = events.id and eua.member_id = public.msg_member_id()))
    ))
  );
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (public.msg_is_super()
              or (not coalesce(is_global, false) and public.msg_is_church_admin(church_id)));
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.msg_is_super()
         or (not coalesce(is_global, false) and public.msg_is_church_admin(church_id)))
  with check (public.msg_is_super()
              or (not coalesce(is_global, false) and public.msg_is_church_admin(church_id)));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using (public.msg_is_super()
         or (not coalesce(is_global, false) and public.msg_is_church_admin(church_id)));

-- ════════════════════════════════════════════════════════════════════════
-- event_songs — read with the event's church; write = event admin
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists "Admins can manage event songs" on public.event_songs;
drop policy if exists "Authenticated users can manage event_songs" on public.event_songs;
drop policy if exists "Anyone can view event songs" on public.event_songs;
drop policy if exists "Everyone can read event_songs" on public.event_songs;

drop policy if exists event_songs_select on public.event_songs;
create policy event_songs_select on public.event_songs for select to authenticated
  using (public.msg_event_in_my_church(event_id));
drop policy if exists event_songs_insert on public.event_songs;
create policy event_songs_insert on public.event_songs for insert to authenticated
  with check (public.msg_can_admin_event(event_id));
drop policy if exists event_songs_update on public.event_songs;
create policy event_songs_update on public.event_songs for update to authenticated
  using (public.msg_can_admin_event(event_id)) with check (public.msg_can_admin_event(event_id));
drop policy if exists event_songs_delete on public.event_songs;
create policy event_songs_delete on public.event_songs for delete to authenticated
  using (public.msg_can_admin_event(event_id));

-- ════════════════════════════════════════════════════════════════════════
-- event_rsvps — read with the event's church; members write their own;
-- church admin manages their church's events.
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists "Allow authenticated RSVP writes" on public.event_rsvps;
drop policy if exists "Admins can delete event_rsvps" on public.event_rsvps;
drop policy if exists "Admins can read event_rsvps" on public.event_rsvps;
drop policy if exists "Members can view all RSVPs" on public.event_rsvps;

drop policy if exists event_rsvps_select on public.event_rsvps;
create policy event_rsvps_select on public.event_rsvps for select to authenticated
  using (public.msg_event_in_my_church(event_id));
drop policy if exists event_rsvps_insert on public.event_rsvps;
create policy event_rsvps_insert on public.event_rsvps for insert to authenticated
  with check ((public.msg_is_me(member_id) and public.msg_event_in_my_church(event_id))
              or public.msg_is_church_admin(public.msg_event_church_id(event_id)));
drop policy if exists event_rsvps_update on public.event_rsvps;
create policy event_rsvps_update on public.event_rsvps for update to authenticated
  using ((public.msg_is_me(member_id) and public.msg_event_in_my_church(event_id))
         or public.msg_is_church_admin(public.msg_event_church_id(event_id)))
  with check ((public.msg_is_me(member_id) and public.msg_event_in_my_church(event_id))
              or public.msg_is_church_admin(public.msg_event_church_id(event_id)));
drop policy if exists event_rsvps_delete on public.event_rsvps;
create policy event_rsvps_delete on public.event_rsvps for delete to authenticated
  using (public.msg_is_me(member_id)
         or public.msg_is_church_admin(public.msg_event_church_id(event_id)));

-- ════════════════════════════════════════════════════════════════════════
-- attendance_history — members read own; church admin reads/writes church.
-- 17 legacy rows have NULL church_id → fall back to the event's church.
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists "Admins can delete attendance history" on public.attendance_history;
drop policy if exists "Admins can insert attendance history" on public.attendance_history;
drop policy if exists "Anyone can view attendance history" on public.attendance_history;
drop policy if exists "Members can read own attendance" on public.attendance_history;
drop policy if exists "Admins can update attendance history" on public.attendance_history;

drop policy if exists attendance_select on public.attendance_history;
create policy attendance_select on public.attendance_history for select to authenticated
  using (public.msg_is_me(member_id)
         or public.msg_is_church_admin(coalesce(church_id, public.msg_event_church_id(event_id))));
drop policy if exists attendance_insert on public.attendance_history;
create policy attendance_insert on public.attendance_history for insert to authenticated
  with check (public.msg_is_church_admin(coalesce(church_id, public.msg_event_church_id(event_id))));
drop policy if exists attendance_update on public.attendance_history;
create policy attendance_update on public.attendance_history for update to authenticated
  using (public.msg_is_church_admin(coalesce(church_id, public.msg_event_church_id(event_id))))
  with check (public.msg_is_church_admin(coalesce(church_id, public.msg_event_church_id(event_id))));
drop policy if exists attendance_delete on public.attendance_history;
create policy attendance_delete on public.attendance_history for delete to authenticated
  using (public.msg_is_church_admin(coalesce(church_id, public.msg_event_church_id(event_id))));

-- ════════════════════════════════════════════════════════════════════════
-- song_submissions — member submits/reads own; church admin reviews.
-- (Old policies required member_id = auth.uid(); the app writes members.id.)
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists "Admins delete submissions" on public.song_submissions;
drop policy if exists "Members can insert own submissions" on public.song_submissions;
drop policy if exists "Members create submissions" on public.song_submissions;
drop policy if exists "Admins can view all submissions" on public.song_submissions;
drop policy if exists "Admins view all submissions" on public.song_submissions;
drop policy if exists "Members can view own submissions" on public.song_submissions;
drop policy if exists "Members view own submissions" on public.song_submissions;
drop policy if exists "Admins can update submissions" on public.song_submissions;
drop policy if exists "Admins update submissions" on public.song_submissions;

drop policy if exists submissions_select on public.song_submissions;
create policy submissions_select on public.song_submissions for select to authenticated
  using (public.msg_is_me(member_id)
         or public.msg_is_church_admin(public.msg_church_of_member(member_id)));
drop policy if exists submissions_insert on public.song_submissions;
create policy submissions_insert on public.song_submissions for insert to authenticated
  with check (public.msg_is_me(member_id));
drop policy if exists submissions_update on public.song_submissions;
create policy submissions_update on public.song_submissions for update to authenticated
  using (public.msg_is_church_admin(public.msg_church_of_member(member_id)))
  with check (public.msg_is_church_admin(public.msg_church_of_member(member_id)));
drop policy if exists submissions_delete on public.song_submissions;
create policy submissions_delete on public.song_submissions for delete to authenticated
  using (public.msg_is_church_admin(public.msg_church_of_member(member_id)));

-- ════════════════════════════════════════════════════════════════════════
-- Unused tables (0 rows, no code refs): super-admin only. Drop candidates.
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists practice_assignments_all on public.practice_assignments;
drop policy if exists practice_feedback_all on public.practice_feedback;
drop policy if exists practice_sessions_all on public.practice_sessions;
drop policy if exists "Members can delete their own favorites" on public.song_favorites;
drop policy if exists "Members can insert their own favorites" on public.song_favorites;
drop policy if exists "Members can view their own favorites" on public.song_favorites;
drop policy if exists "Members can update their own favorites" on public.song_favorites;
drop policy if exists "Users can manage own attendance" on public.event_attendances;
drop policy if exists "Anyone can view attendances" on public.event_attendances;
drop policy if exists "Authenticated users can update settings" on public.settings;
drop policy if exists "Everyone can read settings" on public.settings;

drop policy if exists super_only on public.practice_assignments;
create policy super_only on public.practice_assignments for all to authenticated
  using (public.msg_is_super()) with check (public.msg_is_super());
drop policy if exists super_only on public.practice_feedback;
create policy super_only on public.practice_feedback for all to authenticated
  using (public.msg_is_super()) with check (public.msg_is_super());
drop policy if exists super_only on public.song_favorites;
create policy super_only on public.song_favorites for all to authenticated
  using (public.msg_is_super()) with check (public.msg_is_super());
drop policy if exists super_only on public.event_attendances;
create policy super_only on public.event_attendances for all to authenticated
  using (public.msg_is_super()) with check (public.msg_is_super());
drop policy if exists super_only on public.settings;
create policy super_only on public.settings for all to authenticated
  using (public.msg_is_super()) with check (public.msg_is_super());
-- practice_sessions keeps its members-by-email owner policies.

-- voice_parts: public read (kept), super-admin write.
drop policy if exists enable_all_for_authenticated on public.voice_parts;
drop policy if exists voice_parts_super_write on public.voice_parts;
create policy voice_parts_super_write on public.voice_parts for all to authenticated
  using (public.msg_is_super()) with check (public.msg_is_super());

-- song_views: inserts must be attributed to the caller.
drop policy if exists anyone_can_record_views on public.song_views;
drop policy if exists song_views_insert_own on public.song_views;
create policy song_views_insert_own on public.song_views for insert to authenticated
  with check (user_id = auth.uid());

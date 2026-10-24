-- Church-targeted global events.
--
-- A global event with NO event_churches rows is visible to every church
-- (unchanged behaviour); with rows it is visible ONLY to those churches.
-- Non-global events are unaffected. Super admin sees everything.
--
-- Global rows keep church_id = the creating super admin's church, so the
-- same-church branch of events_select now applies to non-global events only —
-- otherwise the creator's church would see an event targeted away from it.
--
-- Idempotent: safe to re-run.

-- ════════════════════════════════════════════════════════════════════════
-- Junction table — super-admin only. Visibility checks read it through the
-- SECURITY DEFINER helper below, so no broad client read is needed.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.event_churches (
  event_id  uuid not null references public.events(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, church_id)
);
create index if not exists event_churches_church_id_idx on public.event_churches (church_id);

alter table public.event_churches enable row level security;
revoke all on public.event_churches from anon;
drop policy if exists event_churches_super on public.event_churches;
create policy event_churches_super on public.event_churches for all to authenticated
  using (public.msg_is_super()) with check (public.msg_is_super());

-- ════════════════════════════════════════════════════════════════════════
-- Helpers
-- ════════════════════════════════════════════════════════════════════════

-- Global event is targeted at the caller's church (or at all churches).
create or replace function public.msg_global_targets_me(eid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select not exists (select 1 from public.event_churches ec where ec.event_id = eid)
      or exists (select 1 from public.event_churches ec
                 where ec.event_id = eid and ec.church_id = public.msg_church_id())
$$;

-- Event is visible church-wide to the caller: a global event targeted at
-- their church (or untargeted), or a non-global event in their church.
create or replace function public.msg_event_in_my_church(eid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select public.msg_is_super() or exists (
    select 1 from public.events e
    where e.id = eid
      and case when coalesce(e.is_global, false)
               then public.msg_global_targets_me(e.id)
               else e.church_id = public.msg_church_id() end
  )
$$;

-- ════════════════════════════════════════════════════════════════════════
-- events SELECT — targeting for global events
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (
    public.msg_is_super()
    or (coalesce(is_global, false) and public.msg_global_targets_me(id))
    or (not coalesce(is_global, false) and church_id = public.msg_church_id() and (
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

-- ════════════════════════════════════════════════════════════════════════
-- attendance_history INSERT — also require the event to be visible to the
-- caller's church, so an excluded church can't record attendance for it.
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists attendance_insert on public.attendance_history;
create policy attendance_insert on public.attendance_history for insert to authenticated
  with check (public.msg_is_church_admin(coalesce(church_id, public.msg_event_church_id(event_id)))
              and public.msg_event_in_my_church(event_id));

-- ════════════════════════════════════════════════════════════════════════
-- event_rsvps writes — the admin branch keyed on the EVENT's church, which
-- for a global event is the creator's church: that church's admins could
-- manage every church's RSVPs on global events (even ones targeted away from
-- them). Now: admin of the RSVPing MEMBER's church, for an event visible to
-- them. Identical for local events (member and event share the church).
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists event_rsvps_insert on public.event_rsvps;
create policy event_rsvps_insert on public.event_rsvps for insert to authenticated
  with check (public.msg_event_in_my_church(event_id) and (
                public.msg_is_me(member_id)
                or public.msg_is_church_admin(public.msg_church_of_member(member_id))));
drop policy if exists event_rsvps_update on public.event_rsvps;
create policy event_rsvps_update on public.event_rsvps for update to authenticated
  using (public.msg_event_in_my_church(event_id) and (
           public.msg_is_me(member_id)
           or public.msg_is_church_admin(public.msg_church_of_member(member_id))))
  with check (public.msg_event_in_my_church(event_id) and (
                public.msg_is_me(member_id)
                or public.msg_is_church_admin(public.msg_church_of_member(member_id))));
drop policy if exists event_rsvps_delete on public.event_rsvps;
create policy event_rsvps_delete on public.event_rsvps for delete to authenticated
  using (public.msg_is_me(member_id)
         or public.msg_is_church_admin(public.msg_church_of_member(member_id)));

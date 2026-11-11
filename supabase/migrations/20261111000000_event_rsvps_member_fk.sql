-- event_rsvps: no more orphaned RSVPs.
--
-- 1. FK event_rsvps.member_id → members(id) ON DELETE CASCADE. There was no FK,
--    so deleting a member left their RSVPs behind: invisible in EventDetail
--    (no member to show) yet counted on the Events card, and undeletable by the
--    church admin's Reset (see 2). Two such rows (member 393c4c18-…) were
--    removed on 2026-11-11 after a backup; this migration refuses to run while
--    any orphan remains.
--
-- 2. DELETE policy: it keyed the admin branch only on the RSVPing MEMBER's
--    church (msg_church_of_member), which is NULL for a deleted member, so no
--    admin could delete an orphan and Reset silently deleted 0 rows. Add a
--    branch for LOCAL events keyed on the EVENT's church: a church admin can
--    clear every RSVP on their own church's event. Global events keep the
--    member-church rule from 20261024000000_global_event_targeting (an admin
--    manages only their own church's members' RSVPs there).
--
-- Idempotent: safe to re-run.

do $$
declare orphans int;
begin
  select count(*) into orphans
  from public.event_rsvps r
  where not exists (select 1 from public.members m where m.id = r.member_id);
  if orphans > 0 then
    raise exception 'event_rsvps has % orphaned row(s) (member_id not in members) — back up and remove them first', orphans;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_rsvps'::regclass and conname = 'event_rsvps_member_id_fkey'
  ) then
    alter table public.event_rsvps
      add constraint event_rsvps_member_id_fkey
      foreign key (member_id) references public.members(id) on delete cascade;
  end if;
end $$;

-- The cascade looks rows up by member_id; the existing unique index leads with event_id.
create index if not exists event_rsvps_member_id_idx on public.event_rsvps (member_id);

drop policy if exists event_rsvps_delete on public.event_rsvps;
create policy event_rsvps_delete on public.event_rsvps for delete to authenticated
  using (
    public.msg_is_me(member_id)
    or public.msg_is_church_admin(public.msg_church_of_member(member_id))
    or exists (
      select 1 from public.events e
      where e.id = event_rsvps.event_id
        and not coalesce(e.is_global, false)
        and public.msg_is_church_admin(e.church_id)
    )
  );

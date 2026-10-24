-- Setlists of targeted global events: church admins of a TARGETED church may
-- manage them.
--
-- Before: event_songs writes used msg_can_admin_event(), which grants global
-- events to the super admin only, so an admin of a church a global event is
-- targeted at could see its setlist but not add to it ('Failed to add song').
--
-- Rule (agreed 2026-10-25):
--   • super admin: any event
--   • church admin: own church's non-global events (unchanged)
--   • church admin: a global event whose event_churches EXPLICITLY lists their
--     church. All-churches globals (no event_churches rows, e.g. the
--     Convention) stay super-admin-only: the setlist is shared by every
--     church, so no single church may rewrite it for all.
--   • members: never
-- INSERT, UPDATE and DELETE follow the same rule. msg_can_admin_event() is
-- left as is (it means "may manage the event itself").
--
-- Idempotent: safe to re-run.

create or replace function public.msg_can_edit_setlist(eid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select public.msg_is_super() or exists (
    select 1 from public.events e
    where e.id = eid
      and (
        (not coalesce(e.is_global, false) and public.msg_is_church_admin(e.church_id))
        or (coalesce(e.is_global, false)
            and public.msg_role() = 'admin'
            and exists (select 1 from public.event_churches ec
                        where ec.event_id = e.id and ec.church_id = public.msg_church_id()))
      )
  )
$$;

drop policy if exists event_songs_insert on public.event_songs;
create policy event_songs_insert on public.event_songs for insert to authenticated
  with check (public.msg_can_edit_setlist(event_id));
drop policy if exists event_songs_update on public.event_songs;
create policy event_songs_update on public.event_songs for update to authenticated
  using (public.msg_can_edit_setlist(event_id)) with check (public.msg_can_edit_setlist(event_id));
drop policy if exists event_songs_delete on public.event_songs;
create policy event_songs_delete on public.event_songs for delete to authenticated
  using (public.msg_can_edit_setlist(event_id));

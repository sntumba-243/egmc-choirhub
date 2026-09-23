-- Songs RLS: writes are super-admin ONLY (supersedes 20260923000000, which
-- allowed church admins too).
--
-- The repertoire is a global resource: Add/Edit/Delete render only for super
-- admins (DESIGN_GROUND_TRUTH.md). Church admins keep read access plus their
-- per-church learning status (church_song_status) and favorites
-- (user_favorites) — separate tables, unaffected here.
--
-- msg_is_super() resolves users.is_super_admin by auth.uid(), or
-- members.role = 'super_admin' matched by email.

drop policy if exists "songs_admin_insert" on public.songs;
drop policy if exists "songs_admin_update" on public.songs;
drop policy if exists "songs_admin_delete" on public.songs;
drop policy if exists "songs_super_admin_insert" on public.songs;
drop policy if exists "songs_super_admin_update" on public.songs;
drop policy if exists "songs_super_admin_delete" on public.songs;

-- SELECT stays as-is: "enable_read_access_for_all" (public, using true).

create policy "songs_super_admin_insert" on public.songs
  for insert to authenticated
  with check (public.msg_is_super());

create policy "songs_super_admin_update" on public.songs
  for update to authenticated
  using (public.msg_is_super())
  with check (public.msg_is_super());

create policy "songs_super_admin_delete" on public.songs
  for delete to authenticated
  using (public.msg_is_super());

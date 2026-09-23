-- Songs RLS: public read, writes restricted to admins + super admins.
--
-- Previously `enable_all_for_authenticated` (ALL, using true / with check true)
-- let ANY signed-in member insert/update/delete any song — the app only hid
-- the buttons. Same class of hole closed on messages in Phase 1.
--
-- Role checks reuse the msg_* helpers (20260719000000_messaging_phase1_repair):
-- they resolve identity members-by-email, since auth.uid() != members.id for
-- a large share of users.

drop policy if exists "enable_all_for_authenticated" on public.songs;
drop policy if exists "songs_admin_insert" on public.songs;
drop policy if exists "songs_admin_update" on public.songs;
drop policy if exists "songs_admin_delete" on public.songs;

-- SELECT stays as-is: "enable_read_access_for_all" (public, using true).

create policy "songs_admin_insert" on public.songs
  for insert to authenticated
  with check (public.msg_is_super() or public.msg_role() in ('admin', 'super_admin'));

create policy "songs_admin_update" on public.songs
  for update to authenticated
  using (public.msg_is_super() or public.msg_role() in ('admin', 'super_admin'))
  with check (public.msg_is_super() or public.msg_role() in ('admin', 'super_admin'));

create policy "songs_admin_delete" on public.songs
  for delete to authenticated
  using (public.msg_is_super() or public.msg_role() in ('admin', 'super_admin'));

-- One-off data repair: 'Marchons freres, bon courage' pointed at a storage
-- object that doesn't exist (underscored name). Repoint to the re-uploaded
-- file. Guarded on the old URL so re-running is a no-op.
update public.songs
set sheet_music_url = 'https://lpcepycxqfqzwwszmpks.supabase.co/storage/v1/object/public/choirhub_partitions/Marchons%20freres,%20bon%20courage.pdf'
where id = '8b2086a2-b20f-4862-8b50-8c9c8bdcf28f'
  and sheet_music_url = 'https://lpcepycxqfqzwwszmpks.supabase.co/storage/v1/object/public/choirhub_partitions/Marchons_freres,_bon_courage.pdf';

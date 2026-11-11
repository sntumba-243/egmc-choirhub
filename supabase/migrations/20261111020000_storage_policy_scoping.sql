-- Storage: replace the two unscoped dashboard policies with bucket-scoped ones.
--
-- "Authenticated upload xmxyi1_0"  INSERT  authenticated  WITH CHECK (true)
--     → ANY signed-in login (incl. logins whose member row was deleted) could
--       upload into ANY bucket, including the public sheet-music bucket.
-- "Public read xmxyi1_0"           SELECT  anon           USING (true)
--     → anyone with the public anon key could list/download objects in EVERY
--       bucket via the API, including the private song-recordings bucket.
--
-- 53 of 91 members have members.id ≠ their auth uid, and the app names upload
-- folders by members.id. The old own-folder policies compared against
-- auth.uid() only, so those members' avatar uploads worked ONLY through the
-- blanket xmxyi1_0 insert. "Mine" below therefore accepts either id.
--
-- NOT changed here (would break playback): the `recordings` bucket stays
-- PUBLIC. The app plays recordings via getPublicUrl(), and public-bucket URLs
-- bypass RLS, so the SELECT policy below only restricts API list/download.
-- Making recordings truly owner/admin-only needs a private bucket + signed URLs.
--
-- Idempotent: safe to re-run.

-- helper: is the first folder of this object path the caller (auth uid or member id)?
create or replace function public.storage_is_my_folder(object_name text)
returns boolean language sql stable security definer set search_path to ''
as $$
  select (storage.foldername(object_name))[1] in (auth.uid()::text, public.msg_member_id()::text)
$$;
revoke all on function public.storage_is_my_folder(text) from public, anon;
grant execute on function public.storage_is_my_folder(text) to authenticated;

-- ── 1. the two unscoped policies ──
drop policy if exists "Authenticated upload xmxyi1_0" on storage.objects;
drop policy if exists "Public read xmxyi1_0" on storage.objects;

-- ── 2. choirhub_partitions (sheet music): public bucket → public read via URL;
--      writes super admin only (bulk uploads use the service role, unaffected).
drop policy if exists partitions_super_insert on storage.objects;
drop policy if exists partitions_super_update on storage.objects;
drop policy if exists partitions_super_delete on storage.objects;
create policy partitions_super_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'choirhub_partitions' and public.msg_is_super());
create policy partitions_super_update on storage.objects for update to authenticated
  using (bucket_id = 'choirhub_partitions' and public.msg_is_super())
  with check (bucket_id = 'choirhub_partitions' and public.msg_is_super());
create policy partitions_super_delete on storage.objects for delete to authenticated
  using (bucket_id = 'choirhub_partitions' and public.msg_is_super());

-- ── 3. recordings: uploads by the owner into their own folder
--      (SongRecorder: <memberId>/<songId>/…), and by admins into the
--      feedback/ and reference/ folders (Submissions, VocalCoachAssignments).
--      API reads (list/download) owner + admins only; playback uses public URLs.
drop policy if exists "Users can upload recordings" on storage.objects;
drop policy if exists "Recordings are publicly viewable" on storage.objects;
drop policy if exists recordings_insert on storage.objects;
drop policy if exists recordings_select on storage.objects;
create policy recordings_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and (
    public.storage_is_my_folder(name)
    or ((storage.foldername(name))[1] in ('feedback', 'reference')
        and (public.msg_is_super() or public.msg_role() = 'admin'))
  ));
create policy recordings_select on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and (
    public.storage_is_my_folder(name) or public.msg_is_super() or public.msg_role() = 'admin'
  ));

-- ── 4. avatars: own folder by EITHER id (public read unchanged).
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.storage_is_my_folder(name));
create policy "Users can update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.storage_is_my_folder(name))
  with check (bucket_id = 'avatars' and public.storage_is_my_folder(name));
create policy "Users can delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.storage_is_my_folder(name));

-- ── 5. church-assets (logos): was any authenticated user, any path.
--      Now super admin anywhere (ChurchForm: church-logos/<id|new-…>/), or a
--      church admin under church-logos/<their church id>/ (ChurchThemeSettings).
drop policy if exists "Auth upload church-assets" on storage.objects;
drop policy if exists "Auth update church-assets" on storage.objects;
create policy "Auth upload church-assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'church-assets' and (
    public.msg_is_super()
    or ((storage.foldername(name))[1] = 'church-logos'
        and (storage.foldername(name))[2] = public.msg_church_id()::text
        and public.msg_role() = 'admin')
  ));
create policy "Auth update church-assets" on storage.objects for update to authenticated
  using (bucket_id = 'church-assets' and (
    public.msg_is_super()
    or ((storage.foldername(name))[1] = 'church-logos'
        and (storage.foldername(name))[2] = public.msg_church_id()::text
        and public.msg_role() = 'admin')
  ))
  with check (bucket_id = 'church-assets' and (
    public.msg_is_super()
    or ((storage.foldername(name))[1] = 'church-logos'
        and (storage.foldername(name))[2] = public.msg_church_id()::text
        and public.msg_role() = 'admin')
  ));

-- Unused buckets (Egmc, Partitions, audio-files, song-recordings,
-- vocal-recordings): no app writes; with xmxyi1_0 gone, only the service role
-- (and their existing own-folder policies) can write. Public-bucket URLs unchanged.

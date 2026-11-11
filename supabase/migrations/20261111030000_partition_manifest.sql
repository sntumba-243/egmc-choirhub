-- partition_manifest(): the sheet-music bucket's file list in ONE call, so the
-- app can keep its offline copies current without one request per song.
--
-- Songs are usually fixed by replacing the PDF in the bucket under the SAME
-- name, without touching the songs row — the app's cache key (URL + songs
-- .updated_at) doesn't change, so only the object's etag reveals the new
-- version. The device stores the etag next to each saved PDF and, on each app
-- open while online, re-downloads only files whose etag differs (or are new).
--
-- Read-only; signed-in users only (the bucket itself is public, so this
-- exposes nothing new: names, etags and timestamps of public files).
-- Idempotent: safe to re-run.

create or replace function public.partition_manifest()
returns table (name text, etag text, updated_at timestamptz)
language sql
stable
security definer
set search_path to ''
as $$
  select o.name, o.metadata->>'eTag', o.updated_at
  from storage.objects o
  where o.bucket_id = 'choirhub_partitions'
    and o.name not like '%/.emptyFolderPlaceholder'
    and o.name <> '.emptyFolderPlaceholder'
$$;

revoke all on function public.partition_manifest() from public, anon;
grant execute on function public.partition_manifest() to authenticated;

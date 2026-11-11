-- Member-delete audit follow-ups (see 20261111000000_event_rsvps_member_fk).
--
-- 1. song_submissions.reviewed_by → members(id) was NO ACTION, so deleting a
--    member who ever reviewed a submission FAILED. Now ON DELETE SET NULL: the
--    submission stays, it just loses its reviewer.
-- 2. exercise_assignments.member_id had no FK, so a deleted member's
--    assignments were left behind. Now → members(id) ON DELETE CASCADE. The
--    app writes members.id here (admin VocalCoachAssignments picks from the
--    members list; member reads filter on user.id = members.id). Refuses to
--    run while orphans exist and names them.
--
-- Idempotent: safe to re-run.

do $$
declare
  orphans int;
  sample text;
begin
  -- 1. reviewed_by: recreate only if not already SET NULL
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.song_submissions'::regclass
      and conname = 'song_submissions_reviewed_by_fkey'
      and confdeltype <> 'n'
  ) then
    alter table public.song_submissions drop constraint song_submissions_reviewed_by_fkey;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.song_submissions'::regclass and conname = 'song_submissions_reviewed_by_fkey'
  ) then
    alter table public.song_submissions
      add constraint song_submissions_reviewed_by_fkey
      foreign key (reviewed_by) references public.members(id) on delete set null;
  end if;

  -- 2. exercise_assignments.member_id
  select count(*), string_agg(a.id::text || ' (member ' || a.member_id::text || ')', ', ')
    into orphans, sample
  from (select id, member_id from public.exercise_assignments a
        where not exists (select 1 from public.members m where m.id = a.member_id)
        limit 20) a;
  if orphans > 0 then
    raise exception 'exercise_assignments has orphaned row(s) (member_id not in members): % — back up and resolve first', sample;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.exercise_assignments'::regclass and conname = 'exercise_assignments_member_id_fkey'
  ) then
    alter table public.exercise_assignments
      add constraint exercise_assignments_member_id_fkey
      foreign key (member_id) references public.members(id) on delete cascade;
  end if;
end $$;

create index if not exists exercise_assignments_member_id_idx on public.exercise_assignments (member_id);
create index if not exists song_submissions_reviewed_by_idx on public.song_submissions (reviewed_by);

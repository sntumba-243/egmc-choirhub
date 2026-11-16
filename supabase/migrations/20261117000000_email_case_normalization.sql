-- Email letter case: one canonical form everywhere.
--
-- Supabase Auth stores login emails lowercase, but members.email / users.email
-- kept whatever was typed ("Emmatshiband@gmail.com"). Lookups that compared
-- exactly (the app's sign-in lookup, several older RLS policies) then found
-- nothing: the password was accepted but the app never loaded the account
-- (Indianapolis Christian Tabernacle, 2026-11-16).
--
-- 1. Trigger: members.email and users.email are trimmed + lowercased on every
--    insert/update, whatever the client sends.
-- 2. Existing rows lowercased (aborts if two accounts would collide).
-- 3. Older policies that compared members.email = auth.email() exactly now use
--    the msg_* helpers (case-insensitive, same meaning).
-- 4. login_id_for_member(): the login (auth) id for a member row, for admins of
--    that member's church and super admins — so "Generate new password" no
--    longer looks people up by exact email.
--
-- Idempotent: safe to run more than once.

-- ── 1. Normalize on write ──
create or replace function public.normalize_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_email on public.members;
create trigger normalize_email
  before insert or update of email on public.members
  for each row execute function public.normalize_email();

drop trigger if exists normalize_email on public.users;
create trigger normalize_email
  before insert or update of email on public.users
  for each row execute function public.normalize_email();

-- ── 2. Existing rows ──
do $$
begin
  if exists (select 1 from public.members group by lower(btrim(email)) having count(*) > 1) then
    raise exception 'members: two rows share an email once lowercased — resolve by hand first';
  end if;
  if exists (select 1 from public.users group by lower(btrim(email)) having count(*) > 1) then
    raise exception 'users: two rows share an email once lowercased — resolve by hand first';
  end if;
end;
$$;

update public.members set email = lower(btrim(email)) where email <> lower(btrim(email));
-- (sync_auth_email_trigger copies users.email to auth.users.email; the logins
-- are already lowercase, so the login email itself does not change.)
update public.users set email = lower(btrim(email)) where email <> lower(btrim(email));

-- ── 3. Policies: msg_* helpers instead of members.email = auth.email() ──
-- msg_member_id() / msg_role() resolve the caller's member row by
-- lower(members.email) = lower(login email). Same meaning as before, case-insensitive.
alter policy "Admin full access to event_user_access" on public.event_user_access
  using (public.msg_role() = 'admin');
alter policy "Users can view their own event access" on public.event_user_access
  using (member_id = public.msg_member_id());

alter policy "Admins view all assignments" on public.exercise_assignments
  using (public.msg_role() = 'admin');
alter policy "Admins create assignments" on public.exercise_assignments
  with check (public.msg_role() = 'admin');
alter policy "Admins update assignments" on public.exercise_assignments
  using (public.msg_role() = 'admin');
alter policy "Admins can delete assignments" on public.exercise_assignments
  using (public.msg_role() = 'admin');

alter policy "Admins view all attempts" on public.exercise_attempts
  using (public.msg_role() = 'admin');
alter policy "Admins view all profiles" on public.member_vocal_profile
  using (public.msg_role() = 'admin');
alter policy "Admins view all exercises" on public.smart_coach_exercises
  using (public.msg_role() = 'admin');

alter policy "Users can manage their own practice sessions" on public.practice_sessions
  using (member_id = public.msg_member_id());
alter policy "Users can view their own practice sessions" on public.practice_sessions
  using (member_id = public.msg_member_id());

alter policy "Admins view all recordings" on storage.objects
  using (bucket_id = 'song-recordings' and public.msg_role() = 'admin');
alter policy "Admins delete recordings" on storage.objects
  using (bucket_id = 'song-recordings' and public.msg_role() = 'admin');

-- ── 4. Login id for a member row ──
create or replace function public.login_id_for_member(p_member uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id
  from public.members m
  join auth.users a on lower(a.email) = lower(m.email)
  where m.id = p_member
    and (public.msg_is_super()
         or (public.msg_role() = 'admin' and m.church_id = public.msg_church_id()))
  limit 1
$$;

revoke all on function public.login_id_for_member(uuid) from public, anon;
grant execute on function public.login_id_for_member(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Super admin guard — church admins can never delete, edit, demote,
-- deactivate, move or re-point a super admin's account.
--
-- Hole this closes (confirmed 2026-11-25 with rolled-back transactions as a
-- real EGMC admin): the members DELETE/UPDATE policies allow any row in the
-- admin's own church, and the super admin's member row is in EGMC. An admin
-- could DELETE it, set role 'member', set status 'inactive', or change its
-- email. The email change is also an escalation path: msg_is_super() treats
-- whoever's login email matches a role='super_admin' member row as super
-- admin, so re-pointing that row at a second login hands over super admin.
--
-- Rule (enforced in BEFORE triggers, so no screen, API call or policy can
-- bypass it for a signed-in user):
--   • Only a super admin may UPDATE or DELETE a members/users row that belongs
--     to a super admin (members.role = 'super_admin', users.is_super_admin, or
--     a row whose email/id is a super admin's login).
--   • Only a super admin may give any members/users row a super admin's login
--     email (no taking over the super admin's identity).
--   • Only a super admin may set users.is_super_admin / role 'super_admin'
--     (members already had this rule).
-- Service role / direct SQL (auth.uid() is null) is unchanged: edge functions
-- carry their own checks (see create-member, reset-password).
--
-- Idempotent: CREATE OR REPLACE functions, DROP TRIGGER IF EXISTS + CREATE.
-- Backup taken before applying: schema backup_20261125_super_guard.

-- Is this identity (member role / email / id) a super admin?
create or replace function public.is_super_admin_identity(p_role text, p_email text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(p_role = 'super_admin', false)
      or exists (
        select 1 from public.users u
        where u.is_super_admin
          and (u.id = p_id or (p_email is not null and lower(u.email) = lower(p_email))))
      or exists (
        select 1 from auth.users a
        join public.users u on u.id = a.id
        where u.is_super_admin and p_email is not null and lower(a.email) = lower(p_email))
      or exists (
        select 1 from public.members m
        where m.role = 'super_admin' and p_email is not null and lower(m.email) = lower(p_email)
          and (p_id is null or m.id <> p_id))
$$;

revoke all on function public.is_super_admin_identity(text, text, uuid) from public, anon;
grant execute on function public.is_super_admin_identity(text, text, uuid) to authenticated, service_role;

create or replace function public.members_guard_privileged()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- Service role / direct SQL: no JWT subject, no restriction. Super admins: anything.
  if auth.uid() is null or public.msg_is_super() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Nobody but a super admin touches a super admin's row.
  if tg_op in ('UPDATE', 'DELETE')
     and public.is_super_admin_identity(old.role, old.email, old.id) then
    raise exception 'only a super admin can change or delete a super admin'
      using errcode = '42501', hint = 'target_is_super_admin';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- No row may take over a super admin's login email.
  if (tg_op = 'INSERT' or lower(new.email) is distinct from lower(old.email))
     and public.is_super_admin_identity(null, new.email, null) then
    raise exception 'that email belongs to a super admin'
      using errcode = '42501', hint = 'target_is_super_admin';
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
end $function$;

drop trigger if exists members_guard_privileged on public.members;
create trigger members_guard_privileged
  before insert or update or delete on public.members
  for each row execute function public.members_guard_privileged();

create or replace function public.users_guard_privileged()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or public.msg_is_super() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op in ('UPDATE', 'DELETE')
     and (coalesce(old.is_super_admin, false)
          or public.is_super_admin_identity(old.role, old.email, old.id)) then
    raise exception 'only a super admin can change or delete a super admin'
      using errcode = '42501', hint = 'target_is_super_admin';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if coalesce(new.is_super_admin, false)
     and (tg_op = 'INSERT' or not coalesce(old.is_super_admin, false)) then
    raise exception 'only a super admin can grant super admin' using errcode = '42501';
  end if;
  if new.role = 'super_admin'
     and (tg_op = 'INSERT' or old.role is distinct from 'super_admin') then
    raise exception 'only a super admin can grant super_admin' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' or lower(new.email) is distinct from lower(old.email))
     and public.is_super_admin_identity(null, new.email, new.id) then
    raise exception 'that email belongs to a super admin'
      using errcode = '42501', hint = 'target_is_super_admin';
  end if;
  return new;
end $function$;

drop trigger if exists users_guard_privileged on public.users;
create trigger users_guard_privileged
  before insert or update or delete on public.users
  for each row execute function public.users_guard_privileged();

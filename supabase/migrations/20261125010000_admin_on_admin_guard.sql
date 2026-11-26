-- Admin-on-admin guard. Builds on 20261125000000_super_admin_guard.
--
-- Before this, a church admin could delete, demote, deactivate or re-email
-- ANOTHER admin of the same church (confirmed 2026-11-25, rolled back), and
-- could make anyone an admin. Now, for a signed-in caller who is not a super
-- admin:
--   • another admin's members row (role 'admin', not the caller's own row):
--     no DELETE, and no change to role, status, email, church or member id.
--     Profile fields (name, phone, voice part, …) stay editable.
--   • nobody may grant the admin role (INSERT as admin, or promote to admin).
--     Only a super admin can create or promote admins.
--   • public.users mirrors this (no client policy allows writes there today;
--     this is defence in depth).
-- Super admin rules from the previous migration are unchanged. Service role /
-- direct SQL (auth.uid() is null) is unchanged: create-member and
-- reset-password carry the same checks.
--
-- Idempotent: CREATE OR REPLACE functions; triggers already exist from the
-- previous migration and are recreated with DROP IF EXISTS + CREATE.

create or replace function public.members_guard_privileged()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  other_admin boolean;
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

  -- Another admin's row (not the caller's own).
  other_admin := tg_op in ('UPDATE', 'DELETE')
    and old.role = 'admin'
    and old.id is distinct from public.msg_member_id();

  if tg_op = 'DELETE' then
    if other_admin then
      raise exception 'only a super admin can remove an admin'
        using errcode = '42501', hint = 'target_is_admin';
    end if;
    return old;
  end if;

  if other_admin and (
       new.role is distinct from old.role
       or new.status is distinct from old.status
       or lower(new.email) is distinct from lower(old.email)
       or new.church_id is distinct from old.church_id
       or new.member_id is distinct from old.member_id) then
    raise exception 'only a super admin can change another admin''s role, status, email or church'
      using errcode = '42501', hint = 'target_is_admin';
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

  -- Only super admins create or promote admins.
  if new.role = 'admin'
     and (tg_op = 'INSERT' or old.role is distinct from 'admin') then
    raise exception 'only a super admin can grant the admin role'
      using errcode = '42501', hint = 'grant_admin';
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

  if tg_op in ('UPDATE', 'DELETE') and old.role = 'admin' and old.id is distinct from auth.uid() then
    if tg_op = 'DELETE'
       or new.role is distinct from old.role
       or new.status is distinct from old.status
       or lower(new.email) is distinct from lower(old.email)
       or new.church_id is distinct from old.church_id then
      raise exception 'only a super admin can change or remove another admin'
        using errcode = '42501', hint = 'target_is_admin';
    end if;
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
  if new.role = 'admin'
     and (tg_op = 'INSERT' or old.role is distinct from 'admin') then
    raise exception 'only a super admin can grant the admin role'
      using errcode = '42501', hint = 'grant_admin';
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

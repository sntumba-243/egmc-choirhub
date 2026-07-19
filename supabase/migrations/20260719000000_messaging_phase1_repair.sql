-- ============================================================================
-- Messaging Phase 1 repair — schema capture + clean RLS
-- Idempotent & non-destructive. Safe to run and re-run.
--
-- Context (see MESSAGING_STATE.md): the live `messages` table drifted from its
-- original migration (6 columns added by hand, send_to CHECK dropped, a pile of
-- overlapping RLS policies that resolved to SELECT/INSERT `true` = cross-tenant
-- leak). This migration records the TRUE production schema and replaces the RLS
-- with a clean, church-scoped set.
--
-- Identity note: the app resolves a signed-in user via the `members` table
-- joined by EMAIL (see AuthContext), NOT by auth.uid(). Only 39/90 members have
-- members.id = auth.uid(). But users.church_id == members.church_id for all 90.
-- So RLS resolves church/role/voice from `members` (email-linked) to match the
-- app exactly, while sender_id / read_messages.user_id use auth.uid() (their FKs
-- point at auth.users). Individual message targeting uses members.id (== the
-- app's user.id), resolved via msg_member_id().
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. SCHEMA CAPTURE: record the real production `messages` columns so a fresh
--    `supabase db reset` reproduces prod. All add-if-not-exists (no-ops in prod).
-- ----------------------------------------------------------------------------
alter table public.messages add column if not exists recipients     text default 'all';
alter table public.messages add column if not exists content        text;
alter table public.messages add column if not exists sender_id      uuid;
alter table public.messages add column if not exists recipient_type text default 'all';
alter table public.messages add column if not exists priority       text default 'normal';
alter table public.messages add column if not exists church_id      uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_priority_check') then
    alter table public.messages add constraint messages_priority_check
      check (priority in ('normal','high','urgent'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_sender_id_fkey') then
    alter table public.messages add constraint messages_sender_id_fkey
      foreign key (sender_id) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_church_id_fkey') then
    alter table public.messages add constraint messages_church_id_fkey
      foreign key (church_id) references public.churches(id);
  end if;
  -- church_id is NOT NULL in prod; enforce only if no null rows exist (safe).
  if not exists (select 1 from public.messages where church_id is null) then
    begin
      alter table public.messages alter column church_id set not null;
    exception when others then null;
    end;
  end if;
end $$;

create index if not exists idx_messages_church    on public.messages (church_id);
create index if not exists idx_messages_sent_by   on public.messages (sent_by);
create index if not exists idx_messages_sent_date on public.messages (sent_date desc);
create index if not exists idx_messages_sender_id on public.messages (sender_id); -- NEW: was missing

alter table public.messages enable row level security;

-- ----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS (STABLE SECURITY DEFINER — bypass RLS on members/users,
--    hardened search_path, fully-qualified refs). Resolve the current signed-in
--    user's church / role / voice / member-id via the email link the app uses.
-- ----------------------------------------------------------------------------
create or replace function public.msg_church_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.church_id from public.members m
  join auth.users a on lower(a.email) = lower(m.email)
  where a.id = auth.uid()
  limit 1
$$;

create or replace function public.msg_member_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.members m
  join auth.users a on lower(a.email) = lower(m.email)
  where a.id = auth.uid()
  limit 1
$$;

create or replace function public.msg_role()
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.members m
  join auth.users a on lower(a.email) = lower(m.email)
  where a.id = auth.uid()
  limit 1
$$;

create or replace function public.msg_voice()
returns text language sql stable security definer set search_path = '' as $$
  select lower(m.voice_part) from public.members m
  join auth.users a on lower(a.email) = lower(m.email)
  where a.id = auth.uid()
  limit 1
$$;

create or replace function public.msg_is_super()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.is_super_admin from public.users u where u.id = auth.uid()), false)
      or coalesce((select m.role = 'super_admin' from public.members m
                   join auth.users a on lower(a.email) = lower(m.email)
                   where a.id = auth.uid() limit 1), false)
$$;

-- ----------------------------------------------------------------------------
-- 3. DROP every existing policy on public.messages (the overlapping pile-up).
-- ----------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'messages'
  loop
    execute format('drop policy if exists %I on public.messages', pol.policyname);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. CLEAN POLICY SET (church-scoped; the ONLY three that should exist).
-- ----------------------------------------------------------------------------

-- SELECT: super_admin sees all; otherwise same-church AND (admin sees all church
-- messages | member sees 'all', their voice part, individually-targeted rows, or
-- 'admin' rows they authored).
create policy messages_select on public.messages
for select to authenticated
using (
  public.msg_is_super()
  or (
    church_id = public.msg_church_id()
    and (
      public.msg_role() = 'admin'
      or send_to = 'all'
      or send_to = public.msg_voice()
      or send_to = public.msg_member_id()::text
      or (send_to = 'admin' and sender_id = auth.uid())
    )
  )
);

-- INSERT: sender must belong to the church they insert into. Admins broadcast
-- anything within their church; members may ONLY create send_to='admin' rows
-- authored by themselves. super_admin unrestricted.
create policy messages_insert on public.messages
for insert to authenticated
with check (
  public.msg_is_super()
  or (
    church_id = public.msg_church_id()
    and (
      public.msg_role() = 'admin'
      or (send_to = 'admin' and sender_id = auth.uid())
    )
  )
);

-- DELETE: admins delete within their church; super_admin any. (Preserves the
-- wired admin "Delete message" action.)
create policy messages_delete on public.messages
for delete to authenticated
using (
  public.msg_is_super()
  or (church_id = public.msg_church_id() and public.msg_role() = 'admin')
);

-- No UPDATE policy: nothing updates `messages` after this repair (read-state
-- lives in read_messages), so updates are denied by default.

-- ----------------------------------------------------------------------------
-- 5. read_messages is the single read-tracking mechanism. Ensure it is sound.
--    (Table/indexes already exist in prod; these are no-ops there.)
-- ----------------------------------------------------------------------------
alter table public.read_messages enable row level security;
create unique index if not exists read_messages_message_id_user_id_key
  on public.read_messages (message_id, user_id);
create index if not exists idx_read_messages_user_id on public.read_messages (user_id);

commit;

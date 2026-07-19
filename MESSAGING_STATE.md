# Messaging System — State of the World

**Date:** 2026-07-19 · **Mode:** read-only reconnaissance (no code or data changed).
**Method:** live DB probed with `service_role` (row counts, columns, samples) **and via the session pooler with `pg`** (RLS, indexes, constraints, triggers, Realtime — all VERIFIED, not inferred); all 7 UI files + edge function + migrations read in full; every write path cross-checked against the *actual* live schema.

> **Headline:** The messaging feature is **substantially broken in production right now.**
> 1. The wired code writes/reads `messages.is_read` and `messages.admin_id`, **columns that don't exist** (verified `42703`). This breaks admin broadcast send, member compose send, member mark-as-read, and both dashboards' unread counts.
> 2. `messages.church_id` is **`NOT NULL` with no default/trigger**, but the member reply/compose inserts omit it — so **all member→admin sends also fail** today. (The 2 existing member rows are legacy, from before the constraint.)
> 3. 🔴 **`messages` RLS provides no protection** — SELECT resolves to `USING true` and INSERT to `WITH CHECK true`, so **any authenticated user can read every church's messages and insert anything**. Tenant isolation is client-side only.
> 4. The live schema has **drifted far from `supabase/migrations/`** via manual dashboard edits (6 added columns, dropped `send_to` CHECK, a whole pile of RLS policies, `message_reads` table) that were never captured — a fresh `db reset` yields a *different* database.
>
> The only fully-working path is admin **read-tracking via `message_reads`**. A **fully-built, unused `direct_messages` table** already exists as an ideal foundation for the requested two-way threads.

---

## ✅ Phase 1 repair — APPLIED 2026-07-19 (branch `messaging-phase1`)

**Everything below this section documents the PRE-repair baseline (the recon snapshot).** Phase 1 has since been implemented on branch `messaging-phase1` (dry-run preview; not yet merged to `main`):

- **RLS rebuilt (leak closed).** The 8 overlapping `messages` policies were dropped and replaced with exactly three — `messages_select` / `messages_insert` / `messages_delete` — church-scoped via `STABLE SECURITY DEFINER` helpers (`msg_church_id`, `msg_role`, `msg_voice`, `msg_member_id`, `msg_is_super`) that resolve identity the way the app does (members-by-email). The `SELECT true` / `INSERT true` cross-tenant leak is closed; verified by simulated-session tests (cross-church member sees 0 rows; member cannot broadcast or spoof `sender_id`). **Applied live to production.**
- **Sends fixed.** Removed all phantom `is_read` / `admin_id` writes; every insert now sets `church_id` and the real `auth.uid()` as `sender_id` (new helper `src/lib/authUid.ts`). Covers admin broadcast, member compose, member reply, and the admin RSVP-reminder send.
- **One read mechanism.** Everything now uses `read_messages` (keyed by `auth.uid()`); no code writes `message_reads` anymore (the table is left in place but vestigial).
- **Schema captured.** `supabase/migrations/20260719000000_messaging_phase1_repair.sql` records the true production `messages` schema + the three policies (idempotent, non-destructive) — migrations now reproduce prod, incl. a new `idx_messages_sender_id`.
- **Dead code removed.** Deleted `member/Messages.tsx`, `admin/AdminMessages-MOBILE.tsx`, `member/MessageDetail.tsx`, `supabase/functions/send-message/`. `direct_messages` left untouched as the Phase 2 threads foundation.

**Identity model confirmed during repair:** the app's `user.id` = `members.id` (email-linked) and ≠ `auth.uid()` for **51/90** members; `users.church_id == members.church_id` for all 90 (0 mismatch). Individual message targeting uses `members.id`; auth-FK columns (`sender_id`, `read_messages.user_id`) use `auth.uid()`.

---

## 1. Database

### 1a. Table inventory (live, verified)

| Table | Exists | Rows | Origin | Status |
|---|---|---|---|---|
| `messages` | ✅ | **4** | migration + **manual drift** | Active but broken writes |
| `read_messages` | ✅ | 0 | migration | **Unused** (never written) |
| `message_reads` | ✅ | 0 | **untracked** (no migration) | Used by admin only; 0 reads recorded |
| `direct_messages` | ✅ | 0 | migration | **Dead** — no wired code touches it |
| `device_tokens` | ✅ | 0 | migration (notif system) | Empty |
| `sent_notifications` | ✅ | 0 | migration (notif system) | Empty |
| `notification_preferences` | ✅ | 0 | migration (notif system) | Empty |
| `notifications` | ❌ | — | — | Does **not** exist |
| `notification_reads` | ❌ | — | — | Does **not** exist |
| `notification_recipients` | ❌ | — | — | Does **not** exist |

There are **two competing read-tracking tables** (`read_messages` from migrations, `message_reads` created by hand) **plus** a third dead-in-the-water approach (an `is_read` boolean on `messages`). None of the three currently records a single read.

### 1b. `messages` — live columns (14, verified) vs. authored migration

Migration `20251026053125_create_messages_table.sql` created **8** columns. The live table has **14**. The extra six and the removed CHECK were added **manually in the Supabase dashboard — no migration exists for any of them** (`grep` of `supabase/migrations/` finds nothing adding `recipients`/`content`/`recipient_type`/`priority`/`church_id`/`sender_id` to `messages`).

| Column | In migration? | Live? | Notes |
|---|---|---|---|
| `id uuid PK` | ✅ | ✅ | |
| `subject text` | ✅ | ✅ | |
| `body text` | ✅ | ✅ | The field actually used for content |
| `send_to text` | ✅ (CHECK `'All'/'Soprano'/'Alto'/'Tenor'/'Bass'`) | ✅ | **CHECK is gone/relaxed** — live values are lowercase `all`/`bass`/**`admin`** (would all violate the original CHECK) |
| `sent_by uuid → users` | ✅ | ✅ | **Dead — populated in 0 / 4 rows.** App writes `sender_id` instead |
| `sent_date timestamptz` | ✅ | ✅ | Used for member ordering |
| `is_important bool` | ✅ | ✅ | |
| `created_at timestamptz` | ✅ | ✅ | Used for admin ordering |
| `recipients text` | ❌ manual | ✅ | Overloaded: sender name (compose) or `'admin'` (reply) or voice-part (broadcast) |
| `content text` | ❌ manual | ✅ | **Dead — populated in 0 / 4 rows** (duplicate of `body`) |
| `sender_id uuid` | ❌ manual | ✅ | Real sender FK the app uses; **untracked FK** |
| `recipient_type text` | ❌ manual | ✅ | `'all'` on every row — redundant with `send_to` |
| `priority text` | ❌ manual | ✅ | `'normal'` on every row — unused by UI |
| `church_id uuid` | ❌ manual | ✅ | Multi-tenant scope; **untracked FK**; admin reads filter on it |
| **`is_read`** | ❌ | **❌ ABSENT** | **Code writes/reads it anyway → 42703** |
| **`admin_id`** | ❌ | **❌ ABSENT** | **MessageCompose writes it → 42703** |

### 1c. Foreign keys

- **Tracked (migrations):** `messages.sent_by → users(id)` (unused); `read_messages.user_id → users(id)`, `read_messages.message_id → messages(id)`; `direct_messages.sender_id → users(id)`, `direct_messages.recipient_id → users(id)`; `device_tokens/sent_notifications/notification_preferences.user_id → auth.users(id)`.
- **VERIFIED live FKs** (dumped from `pg_constraint` via the session pooler, 2026-07-19):
  - `messages.church_id → churches(id)` · `messages.sent_by → users(id) ON DELETE SET NULL` · `messages.sender_id → **auth.users(id)**` — note the two sender columns point at **two different tables** (`public.users` vs `auth.users`).
  - `message_reads.message_id → messages(id) ON DELETE CASCADE`; **`message_reads.user_id` has NO FK** (unconstrained).
  - `read_messages.user_id → auth.users(id) ON DELETE CASCADE`; `read_messages.message_id` — no FK (only in the migration text, not live).
  - `direct_messages.sender_id / recipient_id → auth.users(id) ON DELETE CASCADE`.
- **VERIFIED live CHECKs:** `messages_priority_check CHECK (priority IN ('normal','high','urgent'))`; `direct_messages.valid_participants CHECK (sender_id <> recipient_id)`. **The `send_to` CHECK is gone** — no CHECK on `send_to` exists live.

### 1d. RLS policies — VERIFIED LIVE (dumped from `pg_policies`, 2026-07-19)

RLS is **enabled** (`relrowsecurity=true`, not forced) on all four tables. The live policies are a **pile-up of overlapping migration attempts** and — because PERMISSIVE policies are **OR'd together** — the effective result on `messages` is *wide open*:

**`messages` — 7 policies, net effect = no protection:**
```
SELECT "Users can view all messages"      USING: true                    ← everyone reads EVERY row
SELECT "allow_admins_read_all"            USING: (SELECT role FROM users  WHERE id=auth.uid()) IN ('admin','super_admin')
SELECT "allow_read_own_messages"          USING: (sent_by = auth.uid())
INSERT "Users can send messages"          WITH CHECK: true               ← anyone authenticated inserts ANYTHING
INSERT "allow_send_messages"              WITH CHECK: (sent_by = auth.uid())
DELETE "Admins can delete any message"    USING: (SELECT role FROM members WHERE id=auth.uid()) = 'admin'
DELETE "Admins can delete messages"       USING: (SELECT role FROM members WHERE id=auth.uid()) = 'admin'   (dup)
DELETE "allow_delete_own_messages"        USING: (sent_by = auth.uid())
```
- 🔴 **SELECT resolves to `true` → zero church isolation at the DB.** Every authenticated user can read **every church's** messages. Tenant isolation is **client-side only** (`.eq('church_id', …)` in queries) — trivially bypassable. **Security landmine.**
- 🔴 **INSERT resolves to `true`** → any authenticated user can insert any row (this is *why* member `send_to='admin'` inserts pass RLS; the blocker is the missing columns/`NOT NULL`, not RLS).
- The three policies reference **three different identity tables** — `users` (read), `members` (delete), and `sent_by` — and `auth.uid()` is an `auth.users` id, so whether the `members`/`users` sub-selects even match depends on those tables sharing the auth id. Inconsistent and fragile.

**`read_messages` (migration table, unused):** one `FOR ALL` policy `read_messages_policy` USING/WITH CHECK `user_id = auth.uid() OR jwt app_metadata.role IN ('admin','super_admin')`. RLS on.

**`message_reads` (hand-made, admin-used):** 3 policies for role `public` — SELECT/INSERT/UPDATE all keyed on `auth.uid() = user_id`. **No DELETE policy.** UNIQUE `(message_id, user_id)` confirmed (so the admin upsert's `onConflict` is valid).

**`direct_messages` (unused, but fully built):** 10 policies (duplicated across migrations but functional) — admins manage/view all via `auth.users.raw_app_meta_data->>'role' IN ('admin','super_admin')`; users read/update/delete rows where they are sender or recipient; INSERT `WITH CHECK (sender_id = auth.uid())`. This is a **working two-way DM RLS model** — the best existing template for threads.

### 1e. Realtime — VERIFIED

- The DB has exactly one publication: **`supabase_realtime` (`puballtables=false`)**, and **none of `messages` / `read_messages` / `message_reads` / `direct_messages` are members of it** (`pg_publication_tables` returns zero rows for them). So Postgres changes on these tables are **not broadcast** to any realtime subscriber.
- Consistent with the client: no `.channel(...)`/`.subscribe()` on any messaging table in `src/` (only a 30 s `setInterval` in the **dead** `member/Messages.tsx`). For threads, realtime must be explicitly enabled: `ALTER PUBLICATION supabase_realtime ADD TABLE <table>` **and** a client subscription.
- **Triggers:** only `direct_messages` has one — `BEFORE UPDATE → update_updated_at_column()` (keeps `updated_at` fresh). `messages` has **no trigger** (so nothing auto-fills `church_id` — see the `NOT NULL` landmine in §4).

---

## 2. Data shape

**Model: one row = one broadcast to a target group. NOT fanned out per recipient.** There is no recipient join table in use; `read_messages`/`message_reads` would be the fan-out for *read state*, but both are empty.

Live `send_to` distribution across the 4 rows: `all=1, bass=1, admin=2`. All 4 rows have `church_id` set; `sender_id` on 2, `sent_by` on 0.
- `sender_id` set on **2** rows (both `send_to='admin'` → member→admin). These are **legacy** rows: the current wired reply/compose code does **not** supply `church_id`, and `church_id` is now `NOT NULL` with no default and no trigger — so those inserts would fail today (see §4). They predate the constraint.
- `sent_by` set on **0** rows (dead column).
- `content` populated on **0** rows (dead; `body` holds text).

Sample rows (content redacted):

```
{ send_to:'all',   sender_id:null,       sent_by:null, church_id:42b6870d…, body:‹633c›, recipient_type:'all', priority:'normal' }  // admin→everyone
{ send_to:'bass',  sender_id:null,       sent_by:null, church_id:42b6870d…, body:‹24c›,  recipient_type:'all', priority:'normal' }  // admin→voice part
{ send_to:'admin', sender_id:8b45e521…,  sent_by:null, church_id:42b6870d…, body:‹13c›,  recipient_type:'all', priority:'normal' }  // member→admin (reply)
```

**How is "read" recorded? Effectively, it isn't.** Three mechanisms coexist and none is recording:
1. `messages.is_read` boolean — **column doesn't exist**; member UI + both dashboards reference it → those reads/writes error.
2. `message_reads (message_id, user_id)` — used only by **admin** `Messages.tsx` upsert; works, but 0 rows so far.
3. `read_messages` — created + indexed by migration, **never referenced by wired code**; 0 rows.

---

## 3. Code

`App.tsx` wires exactly **4** messaging routes. Everything else below is dead.

### Wired & working-ish

**`admin/Messages.tsx`** → `/admin/messages` (admin inbox + management) — **mostly works.**
- Reads: `messages.select('*').eq('church_id', church.id)` (all) and a second `…​.eq('send_to','admin')` (member inbox).
- Read-tracking: `message_reads.select('message_id').eq('user_id', user.id)` then `message_reads.upsert({message_id, user_id}, {onConflict:'message_id,user_id'})` — **works** (table exists).
- Delete: `messages.delete().eq('id', id)` — works.
- Its TS interface declares `is_read`, but reads actually come from `message_reads`, so the missing column doesn't break it here.

**`admin/MessageForm.tsx`** → `/admin/messages/new` (compose broadcast) — **BROKEN.**
- `messages.insert([{ subject, body:content, send_to:recipientType, recipients:recipientType, is_important, is_read:false, church_id }])`.
- `is_read:false` → **PostgREST rejects (column absent)** → admins currently **cannot send broadcasts**. Targets: `all` / `soprano` / `alto` / `tenor` / `bass`.

**`member/Messages-MOBILE.tsx`** → `/member/messages` (member inbox + reply) — **partially broken.**
- Read: `messages.select('*').order('sent_date')`, then client filter `m.send_to === 'all' || m.send_to === user?.id`. **Bug:** `send_to` never equals a user id (it's `all`/voice-part/`admin`), so **members never receive voice-part-targeted messages** (`send_to='bass'` is invisible) — only `all`.
- Mark read: `messages.update({is_read:true}).eq('id', …)` → **column absent → errors.**
- Unread UI: filters `!m.is_read`; `is_read` is always `undefined` → `!undefined === true` → **every message shows as unread.**
- **Reply (member→admin):** `messages.insert([{ subject:'Re: …', body:replyText, send_to:'admin', recipients:'admin', sender_id:user.id, is_important:false }])`. No `is_read`, so it clears that bug — **but it omits `church_id`, which is `NOT NULL` with no default → the insert fails today.** This path *used* to work (it produced the 2 legacy admin rows) but was broken by the later `church_id NOT NULL` constraint. Fix = add `church_id` to the insert.

**`member/MessageCompose.tsx`** → `/member/messages/compose` (dedicated member→admin compose) — **BROKEN.**
- Reads member name: `.select('first_name, last_name')` (from a members/users lookup).
- `messages.insert({ subject, body, send_to:'admin', recipients:senderName, is_read:false, admin_id:user.id, sent_date, created_at })`.
- Writes **two non-existent columns** (`is_read`, `admin_id`) → **insert fails.** The functioning member→admin path is the reply above, not this screen.

### Read-only consumers

- **`member/Dashboard-MOBILE.tsx`** — `messages.select('id, send_to, is_read')` → **`is_read` missing → query errors → unread badge = 0.** Also profile from `members` table.
- **`admin/Dashboard.tsx`** — `messages.select('id, created_at').eq('church_id', user.church_id)` for a count (fine).
- **`lib/offlineCache.ts`** — pre-caches `messages.select('*').eq('church_id', churchId)` for offline.
- **`lib/database.ts`** — declares `messagesService`, `directMessagesService`, `readMessagesService` helpers; **not the path the screens use** (screens call Supabase inline). Largely dead.

### Dead / unreachable (not imported by `App.tsx`)

- **`member/Messages.tsx`** — older variant; joins `members(name)` via `admin_id`, uses `message_reads`, polls every 30 s with **no interval cleanup**. Not routed.
- **`admin/AdminMessages-MOBILE.tsx`** — entirely different schema assumption: `sender_id`/`recipient_id`/`content` joined against a **`profiles`** table (which isn't this app's user table). Not routed.
- **`member/MessageDetail.tsx`** — mock with hardcoded data. Not routed.
- **`supabase/functions/send-message/index.ts`** — Resend-email + DB insert edge function. **Never invoked** (`grep` finds no `functions/v1/send-message` or `.invoke('send-message')` in `src/`). Its insert targets yet another phantom schema (`message`, `recipient_count`, `sent_at`) — none of which exist live. Pure dead code.

### Targeting summary

| Direction | Screen | Targets | Works? |
|---|---|---|---|
| Admin → whole church | MessageForm | `send_to='all'` | ❌ (is_read) |
| Admin → voice part | MessageForm | `send_to='soprano/alto/tenor/bass'` | ❌ write (is_read) **and** ❌ member read filter |
| Admin → individual | — | **No path exists** | — |
| Member → admin (compose) | MessageCompose | `send_to='admin'` | ❌ (is_read/admin_id) |
| Member → admin (reply) | Messages-MOBILE | `send_to='admin'`, `sender_id` | ❌ now (omits `church_id`, which is `NOT NULL`) — worked before the constraint |

---

## 4. Gaps & landmines for a two-way threads feature

**Blocking bugs to fix first (independent of threads):**
1. **Phantom `is_read`/`admin_id` columns.** Decide: add the columns, or (better) delete these references and standardize on a reads table. Until then admin-send, member-compose, mark-read, and unread counts are broken.
2. **`messages.church_id` is `NOT NULL`, no default, no trigger** — but the member reply/compose inserts omit it, so **every current member→admin write fails** (independently of the `is_read` bug). Either supply `church_id` in those inserts or add a default/trigger.
3. **Member read filter never matches voice parts** (`send_to === user.id`). Voice-part broadcasts are invisible to members regardless of the column bug.
4. 🔴 **RLS gives `messages` no real protection** (SELECT `USING true`, INSERT `WITH CHECK true`): any authenticated user can read every church's messages and insert arbitrary rows. Cross-tenant isolation is client-side only. Rebuild the `messages` policies before layering threads on top.

**Schema landmines:**
5. **Migrations do not reproduce production.** Six columns, the dropped `send_to` CHECK, the pile-up of live RLS policies, the `priority` CHECK, several FKs, the `idx_messages_*` indexes, and the entire `message_reads` table exist **only in the live DB**. Any `supabase db reset` / fresh environment produces a **different, more-broken** `messages` table. Capture current state into a new baseline migration before building anything.
6. **Overloaded/duplicated columns:** `send_to` vs `recipient_type`, `body` vs `content` (dead), `sender_id` (→`auth.users`) vs `sent_by` (→`public.users`, dead), `recipients` (three different meanings). A threads feature needs one clear sender/target model — don't build on these.
7. **Two identity tables in play** — `sender_id`→`auth.users` while `sent_by`→`public.users`, and RLS role checks hit `users` *and* `members` (and dead code hits `profiles`). Three user tables (`users`, `members`, `profiles`) all exist. Pin down which one is canonical before writing thread policies.
8. **Three read-tracking mechanisms, zero recording.** Pick one. `read_messages` (migration-tracked, UNIQUE `(message_id,user_id)`, FK `user_id→auth.users`, RLS) is the cleaner one but is unused; `message_reads` (hand-made, no `user_id` FK, no DELETE policy) is what admin code actually uses. Consolidate onto one and delete the other + the `is_read` idea.
9. **`direct_messages` is a ready-made two-way thread table** — VERIFIED live: FKs to `auth.users`, `CHECK (sender_id <> recipient_id)`, `updated_at` trigger, and **purpose-built indexes** incl. `idx_direct_messages_conversation (sender_id, recipient_id, created_at DESC)` and a partial `idx_direct_messages_unread (recipient_id, is_read) WHERE is_read=false`, plus a working DM-style RLS set. It's **empty + unused** — strongly consider building threads on this rather than inventing schema (it just lacks a `thread_id`/`parent_id` and, for group/broadcast threads, church scoping).

**Indexes (VERIFIED live):**
10. `messages` has `idx_messages_church (church_id)`, `idx_messages_sent_by (sent_by)`, `idx_messages_sent_date (sent_date DESC)` — but **no index on `sender_id`** (the column the app actually filters/sorts sends by) and **no `(church_id, sent_date)` composite** for the per-church inbox sort. A threaded model also needs a `thread_id` column + index, which doesn't exist. `read_messages`/`message_reads` both have the right `(message_id,user_id)` UNIQUE + per-column indexes.

**RLS patterns worth reusing (cite, VERIFIED live):**
11. Best role-check idiom in the DB is `direct_messages`': `EXISTS (SELECT 1 FROM auth.users WHERE users.id = auth.uid() AND (users.raw_app_meta_data->>'role') IN ('admin','super_admin'))` — reads role from the JWT-backed `auth.users` metadata, avoiding the `users`-vs-`members` ambiguity. `read_messages` uses the JWT directly: `(auth.jwt()->'app_metadata'->>'role') IN ('admin','super_admin')`. Prefer these over the `messages` policies' `SELECT role FROM users/members` sub-selects.
12. Owner-scoped read state: `auth.uid() = user_id` (from `read_messages`/`message_reads`).
13. **Must add church isolation** — no live policy enforces `church_id` today (SELECT is `true`). Add `church_id = (SELECT church_id FROM <canonical user table> WHERE id = auth.uid())` to every new policy.

**Realtime (VERIFIED):**
14. Publication `supabase_realtime` exists (`alltables=false`) and **contains none of the messaging tables**; nothing subscribes client-side. For live threads: `ALTER PUBLICATION supabase_realtime ADD TABLE <table>` + a client `.channel().on('postgres_changes', …).subscribe()`. No existing realtime code to build on.

**Dead code to delete or consciously rebuild:**
15. `member/Messages.tsx`, `admin/AdminMessages-MOBILE.tsx`, `member/MessageDetail.tsx`, `supabase/functions/send-message/`, and the unused `directMessagesService`/`readMessagesService` in `lib/database.ts`. Leaving them invites building against the wrong (phantom) schemas — the three dead files each reference a *different* non-existent shape.

---

## 5. Verification status — gap now CLOSED

Live RLS, indexes, FK/CHECK constraints, triggers, and Realtime publication membership were **dumped directly from the database** on 2026-07-19 (`pg_policies`, `pg_indexes`, `pg_constraint`, `pg_class`, `information_schema`, `pg_publication_tables`) and are reflected as *VERIFIED* in §1c–§1e and §4 above.

Connection note for future runs: the direct host `db.<ref>.supabase.co` is **IPv6-only** and does not resolve on this (IPv4-only) machine. Use the **IPv4 session pooler** instead: host `aws-1-us-east-2.pooler.supabase.com`, port `5432`, user `postgres.lpcepycxqfqzwwszmpks`, same password (parse it out of `SUPABASE_DB_URL` — it contains `@`/`:` so naive URL parsing breaks).

*Recon artifacts (`scripts/probe-messaging*.mjs`, `scripts/find-pooler.mjs`, `scripts/probe-triggers.mjs`) are read-only and can be deleted.*

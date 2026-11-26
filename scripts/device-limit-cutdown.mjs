#!/usr/bin/env node
// Device-limit cut-down: for every account that is OVER its device limit today,
// keep the most recently used devices and revoke the sessions of the rest.
//
// DRY RUN BY DEFAULT — lists who would be affected and changes nothing.
//   node scripts/device-limit-cutdown.mjs            # dry run (default)
//   node scripts/device-limit-cutdown.mjs --csv      # dry run, CSV output
//   node scripts/device-limit-cutdown.mjs --apply    # revoke (asks for "yes")
//
// Uses the same rules as the device_check() RPC (migration
// 20261126000000_device_limit): sessions used in the last 30 days, grouped into
// devices by device id (or user agent for sessions with no id), limit from
// device_limit_for() — members/guests 2, admins exempt, per-account overrides.
// Needs SUPABASE_DB_URL in .env.local (connects through the session pooler).
// A revoked device keeps working until its access token expires (≤ 60 min).

import fs from 'fs';
import readline from 'readline';
import pg from 'pg';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const CSV = args.has('--csv');

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
// Direct host db.<ref>.supabase.co is IPv6-only → use the session pooler.
let url = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL || '';
const ref = url.match(/@db\.([a-z]+)\.supabase\.co/)?.[1];
if (ref) url = url.replace(`@db.${ref}.supabase.co:5432`, '@aws-1-us-east-2.pooler.supabase.com:5432').replace('//postgres:', `//postgres.${ref}:`);
if (!url) { console.error('SUPABASE_DB_URL is not set'); process.exit(1); }

const PLAN_SQL = `
with acct as (
  select u.id user_id, u.email, m.role, c.name church, public.device_limit_for(u.id) lim
  from auth.users u
  join public.members m on lower(m.email) = lower(u.email)
  left join public.churches c on c.id = m.church_id
),
dev as (            -- one row per (account, device)
  select a.user_id, s.device_key, max(s.last_used) last_used,
         array_agg(s.session_id) sessions, max(s.user_agent) user_agent
  from acct a cross join lateral public.device_active_sessions(a.user_id) s
  where a.lim is not null
  group by a.user_id, s.device_key
),
ranked as (         -- 1 = most recently used
  select d.*, row_number() over (partition by d.user_id order by d.last_used desc) rn from dev d
)
select a.user_id, a.email, a.role, a.church, a.lim,
       count(*)::int devices,
       count(*) filter (where r.rn > a.lim)::int devices_to_remove,
       coalesce(sum(cardinality(r.sessions)) filter (where r.rn > a.lim), 0)::int sessions_to_revoke,
       (select array_agg(x) from ranked r2, unnest(r2.sessions) x where r2.user_id = a.user_id and r2.rn > a.lim) revoke_ids,
       string_agg(left(r.user_agent, 60) || ' (last ' || to_char(r.last_used, 'YYYY-MM-DD') || ')', ' | ' order by r.rn)
         filter (where r.rn > a.lim) removed_devices
from acct a
join ranked r on r.user_id = a.user_id
group by a.user_id, a.email, a.role, a.church, a.lim
having count(*) > a.lim
order by a.church nulls last, a.email`;

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query(PLAN_SQL);
  const totalSessions = rows.reduce((n, r) => n + r.sessions_to_revoke, 0);
  if (CSV) {
    console.log('email,role,church,limit,devices,devices_to_remove,sessions_to_revoke,removed_devices');
    for (const r of rows) console.log([r.email, r.role, r.church, r.lim, r.devices, r.devices_to_remove, r.sessions_to_revoke, r.removed_devices]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  } else {
    console.table(rows.map((r) => ({ email: r.email, role: r.role, church: r.church, limit: r.lim, devices: r.devices,
      remove: r.devices_to_remove, sessions: r.sessions_to_revoke, removed: (r.removed_devices || '').slice(0, 80) })));
  }
  console.error(`${APPLY ? 'PLAN' : 'DRY RUN'}: ${rows.length} account(s) over their limit; ${totalSessions} session(s) would be revoked. The most recently used devices are kept.`);

  if (APPLY && rows.length) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    const answer = await new Promise((res) => rl.question(`Revoke ${totalSessions} session(s) now? Type "yes": `, res));
    rl.close();
    if (answer.trim() !== 'yes') { console.error('Cancelled. Nothing changed.'); }
    else {
      await client.query('begin');
      const ids = rows.flatMap((r) => r.revoke_ids || []);
      const del = await client.query('delete from auth.sessions where id = any($1::uuid[])', [ids]);
      await client.query('delete from public.device_sessions where session_id = any($1::uuid[])', [ids]);
      await client.query('commit');
      console.error(`Done: revoked ${del.rowCount} session(s).`);
    }
  } else if (!APPLY) {
    console.error('Nothing was changed. Run with --apply to revoke.');
  }
} finally {
  await client.end();
}

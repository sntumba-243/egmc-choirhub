// Full refresh of the Neon backup DB from Supabase production.
//   node scripts/sync-to-neon.mjs
//
// SOURCE (Supabase): READ-ONLY — issues only SELECTs.
// TARGET (Neon):     public schema is dropped + recreated + reloaded, all inside
//                    ONE transaction. Any error → ROLLBACK → Neon left untouched.
// Re-runnable: every run is a clean full refresh.
//
// No pg_dump available, so schema is reconstructed from the live catalog via the
// 'pg' package. LIMITATIONS (data-mirror backup, not a byte-exact dump):
//   • columns + types + NOT NULL are replicated; PKs, FKs, indexes, defaults,
//     sequences, views, RLS, triggers are NOT.
//   • user-defined/enum/domain types are stored as text.
//   • public schema only — auth/storage/realtime are never touched.
// For a byte-exact backup, install postgresql-client and use pg_dump | psql.

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const SRC_URL = process.env.SUPABASE_DB_URL;
const TGT_URL = process.env.NEON_DB_URL;
if (!SRC_URL || !TGT_URL) {
  console.error('❌ Need SUPABASE_DB_URL and NEON_DB_URL in .env.local');
  process.exit(1);
}

const READ_BATCH = 500;
const VERIFY_TABLES = ['songs', 'churches', 'events'];
const EXPECT = { songs: 482 };

const qIdent = (n) => '"' + String(n).replace(/"/g, '""') + '"';

const BUILTINS = new Set([
  'uuid', 'text', 'character varying', 'varchar', 'character', 'char', 'bpchar', 'name',
  'integer', 'int', 'int4', 'bigint', 'int8', 'smallint', 'int2',
  'boolean', 'bool', 'numeric', 'decimal', 'real', 'float4', 'double precision', 'float8',
  'timestamp with time zone', 'timestamp without time zone', 'timestamptz', 'timestamp',
  'date', 'time with time zone', 'time without time zone', 'time', 'timetz', 'interval',
  'json', 'jsonb', 'bytea', 'inet', 'cidr', 'macaddr', 'money',
]);

// Keep recognized built-ins (with modifiers/arrays); map unknown (enum/domain/
// composite) types to text so the data always lands.
function normalizeType(t) {
  const isArray = t.endsWith('[]');
  const base = isArray ? t.slice(0, -2) : t;
  const baseName = base.replace(/\(.*\)/, '').trim().toLowerCase();
  const userDefined = base.includes('.') && !base.startsWith('pg_catalog.');
  if (userDefined || !BUILTINS.has(baseName)) return isArray ? 'text[]' : 'text';
  return t;
}

function coerce(val, ntype) {
  if (val === null || val === undefined) return null;
  const base = ntype.replace(/\(.*\)/, '').replace('[]', '').trim().toLowerCase();
  if (base === 'json' || base === 'jsonb') return JSON.stringify(val); // valid JSON text
  return val; // arrays/dates/scalars handled by node-pg
}

async function getTables(src) {
  const r = await src.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  );
  return r.rows.map((x) => x.tablename);
}

async function getColumns(src, table) {
  const r = await src.query(
    `SELECT a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS type,
            a.attnotnull AS notnull
     FROM pg_attribute a
     WHERE a.attrelid = format('public.%I', $1)::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY a.attnum`,
    [table]
  );
  return r.rows.map((c) => ({ name: c.name, ntype: normalizeType(c.type), notnull: c.notnull }));
}

async function insertBatch(tgt, table, cols, rows) {
  if (!rows.length) return;
  const colList = cols.map((c) => qIdent(c.name)).join(',');
  const tuples = [];
  const params = [];
  let p = 1;
  for (const row of rows) {
    const ph = [];
    for (const c of cols) { ph.push('$' + p++); params.push(coerce(row[c.name], c.ntype)); }
    tuples.push('(' + ph.join(',') + ')');
  }
  await tgt.query(
    `INSERT INTO public.${qIdent(table)} (${colList}) VALUES ${tuples.join(',')}`,
    params
  );
}

async function count(client, table) {
  const r = await client.query(`SELECT count(*)::int AS n FROM public.${qIdent(table)}`);
  return r.rows[0].n;
}

async function main() {
  const src = new pg.Client({ connectionString: SRC_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
  const tgt = new pg.Client({ connectionString: TGT_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 300000 });
  await src.connect();
  await tgt.connect();
  console.log('Connected. Supabase = READ-ONLY, Neon = full refresh (single transaction).\n');

  let committed = false;
  try {
    const tables = await getTables(src);
    console.log(`Public tables to refresh (${tables.length}): ${tables.join(', ')}\n`);

    await tgt.query('BEGIN');

    const perTable = [];
    for (const table of tables) {
      const cols = await getColumns(src, table);
      if (!cols.length) { console.log(`- ${table}: no columns, skipped`); continue; }

      // Drop + recreate on Neon
      const defs = cols.map((c) => `${qIdent(c.name)} ${c.ntype}${c.notnull ? ' NOT NULL' : ''}`).join(', ');
      await tgt.query(`DROP TABLE IF EXISTS public.${qIdent(table)} CASCADE`);
      await tgt.query(`CREATE TABLE public.${qIdent(table)} (${defs})`);

      // Copy rows in batches of READ_BATCH (param-safe cap)
      const colList = cols.map((c) => qIdent(c.name)).join(',');
      const batch = Math.max(1, Math.min(READ_BATCH, Math.floor(60000 / cols.length)));
      let copied = 0;
      for (let offset = 0; ; offset += batch) {
        const res = await src.query(
          `SELECT ${colList} FROM public.${qIdent(table)} ORDER BY ctid LIMIT ${batch} OFFSET ${offset}`
        );
        if (!res.rows.length) break;
        await insertBatch(tgt, table, cols, res.rows);
        copied += res.rows.length;
        if (res.rows.length < batch) break;
      }
      perTable.push({ table, copied });
      process.stdout.write(`  • ${table}: ${copied} rows\n`);
    }

    await tgt.query('COMMIT');
    committed = true;
    console.log('\nNeon transaction COMMITTED.\n');

    // ── Verification ──
    console.log('VERIFICATION');
    console.log('table'.padEnd(12) + 'supabase'.padStart(10) + 'neon'.padStart(8) + '  match  ' + 'neon max(updated_at|created_at)');
    console.log('─'.repeat(78));
    let allMatch = true;
    for (const t of VERIFY_TABLES) {
      let sCount, nCount, maxInfo = '—';
      try { sCount = await count(src, t); } catch { sCount = 'ERR'; }
      try { nCount = await count(tgt, t); } catch { nCount = 'ERR'; }
      // max timestamp column on Neon
      try {
        const cols = await getColumns(src, t);
        const tsCol = cols.find((c) => c.name === 'updated_at') ? 'updated_at'
          : cols.find((c) => c.name === 'created_at') ? 'created_at' : null;
        if (tsCol) {
          const r = await tgt.query(`SELECT max(${qIdent(tsCol)}) AS m FROM public.${qIdent(t)}`);
          maxInfo = `${tsCol}=${r.rows[0].m ? new Date(r.rows[0].m).toISOString() : 'null'}`;
        }
      } catch { maxInfo = '(no ts col)'; }
      const match = sCount === nCount && sCount !== 'ERR';
      const expectNote = EXPECT[t] != null ? (nCount === EXPECT[t] ? '' : ` ⚠expect ${EXPECT[t]}`) : '';
      if (!match || (EXPECT[t] != null && nCount !== EXPECT[t])) allMatch = false;
      console.log(
        t.padEnd(12) + String(sCount).padStart(10) + String(nCount).padStart(8) +
        '  ' + (match ? ' ✓ ' : ' ✗ ').padEnd(6) + '  ' + maxInfo + expectNote
      );
    }
    console.log('─'.repeat(78));
    console.log(`\nResult: ${allMatch ? 'ALL MATCH ✅' : 'MISMATCH ⚠️'}`);
  } catch (err) {
    if (!committed) { try { await tgt.query('ROLLBACK'); console.error('\nROLLED BACK — Neon left unchanged.'); } catch {} }
    console.error('Fatal:', err.message);
    await src.end(); await tgt.end();
    process.exit(1);
  }

  await src.end();
  await tgt.end();
}

main();

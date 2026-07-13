// Automated backup. READ-ONLY on Supabase — exports data, then (optionally)
// refreshes the Neon mirror.
//   node scripts/backup-all.mjs
//
// Writes full-table JSON exports + bucket manifest to scripts/. Locally it also
// copies them to ~/Desktop/choirhub-backup-{date}/; in CI (process.env.CI) that
// copy is skipped and GitHub artifacts hold the snapshots instead.
// Exits non-zero if a count check fails (songs must be > 0 and equal the count
// re-read from the written JSON).
// After the export, if SUPABASE_DB_URL + NEON_DB_URL are present, it refreshes
// the Neon mirror via sync-to-neon.mjs; otherwise that step is skipped.

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFile, readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

dotenv.config({ path: '.env.local' });

const CI = !!process.env.CI;
const BUCKET = 'choirhub_partitions';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !KEY) { console.error('❌ Missing Supabase env'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const TS = Date.now();
const DATE = new Date(TS).toISOString().slice(0, 10);

async function dumpTable(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function dumpBucket() {
  const objs = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET)
      .list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`bucket: ${error.message}`);
    for (const o of data || []) {
      if (o.id === null) continue;
      objs.push({ name: o.name, size: o.metadata?.size ?? null, mimetype: o.metadata?.mimetype ?? null, updated_at: o.updated_at ?? null });
    }
    if (!data || data.length < 1000) break;
  }
  return objs;
}

async function main() {
  // ── Collect ──
  const [songs, churches, events, bucket] = await Promise.all([
    dumpTable('songs'), dumpTable('churches'), dumpTable('events'), dumpBucket(),
  ]);

  const files = [
    { label: 'songs',           name: `backup-songs-full-${TS}.json`,      data: songs },
    { label: 'churches',        name: `backup-churches-${TS}.json`,        data: churches },
    { label: 'events',          name: `backup-events-${TS}.json`,          data: events },
    { label: 'bucket-manifest', name: `backup-bucket-manifest-${TS}.json`, data: bucket },
  ];

  // ── Write to scripts/ ──
  for (const f of files) {
    f.repoPath = path.join('scripts', f.name);
    await writeFile(f.repoPath, JSON.stringify(f.data, null, 2), 'utf8');
  }

  // ── Off-repo copy (local only) ──
  let desktopDir = null;
  if (!CI) {
    desktopDir = path.join(os.homedir(), 'Desktop', `choirhub-backup-${DATE}`);
    await mkdir(desktopDir, { recursive: true });
    for (const f of files) {
      f.desktopPath = path.join(desktopDir, f.name);
      await copyFile(f.repoPath, f.desktopPath);
    }
  }

  // ── Verify each file: valid JSON + row count (and Desktop copy match locally) ──
  for (const f of files) {
    try {
      const repoParsed = JSON.parse(await readFile(f.repoPath, 'utf8'));
      f.rows = Array.isArray(repoParsed) ? repoParsed.length : null;
      f.validJson = true;
      f.bytes = Buffer.byteLength(await readFile(f.repoPath, 'utf8'), 'utf8');
      if (!CI && f.desktopPath) {
        const deskParsed = JSON.parse(await readFile(f.desktopPath, 'utf8'));
        f.copyMatches = Array.isArray(deskParsed) && deskParsed.length === f.rows;
      } else {
        f.copyMatches = true; // no copy in CI
      }
    } catch (e) {
      f.validJson = false; f.copyMatches = false; f.error = e.message;
    }
  }

  const totalBucketBytes = bucket.reduce((n, o) => n + (Number(o.size) || 0), 0);

  // ── Summary table ──
  console.log(`\nBackup  (ts=${TS}, date=${DATE}, CI=${CI})`);
  console.log(CI ? 'Off-repo copy: skipped (CI)\n' : `Off-repo copy dir: ${desktopDir}\n`);
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log(pad('FILE', 40) + padL('ROWS', 7) + '  ' + pad('  JSON', 7) + pad('COPY', 7) + 'SIZE(KB)');
  console.log('─'.repeat(76));
  for (const f of files) {
    console.log(
      pad(f.name, 40) +
      padL(f.rows ?? '—', 7) + '  ' +
      pad(f.validJson ? '  ok' : '  BAD', 7) +
      pad(CI ? '  n/a' : (f.copyMatches ? ' yes' : ' NO'), 7) +
      padL(((f.bytes || 0) / 1024).toFixed(1), 8)
    );
  }
  console.log('─'.repeat(76));
  console.log(`songs=${songs.length}  churches=${churches.length}  events=${events.length}  bucket_objects=${bucket.length}  bucket_total=${(totalBucketBytes / 1048576).toFixed(1)}MB`);

  // ── Count-check gate: songs > 0 AND written JSON count == fetched count ──
  const songsFile = files.find((f) => f.label === 'songs');
  const countOk = songs.length > 0 && songsFile.validJson && songsFile.rows === songs.length;
  const allValid = files.every((f) => f.validJson && f.copyMatches);
  console.log(`\nCount check (songs > 0 && json == fetched): ${countOk ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`All files valid${CI ? '' : ' & copied'}: ${allValid ? 'YES ✅' : 'NO ⚠️'}`);
  if (!countOk || !allValid) {
    console.error('❌ Backup verification FAILED — exiting non-zero.');
    process.exit(1);
  }

  // ── Neon mirror refresh (only if credentials present) ──
  if (process.env.SUPABASE_DB_URL && process.env.NEON_DB_URL) {
    console.log('\n── Neon mirror refresh ──');
    try {
      const { syncToNeon } = await import('./sync-to-neon.mjs');
      await syncToNeon();
      console.log('Neon refresh: done ✅');
    } catch (e) {
      // The JSON export is the primary guarantee; a Neon failure is logged loudly
      // but does NOT fail the job (so the JSON artifact still uploads).
      console.error('⚠ Neon sync FAILED (JSON backup still succeeded):', e.message);
    }
  } else {
    console.log('\nNeon sync skipped (no credentials)');
  }

  console.log('\nBackup complete.');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });

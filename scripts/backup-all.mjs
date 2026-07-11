// Pre-migration backup. READ-ONLY — exports data, changes nothing.
//   node scripts/backup-all.mjs
// Writes full-table JSON exports + bucket manifest to scripts/, verifies each,
// and copies them to ~/Desktop/choirhub-backup-{date}/ as off-repo insurance.

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFile, readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

dotenv.config({ path: '.env.local' });

const BUCKET = 'choirhub_partitions';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !KEY) { console.error('❌ Missing Supabase env'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const TS = Date.now();
const DATE = new Date(TS).toISOString().slice(0, 10);
const EXPECTED = { songs: 482 };

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

  // ── Copy all backups off-repo to ~/Desktop/choirhub-backup-{date}/ ──
  const desktopDir = path.join(os.homedir(), 'Desktop', `choirhub-backup-${DATE}`);
  await mkdir(desktopDir, { recursive: true });
  for (const f of files) {
    f.desktopPath = path.join(desktopDir, f.name);
    await copyFile(f.repoPath, f.desktopPath);
  }

  // ── Verify each file: valid JSON + row count, and repo/Desktop copies match ──
  for (const f of files) {
    try {
      const repoParsed = JSON.parse(await readFile(f.repoPath, 'utf8'));
      const deskRaw = await readFile(f.desktopPath, 'utf8');
      const deskParsed = JSON.parse(deskRaw);
      f.rows = Array.isArray(repoParsed) ? repoParsed.length : null;
      f.validJson = true;
      f.copyMatches = Array.isArray(deskParsed) && deskParsed.length === f.rows;
      f.bytes = Buffer.byteLength(deskRaw, 'utf8');
    } catch (e) {
      f.validJson = false; f.error = e.message;
    }
  }

  const totalBucketBytes = bucket.reduce((n, o) => n + (Number(o.size) || 0), 0);

  // ── Summary table ──
  console.log(`\nPre-migration backup  (ts=${TS}, date=${DATE})`);
  console.log('Off-repo copy dir: ' + desktopDir + '\n');
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log(pad('FILE', 34) + padL('ROWS', 7) + '  ' + pad('  JSON', 7) + pad('COPY✔', 7) + 'SIZE(KB)');
  console.log('─'.repeat(72));
  for (const f of files) {
    const expected = EXPECTED[f.label];
    const rowsCell = f.rows + (expected != null ? (f.rows === expected ? ` (=${expected}✓)` : ` (≠${expected}!)`) : '');
    console.log(
      pad(f.name, 34) +
      padL(f.rows ?? '—', 7) + '  ' +
      pad(f.validJson ? '  ok' : '  BAD', 7) +
      pad(f.copyMatches ? ' yes' : ' NO', 7) +
      padL(((f.bytes || 0) / 1024).toFixed(1), 8) +
      (expected != null && f.rows !== expected ? `   ⚠ expected ${expected}` : '')
    );
  }
  console.log('─'.repeat(72));
  console.log(`songs=${songs.length}  churches=${churches.length}  events=${events.length}  bucket_objects=${bucket.length}  bucket_total=${(totalBucketBytes/1048576).toFixed(1)}MB`);

  console.log('\nRepo copies:');
  for (const f of files) console.log('  ' + f.repoPath);
  console.log('Desktop copies:');
  for (const f of files) console.log('  ' + f.desktopPath);

  const allValid = files.every((f) => f.validJson && f.copyMatches);
  const songsOk = songs.length === EXPECTED.songs;
  console.log(`\nAll files valid & copied: ${allValid ? 'YES ✅' : 'NO ⚠️'}`);
  console.log(`songs == ${EXPECTED.songs}: ${songsOk ? 'YES ✅' : `NO — actual ${songs.length} ⚠️`}`);
  console.log('READ-ONLY: no source data was modified.');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });

// Authoritative migration: songs.sheet_music_url (Google Drive) → Supabase
// Storage bucket 'choirhub_partitions'.
//
//   node scripts/migrate-song-urls.mjs            # DRY RUN (default) — no writes
//   node scripts/migrate-song-urls.mjs --commit   # writes DB (after a backup)
//
// Matching tiers (each song, first hit wins):
//   Tier 1  standard sanitize of TITLE  + '.pdf'         exact bucket key
//   Tier 2  strict   sanitize of TITLE  + '.pdf'         exact bucket key
//   Tier 3  loose match of TITLE against unclaimed keys  (unique only)
//   Tier 4  scrape the REAL filename from the Google Drive viewer <title>,
//           then re-match it Tier 1 → 2 → loose (fixes wrong/variant DB titles)
// Ambiguous (loose key → multiple files or multiple songs) is NEVER auto-matched.

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';

dotenv.config({ path: '.env.local' });

const BUCKET = 'choirhub_partitions';
const REPORT_PATH = 'scripts/migration-report.txt';
const COMMIT = process.argv.includes('--commit');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !KEY) { console.error('❌ Missing Supabase env in .env.local'); process.exit(1); }
if (COMMIT && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ --commit requires SUPABASE_SERVICE_ROLE_KEY (writes need service role).');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Shared sanitization — MUST stay identical to upload-partitions.mjs ──
const sanitizeStandard = (n) =>
  n.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').replace(/\s/g, '_');
const sanitizeStrict = (n) =>
  n.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
const loose = (n) =>
  n.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase().replace(/\.pdf$/, '').replace(/[^a-z0-9]/g, '');

const isDrive = (u) => /drive\.google\.com/i.test(u || '');
const driveFileId = (u) => {
  if (!u) return null;
  const a = u.match(/\/d\/([^/]+)/); if (a) return a[1];
  const b = u.match(/[?&]id=([^&]+)/); return b ? b[1] : null;
};
const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

// Tier 4: scrape the real filename from the Drive viewer <title>.
async function driveFilename(fileId) {
  const url = `https://drive.google.com/file/d/${fileId}/view`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, {
        redirect: 'follow', signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      });
      clearTimeout(to);
      const html = await res.text();
      const m = html.match(/<title>([^<]*)<\/title>/i);
      if (!m) return null;
      const name = decodeEntities(m[1]).replace(/\s*-\s*Google Drive\s*$/i, '').trim();
      if (!name || /^google drive$/i.test(name) || /sign in|page not found/i.test(name)) return null;
      return name;
    } catch {
      await sleep(500 * attempt);
    }
  }
  return null;
}

// Match a filename against the bucket: Tier 1 exact → Tier 2 exact → loose unique.
function matchName(name, bucketSet, looseMap) {
  const cand = /\.pdf$/i.test(name) ? name : name + '.pdf';
  const t1 = sanitizeStandard(cand);
  const t2 = sanitizeStrict(cand);
  if (bucketSet.has(t1)) return { key: t1, via: 1 };
  if (bucketSet.has(t2)) return { key: t2, via: 2 };
  const hits = looseMap.get(loose(cand)) || [];
  if (hits.length === 1) return { key: hits[0], via: 3 };
  if (hits.length > 1) return { ambiguous: true, hits };
  return null;
}

async function fetchSongs() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('songs').select('id, title, sheet_music_url')
      .not('sheet_music_url', 'is', null).order('title').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows.filter((s) => s.sheet_music_url && s.sheet_music_url.trim());
}

async function listBucket() {
  const names = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET)
      .list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const o of data || []) if (o.id !== null) names.push(o.name);
    if (!data || data.length < 1000) break;
  }
  return names;
}

async function pool(items, size, worker) {
  let next = 0;
  const run = async () => { while (next < items.length) { const i = next++; await worker(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(size, items.length || 1) }, run));
}

function publicUrl(key) {
  return supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl; // URL-encoded
}

async function main() {
  console.log(`Mode: ${COMMIT ? 'COMMIT (will write DB)' : 'DRY RUN (no writes)'}\n`);
  const songs = await fetchSongs();
  const bucketNames = await listBucket();
  const bucketSet = new Set(bucketNames);
  const looseMap = new Map();
  for (const f of bucketNames) {
    const lk = loose(f);
    if (!looseMap.has(lk)) looseMap.set(lk, []);
    looseMap.get(lk).push(f);
  }
  const driveCount = songs.filter((s) => isDrive(s.sheet_music_url)).length;

  // ── Tier 1/2 exact by title ──
  const matched = []; // { song, tier, key, drive? }
  const duplicates = [];
  let leftover = [];
  for (const s of songs) {
    const t1 = sanitizeStandard(s.title) + '.pdf';
    const t2 = sanitizeStrict(s.title) + '.pdf';
    if (bucketSet.has(t1)) {
      matched.push({ song: s, tier: 1, key: t1 });
      if (t2 !== t1 && bucketSet.has(t2)) duplicates.push({ song: s, winner: t1, loser: t2 });
    } else if (bucketSet.has(t2)) {
      matched.push({ song: s, tier: 2, key: t2 });
    } else {
      leftover.push({ song: s, t1, t2 });
    }
  }

  // ── Tier 3 loose by title over UNCLAIMED files (unique file & unique song) ──
  const claimed = new Set(matched.map((m) => m.key));
  const unclaimedLoose = new Map();
  for (const f of bucketNames) {
    if (claimed.has(f)) continue;
    const lk = loose(f);
    if (!unclaimedLoose.has(lk)) unclaimedLoose.set(lk, []);
    unclaimedLoose.get(lk).push(f);
  }
  const looseSongCount = new Map();
  for (const l of leftover) looseSongCount.set(loose(l.song.title), (looseSongCount.get(loose(l.song.title)) || 0) + 1);
  const afterT3 = [];
  for (const l of leftover) {
    const lk = loose(l.song.title);
    const files = unclaimedLoose.get(lk) || [];
    if (files.length === 1 && (looseSongCount.get(lk) || 1) === 1) {
      matched.push({ song: l.song, tier: 3, key: files[0] });
      claimed.add(files[0]);
    } else {
      afterT3.push(l);
    }
  }

  // ── Tier 4: Drive filename resolution for whatever's left ──
  const tier4 = [];
  const ambiguous = [];
  const stillUnmatched = [];
  console.log(`Resolving ${afterT3.length} leftovers via Google Drive filenames...`);
  await pool(afterT3, 3, async (l) => {
    const fid = driveFileId(l.song.sheet_music_url);
    const dname = fid ? await driveFilename(fid) : null;
    const res = dname ? matchName(dname, bucketSet, looseMap) : null;
    if (res && res.key) {
      matched.push({ song: l.song, tier: 4, key: res.key, drive: dname });
      tier4.push({ song: l.song, drive: dname, key: res.key, via: res.via });
    } else if (res && res.ambiguous) {
      ambiguous.push({ song: l.song, drive: dname, hits: res.hits });
    } else {
      stillUnmatched.push({ song: l.song, t1: l.t1, t2: l.t2, drive: dname });
    }
    process.stdout.write('.');
  });
  process.stdout.write('\n\n');

  // Attach public URLs
  for (const m of matched) m.newUrl = publicUrl(m.key);

  const finalWinning = new Set(matched.map((m) => m.key));
  const orphans = bucketNames.filter((n) => !finalWinning.has(n));
  const orphanSet = new Set(orphans);
  const orphanRefs = songs.filter((s) => {
    const u = s.sheet_music_url || '';
    if (!u.includes(BUCKET)) return false;
    return orphanSet.has(decodeURIComponent(u.split('/').pop() || ''));
  });

  const byTier = (t) => matched.filter((m) => m.tier === t).length;

  // ── Report file ──
  const L = [];
  L.push('MIGRATION DRY-RUN REPORT — songs.sheet_music_url → Supabase Storage');
  L.push(`Generated for ${songs.length} songs. ${COMMIT ? 'COMMIT run.' : 'No DB writes.'}`);
  L.push('='.repeat(70));
  L.push(`Songs (with sheet_music_url): ${songs.length}  (Drive: ${driveCount})`);
  L.push(`Bucket objects:               ${bucketNames.length}`);
  L.push(`MATCHED TOTAL:                ${matched.length}  (T1:${byTier(1)} T2:${byTier(2)} T3:${byTier(3)} T4-drive:${byTier(4)})`);
  L.push(`Ambiguous (skipped):          ${ambiguous.length}`);
  L.push(`Still unmatched (skipped):    ${stillUnmatched.length}`);
  L.push(`Orphan objects:               ${orphans.length}`);
  L.push(`Duplicate-spelling songs:     ${duplicates.length}`);
  L.push(`Orphan keys referenced by DB: ${orphanRefs.length}  (expected 0)`);
  L.push('');
  L.push('── 10 SAMPLE MAPPINGS (old → new) ──');
  for (const m of matched.slice(0, 10)) {
    L.push(`• ${m.song.title}  [Tier ${m.tier}]`);
    L.push(`    old: ${m.song.sheet_music_url}`);
    L.push(`    new: ${m.newUrl}`);
  }
  L.push('');
  L.push(`── TIER 4 DRIVE-RESOLVED (${tier4.length})  title | Drive filename | key ──`);
  for (const m of tier4) L.push(`• ${m.song.title}  |  ${m.drive}  |  ${m.key} [via T${m.via}]`);
  L.push('');
  L.push(`── AMBIGUOUS (${ambiguous.length}) ──`);
  for (const a of ambiguous) { L.push(`• ${a.song.title}  (drive: ${a.drive})`); for (const h of a.hits) L.push(`    candidate: ${h}`); }
  if (!ambiguous.length) L.push('  (none)');
  L.push('');
  L.push(`── STILL UNMATCHED (${stillUnmatched.length}) ──`);
  for (const u of stillUnmatched) L.push(`• "${u.song.title}"  (id ${u.song.id})  drive: ${u.drive ?? 'unreadable/deleted'}`);
  if (!stillUnmatched.length) L.push('  (none)');
  L.push('');
  L.push(`── DUPLICATE-SPELLING (${duplicates.length}) — canonical wins ──`);
  for (const d of duplicates) L.push(`• "${d.song.title}"  wins:${d.winner}  orphan:${d.loser}`);
  L.push('');
  L.push(`── ORPHAN OBJECTS (${orphans.length}) ──`);
  for (const o of orphans) L.push(`• ${o}`);
  await writeFile(REPORT_PATH, L.join('\n'), 'utf8');

  // ── WRITE PHASE (only with --commit) ──
  let writeResult = null;
  if (COMMIT) {
    // 1. Preflight (read-only): updated_at column must exist (viewer cache-busting).
    //    Done before the backup so an abort leaves no stray file.
    const probe = await supabase.from('songs').select('updated_at').limit(1);
    if (probe.error) {
      console.error('❌ songs.updated_at is missing — apply migration 20260710000000_songs_updated_at.sql first. Aborting (no rows written).');
      process.exit(1);
    }

    // 2. Backup ALL songs (rollback source) before any write
    const ts = Date.now();
    const backupPath = `scripts/url-backup-${ts}.json`;
    await writeFile(backupPath,
      JSON.stringify(songs.map((s) => ({ id: s.id, title: s.title, sheet_music_url: s.sheet_music_url })), null, 2),
      'utf8');
    console.log(`Backup written: ${backupPath}  (${songs.length} rows)`);

    // 3. Update matched rows (skip ambiguous + still-unmatched)
    const nowIso = new Date(ts).toISOString();
    let updated = 0; const writeFails = [];
    await pool(matched, 4, async (m) => {
      let err = null;
      for (let a = 1; a <= 4; a++) {
        const r = await supabase.from('songs')
          .update({ sheet_music_url: m.newUrl, updated_at: nowIso }).eq('id', m.song.id);
        if (!r.error) { err = null; break; }
        err = r.error;
        if (!/too many connections|rate|timeout|fetch failed|network/i.test(err.message || '')) break;
        await sleep(400 * a * a);
      }
      if (err) writeFails.push({ id: m.song.id, title: m.song.title, error: err.message });
      else { updated++; process.stdout.write('.'); }
    });
    process.stdout.write('\n');

    // 4. Verify: re-read 10 random updated rows, fetch new URLs, confirm %PDF
    const sample = [...matched].sort(() => Math.random() - 0.5).slice(0, Math.min(10, matched.length));
    const ids = sample.map((m) => m.song.id);
    const { data: reread } = await supabase.from('songs').select('id, sheet_music_url').in('id', ids);
    const rrMap = new Map((reread || []).map((r) => [r.id, r.sheet_music_url]));
    const verify = [];
    for (const m of sample) {
      const dbUrl = rrMap.get(m.song.id);
      let ok = false, head = '';
      try {
        const res = await fetch(dbUrl, { headers: { Range: 'bytes=0-4' } });
        const buf = Buffer.from(await res.arrayBuffer());
        head = buf.toString('latin1').slice(0, 5);
        ok = (res.ok || res.status === 206) && head.startsWith('%PDF') && dbUrl === m.newUrl;
      } catch (e) { head = `ERR ${e?.message || e}`; }
      verify.push({ title: m.song.title, ok, head, urlMatches: dbUrl === m.newUrl });
    }
    writeResult = { updated, writeFails, backupPath, verify };
  }

  // ── Console summary ──
  console.log('════════════ SUMMARY ════════════');
  console.log(`Mode:                 ${COMMIT ? 'COMMIT' : 'DRY RUN'}`);
  console.log(`Songs:                ${songs.length}  (Drive: ${driveCount})`);
  console.log(`Bucket objects:       ${bucketNames.length}`);
  console.log(`MATCHED TOTAL:        ${matched.length}  (T1:${byTier(1)} T2:${byTier(2)} T3:${byTier(3)} T4-drive:${byTier(4)})`);
  console.log(`Ambiguous (skipped):  ${ambiguous.length}`);
  console.log(`Still unmatched:      ${stillUnmatched.length}`);
  if (stillUnmatched.length) for (const u of stillUnmatched) console.log(`   • ${u.song.title}  (drive: ${u.drive ?? 'unreadable/deleted'})`);
  console.log(`Orphan objects:       ${orphans.length}`);
  console.log(`Orphan refs in DB:    ${orphanRefs.length}  (expected 0)`);
  console.log(`Full report → ${REPORT_PATH}`);
  if (writeResult) {
    console.log('\n──────── WRITE RESULT ────────');
    console.log(`Backup:   ${writeResult.backupPath}`);
    console.log(`Updated:  ${writeResult.updated}`);
    console.log(`Skipped:  ${ambiguous.length + stillUnmatched.length}  (ambiguous + unmatched)`);
    console.log(`Write failures: ${writeResult.writeFails.length}`);
    for (const f of writeResult.writeFails) console.log(`   ✗ ${f.title} → ${f.error}`);
    console.log('Verification (re-read row → fetch URL → %PDF):');
    for (const v of writeResult.verify) console.log(`   ${v.ok ? '✓' : '✗'} ${v.title}  head="${v.head}"${v.urlMatches ? '' : '  [URL MISMATCH]'}`);
    const allOk = writeResult.verify.length && writeResult.verify.every((v) => v.ok);
    console.log(`Verification: ${allOk ? 'PASS ✅' : 'CHECK ⚠️'}`);
  } else {
    console.log('\nNO database writes were made. Re-run with --commit to apply.');
  }
  console.log('══════════════════════════════════');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });

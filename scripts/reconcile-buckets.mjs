// READ-ONLY reconciliation of songs.sheet_music_url ↔ bucket objects.
// No writes, no deletions. node scripts/reconcile-buckets.mjs

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const BUCKET = 'choirhub_partitions';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !KEY) { console.error('❌ Missing Supabase env'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const loose = (n) =>
  n.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase().replace(/\.pdf$/, '').replace(/[^a-z0-9]/g, '');

// Decode the bucket object key from a Storage public URL.
function bucketKeyOf(url) {
  if (!url) return null;
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null; // not a Storage URL (e.g. still Google Drive)
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
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

async function main() {
  const songs = await fetchSongs();
  const bucketNames = await listBucket();
  const bucketSet = new Set(bucketNames);

  // 1. Decode each song → key
  const keyToSongs = new Map(); // key -> [song]
  const nonStorage = [];
  const missingInBucket = [];
  for (const s of songs) {
    const key = bucketKeyOf(s.sheet_music_url);
    if (!key) { nonStorage.push(s); continue; }
    if (!bucketSet.has(key)) missingInBucket.push({ s, key });
    if (!keyToSongs.has(key)) keyToSongs.set(key, []);
    keyToSongs.get(key).push(s);
  }

  const distinctKeys = keyToSongs.size;
  const referenced = new Set(keyToSongs.keys());
  const orphans = bucketNames.filter((n) => !referenced.has(n));

  // Loose index of song titles (all songs) for orphan correspondence.
  const looseTitle = new Map(); // lk -> [song]
  for (const s of songs) {
    const lk = loose(s.title);
    if (!looseTitle.has(lk)) looseTitle.set(lk, []);
    looseTitle.get(lk).push(s);
  }
  // Loose index of referenced keys (to know which songs a loose key already owns a file for)
  const sharedGroups = [...keyToSongs.entries()].filter(([, arr]) => arr.length > 1);
  const sharedSongIds = new Set(sharedGroups.flatMap(([, arr]) => arr.map((s) => s.id)));

  // ── REPORT ──
  console.log('════════ BUCKET RECONCILIATION (read-only) ════════');
  console.log(`Songs with a URL:        ${songs.length}`);
  console.log(`  → Storage-keyed:       ${songs.length - nonStorage.length}`);
  console.log(`  → NOT storage (Drive?):${nonStorage.length}`);
  console.log(`Bucket objects:          ${bucketNames.length}`);
  console.log(`DISTINCT keys used:      ${distinctKeys}`);
  console.log(`Orphan objects:          ${orphans.length}`);
  console.log(`Keys referenced but MISSING from bucket: ${missingInBucket.length}`);
  console.log('');

  if (nonStorage.length) {
    console.log(`── NON-STORAGE URLs (${nonStorage.length}) ──`);
    for (const s of nonStorage) console.log(`  • "${s.title}" → ${s.sheet_music_url}`);
    console.log('');
  }
  if (missingInBucket.length) {
    console.log(`── ⚠ SONGS POINTING AT A MISSING KEY (${missingInBucket.length}) ──`);
    for (const m of missingInBucket) console.log(`  • "${m.s.title}" → ${m.key}`);
    console.log('');
  }

  // 2. Shared-key groups
  console.log(`── (2) SHARED-KEY GROUPS — ${sharedGroups.length} key(s) used by >1 song ──`);
  if (!sharedGroups.length) console.log('  (none — all keys distinct)');
  for (const [key, arr] of sharedGroups) {
    console.log(`  • FILE: ${key}`);
    for (const s of arr) console.log(`       ← "${s.title}"  (id ${s.id})`);
  }
  console.log('');

  // 3. Orphans + loose correspondence
  console.log(`── (3) ORPHAN OBJECTS (${orphans.length}) — loose match to song titles ──`);
  const orphanInfo = orphans.map((o) => {
    const matches = looseTitle.get(loose(o)) || [];
    return { orphan: o, matches };
  });
  for (const oi of orphanInfo) {
    if (oi.matches.length) {
      console.log(`  • ${oi.orphan}`);
      for (const s of oi.matches) {
        const canonicalKey = bucketKeyOf(s.sheet_music_url);
        const shared = sharedSongIds.has(s.id) ? '  ⚠SHARED-KEY SONG' : '';
        console.log(`       ~ "${s.title}"  (its file: ${canonicalKey})${shared}`);
      }
    } else {
      console.log(`  • ${oi.orphan}   (NO song loosely matches — bucket-only)`);
    }
  }
  console.log('');

  // 4. Cross-check: any orphan that could be the rightful file of a SHARED-KEY song
  console.log('── (4) CROSS-CHECK — orphan that may be a shared-key song’s rightful file ──');
  const flags = [];
  for (const oi of orphanInfo) {
    for (const s of oi.matches) {
      if (sharedSongIds.has(s.id)) {
        flags.push({ orphan: oi.orphan, song: s, group: keyToSongs.get(bucketKeyOf(s.sheet_music_url)) });
      }
    }
  }
  if (!flags.length) {
    console.log('  ✅ None. Every orphan loosely matches only songs that ALREADY own a');
    console.log('     distinct (non-shared) file — so the orphans are pure duplicate');
    console.log('     spellings, safe to delete without losing any song’s content.');
  } else {
    console.log('  ⚠ REVIEW THESE before deleting — an orphan may hold distinct content:');
    for (const f of flags) {
      console.log(`  • orphan "${f.orphan}" ~ shared-key song "${f.song.title}"`);
      console.log(`       that song currently shares "${bucketKeyOf(f.song.sheet_music_url)}" with:`);
      for (const g of f.group) if (g.id !== f.song.id) console.log(`          - "${g.title}"`);
    }
  }
  console.log('');

  // ── DELETION (only with --confirm-delete) ──
  // Delete ONLY duplicate-spelling orphans (loosely match a living song).
  // Bucket-only orphans (no song match) and any referenced key are NEVER touched.
  const deletable = orphanInfo.filter((oi) => oi.matches.length > 0).map((oi) => oi.orphan);
  const keepBucketOnly = orphanInfo.filter((oi) => oi.matches.length === 0).map((oi) => oi.orphan);
  const toDelete = deletable.filter((k) => !referenced.has(k)); // belt-and-suspenders

  const CONFIRM = process.argv.includes('--confirm-delete');
  console.log(`── DELETION — duplicate-spelling orphans: ${toDelete.length}, bucket-only kept: ${keepBucketOnly.length} ──`);
  if (flags.length) {
    console.log('  ✋ ABORTED: cross-check (4) flagged shared-key overlaps. Not deleting.');
  } else if (!CONFIRM) {
    console.log('  DRY RUN (pass --confirm-delete to remove these):');
    for (const k of toDelete) console.log(`     would delete: ${k}`);
    console.log(`  Keeping (bucket-only, untouched): ${keepBucketOnly.join(', ')}`);
  } else {
    for (const k of toDelete) console.log(`     ✗ deleting: ${k}`);
    const { data, error } = await supabase.storage.from(BUCKET).remove(toDelete);
    if (error) { console.error('  Delete error:', error.message); process.exit(1); }
    console.log(`  Removed: ${data?.length ?? 0} object(s)`);
    console.log(`  Kept (bucket-only, untouched): ${keepBucketOnly.join(', ')}`);
    const after = await listBucket();
    console.log(`\n  FINAL bucket count: ${after.length}  (expected ${distinctKeys + keepBucketOnly.length})`);
  }
  console.log('═══════════════════════════════════════════════════');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });

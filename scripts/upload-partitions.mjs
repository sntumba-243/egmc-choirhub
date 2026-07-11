// Bulk-upload local sheet-music PDFs to the Supabase Storage bucket
// 'choirhub_partitions'. Requires a service_role key (write access) in
// .env.local as SUPABASE_SERVICE_ROLE_KEY.
//
// Usage: node scripts/upload-partitions.mjs ["/path/to/folder"]
// Default folder: ~/Downloads/EGMC Choir Sheet Music

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

dotenv.config({ path: '.env.local' });

const BUCKET = 'choirhub_partitions';
const CONCURRENCY = 4;
const MAX_RETRIES = 4; // for transient "Too many connections" errors
const DEFAULT_DIR = path.join(os.homedir(), 'Downloads', 'EGMC Choir Sheet Music');
const FOLDER = process.argv[2] || DEFAULT_DIR;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL missing from .env.local');
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error(
    '❌ SUPABASE_SERVICE_ROLE_KEY missing from .env.local.\n' +
      '   Add it (the key is write-scoped — keep it out of git; .env.local is gitignored):\n' +
      "   printf '\\nSUPABASE_SERVICE_ROLE_KEY=YOUR_KEY\\n' >> .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// TWO-TIER SANITIZATION — the bucket key for a song can be produced by EITHER of
// these rules. Uploads apply TIER 1 first and fall back to TIER 2 only when the
// storage API rejects the key ("Invalid key"). Most files use Tier 1.
//
// ⚠️ The dry-run matcher (migrate-song-urls) MUST try these in the SAME order —
//    Tier 1 (standard) first, then Tier 2 (strict) — or the ~27 songs whose
//    titles contain a curly apostrophe (’ U+2019), ligature (œ), '!' etc. will
//    never match their bucket file. Keep the two rules below in sync with it.
//
// TIER 1 — standard (matches the n8n pipeline): strip combining diacritics,
//          spaces → '_'. Preserves punctuation, so it can emit keys the storage
//          API rejects (e.g. “C’est…” → "C’est…", which is an Invalid key).
function sanitizeStandard(name) {
  return name
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '') // strip combining diacritics
    .replace(/\s/g, '_');
}

// TIER 2 — strict fallback: also replace ANY char outside [a-zA-Z0-9._-] with
//          '_' and collapse runs of '_'. Guarantees a storage-safe key.
function sanitizeStrict(name) {
  return name
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}
// ─────────────────────────────────────────────────────────────────────────────

// Upload a buffer under `key`, retrying only transient connection/rate errors.
async function uploadWithRetry(key, buffer) {
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (!error) return null;
    lastErr = error;
    if (!/too many connections|rate|timeout|fetch failed|network/i.test(error.message || '')) break;
    await new Promise((r) => setTimeout(r, 400 * attempt * attempt)); // backoff
  }
  return lastErr;
}

// Recursively collect *.pdf files
async function findPdfs(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await findPdfs(full)));
    else if (e.isFile() && /\.pdf$/i.test(e.name)) out.push(full);
  }
  return out;
}

// Simple fixed-size async pool
async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

async function main() {
  console.log(`Folder: ${FOLDER}`);
  console.log(`Bucket: ${BUCKET}\n`);

  const files = await findPdfs(FOLDER);
  console.log(`PDFs found: ${files.length}\n`);
  if (!files.length) {
    console.log('Nothing to upload.');
    return;
  }

  const failures = [];
  const uploaded = []; // { key, tier } that succeeded
  let strictCount = 0;
  let done = 0;

  await pool(files, CONCURRENCY, async (fullPath) => {
    const base = path.basename(fullPath);
    let key = sanitizeStandard(base);
    try {
      const buffer = await readFile(fullPath);
      let err = await uploadWithRetry(key, buffer);
      let tier = 'standard';
      // Tier-2 fallback: only when the standard key is rejected as invalid.
      if (err && /invalid key/i.test(err.message || '')) {
        key = sanitizeStrict(base);
        err = await uploadWithRetry(key, buffer);
        tier = 'strict';
      }
      if (err) throw err;
      uploaded.push({ key, tier });
      if (tier === 'strict') strictCount++;
    } catch (err) {
      failures.push({ file: base, key, error: err?.message || String(err) });
    } finally {
      done++;
      if (done % 10 === 0) process.stdout.write('.');
    }
  });

  process.stdout.write('\n\n');

  // ── List all objects in the bucket (paginated) ──
  async function bucketNames() {
    const names = [];
    const limit = 1000;
    for (let offset = 0; ; offset += limit) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      for (const o of data || []) if (o.id !== null) names.push(o.name); // skip folder rows
      if (!data || data.length < limit) break;
    }
    return names;
  }
  let bucketList = null;
  let bucketErr = null;
  try { bucketList = await bucketNames(); } catch (e) { bucketErr = e?.message || String(e); }
  const bucketTotal = bucketList ? bucketList.length : `ERROR: ${bucketErr}`;

  // Reconcile: every key this run intended to write (uploaded ∪ failed) = the
  // 485 expected keys. Anything else in the bucket is a pre-existing orphan.
  const expected = new Set([...uploaded.map((u) => u.key), ...failures.map((f) => f.key)]);
  const orphans = bucketList ? bucketList.filter((n) => !expected.has(n)) : [];
  const missing = bucketList ? [...expected].filter((k) => !bucketList.includes(k)) : [];

  // ── VERIFY: 3 random successful uploads must start with %PDF ──
  const verification = [];
  const sample = [...uploaded].map((u) => u.key).sort(() => Math.random() - 0.5).slice(0, Math.min(3, uploaded.length));
  for (const key of sample) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    const publicUrl = data.publicUrl; // already URL-encoded
    let head = '';
    let method = 'public URL';
    let ok = false;
    try {
      const res = await fetch(publicUrl, { headers: { Range: 'bytes=0-4' } });
      if (res.ok || res.status === 206) {
        const buf = Buffer.from(await res.arrayBuffer());
        head = buf.toString('latin1').slice(0, 5);
        ok = head.startsWith('%PDF');
      } else {
        // Bucket likely private — fall back to an authenticated download
        method = `authenticated download (public URL returned ${res.status})`;
        const dl = await supabase.storage.from(BUCKET).download(key);
        if (dl.error) throw dl.error;
        const buf = Buffer.from(await dl.data.arrayBuffer());
        head = buf.toString('latin1').slice(0, 5);
        ok = head.startsWith('%PDF');
      }
    } catch (err) {
      head = `ERROR: ${err?.message || String(err)}`;
    }
    verification.push({ key, method, head, ok });
  }

  // ── REPORT ──
  console.log('═══════════════ REPORT ═══════════════');
  console.log(`PDFs found:      ${files.length}`);
  console.log(`Uploaded:        ${uploaded.length}  (standard: ${uploaded.length - strictCount}, strict: ${strictCount})`);
  console.log(`Failed:          ${failures.length}`);
  console.log(`Bucket objects:  ${bucketTotal}  (expected 485)`);
  console.log(`Orphans (in bucket, not from these 485): ${orphans.length}`);
  console.log(`Missing (expected but not in bucket):    ${missing.length}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ✗ ${f.file}  →  ${f.error}`);
  }
  if (orphans.length) {
    // Classify each orphan: is it just a different spelling of one of the 485
    // source files (safe duplicate), or a bucket-only object with no local PDF?
    const loose = (s) =>
      s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
        .toLowerCase().replace(/\.pdf$/, '').replace(/[^a-z0-9]/g, '');
    const sourceLoose = new Set(files.map((f) => loose(path.basename(f))));
    let dupCount = 0;
    console.log('\nOrphan bucket objects (pre-existing / non-matching keys):');
    for (const n of orphans) {
      const dup = sourceLoose.has(loose(n));
      if (dup) dupCount++;
      console.log(`  • ${n}  ${dup ? '(duplicate of an uploaded song)' : '(BUCKET-ONLY — no local PDF)'}`);
    }
    console.log(`  → ${dupCount}/${orphans.length} are duplicate spellings; ${orphans.length - dupCount} are bucket-only.`);
  }
  if (missing.length) {
    console.log('\nMissing expected keys:');
    for (const k of missing) console.log(`  • ${k}`);
  }
  console.log('\nVerification (first 5 bytes must be %PDF):');
  if (!verification.length) console.log('  (no successful uploads to verify)');
  for (const v of verification) {
    console.log(`  ${v.ok ? '✓' : '✗'} ${v.key}  [${v.method}]  head="${v.head}"`);
  }
  const allVerified = verification.length > 0 && verification.every((v) => v.ok);
  console.log(`\nVerification result: ${allVerified ? 'PASS ✅' : 'CHECK ⚠️'}`);
  console.log('═══════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

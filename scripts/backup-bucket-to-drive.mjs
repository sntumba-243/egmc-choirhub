// Weekly ADDITIVE backup: choirhub_partitions bucket → a Google Drive folder.
//   node scripts/backup-bucket-to-drive.mjs
//
// READ-ONLY on Supabase. NEVER deletes from Drive — so files removed from the
// bucket stay archived in Drive. Uploads missing files; re-uploads when the size
// differs; skips unchanged files.
//
// Auth (all optional together): GOOGLE_SERVICE_ACCOUNT_JSON (full key contents)
// + DRIVE_BACKUP_FOLDER_ID. If either is missing → log + exit 0. If present and
// any upload fails → exit 1 (loud-failure policy).

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { Readable } from 'node:stream';

dotenv.config({ path: '.env.local' });

const BUCKET = 'choirhub_partitions';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const FOLDER_ID = process.env.DRIVE_BACKUP_FOLDER_ID;

if (!SUPABASE_URL || !KEY) { console.error('❌ Missing Supabase env'); process.exit(1); }

// Drive credentials are optional — skip cleanly (success) if absent.
if (!SA_JSON || !FOLDER_ID) {
  console.log('Drive backup skipped (no credentials)');
  process.exit(0);
}

let creds;
try {
  creds = JSON.parse(SA_JSON);
} catch (e) {
  console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON:', e.message);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });
const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive'] });
const drive = google.drive({ version: 'v3', auth });

async function listBucket() {
  const objs = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET)
      .list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`bucket list: ${error.message}`);
    for (const o of data || []) if (o.id !== null) objs.push({ name: o.name, size: Number(o.metadata?.size ?? 0) });
    if (!data || data.length < 1000) break;
  }
  return objs;
}

// name -> { id, size }. supportsAllDrives/includeItemsFromAllDrives so a Shared
// Drive folder works too (recommended, since service accounts have no My Drive quota).
async function listDriveFolder() {
  const map = new Map();
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, size)',
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });
    for (const f of res.data.files || []) map.set(f.name, { id: f.id, size: Number(f.size ?? -1) });
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return map;
}

async function bucketBuffer(name) {
  const { data, error } = await supabase.storage.from(BUCKET).download(name);
  if (error) throw new Error(`download ${name}: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function main() {
  const [objs, driveMap] = await Promise.all([listBucket(), listDriveFolder()]);
  console.log(`Bucket objects: ${objs.length}  |  Drive folder files: ${driveMap.size}`);

  let uploaded = 0, updated = 0, skipped = 0, failed = 0;

  for (const o of objs) {
    const existing = driveMap.get(o.name);
    try {
      if (!existing) {
        await drive.files.create({
          requestBody: { name: o.name, parents: [FOLDER_ID] },
          media: { mimeType: 'application/pdf', body: Readable.from(await bucketBuffer(o.name)) },
          fields: 'id',
          supportsAllDrives: true,
        });
        uploaded++;
        console.log(`  + uploaded: ${o.name}`);
      } else if (existing.size !== o.size) {
        await drive.files.update({
          fileId: existing.id,
          media: { mimeType: 'application/pdf', body: Readable.from(await bucketBuffer(o.name)) },
          supportsAllDrives: true,
        });
        updated++;
        console.log(`  ~ updated (size ${existing.size}→${o.size}): ${o.name}`);
      } else {
        skipped++;
      }
    } catch (e) {
      failed++;
      console.error(`  ✗ FAILED: ${o.name} — ${e.message}`);
    }
  }

  console.log('\n── Drive backup summary ──');
  console.log(`uploaded=${uploaded}  updated=${updated}  skipped=${skipped}  failed=${failed}`);
  console.log('(additive — Drive files are never deleted, so bucket-removed files stay archived)');

  if (failed > 0) {
    console.error(`❌ ${failed} upload(s) failed — exiting non-zero.`);
    process.exit(1);
  }
  console.log('Drive backup complete ✅');
}

main().catch((e) => { console.error('Fatal:', e.message || e); process.exit(1); });

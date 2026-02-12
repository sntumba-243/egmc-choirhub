import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'profiles',
  'events', 
  'songs',
  'event_songs',
  'rsvps',
  'event_attendance',  // Fixed: was 'attendance'
  'user_favorites'     // Fixed: was 'favorites'
];

async function backupTable(tableName) {
  console.log(`Backing up ${tableName}...`);
  const { data, error } = await supabase.from(tableName).select('*');
  
  if (error) {
    console.error(`Error backing up ${tableName}:`, error);
    return null;
  }
  
  return { table: tableName, rows: data, count: data?.length || 0 };
}

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupData = {
    timestamp,
    tables: {}
  };

  for (const table of tables) {
    const result = await backupTable(table);
    if (result) {
      backupData.tables[table] = result.rows;
      console.log(`✓ ${table}: ${result.count} rows`);
    }
  }

  const filename = `backup-${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));
  console.log(`\n✅ Backup completed: ${filename}`);
}

backup();

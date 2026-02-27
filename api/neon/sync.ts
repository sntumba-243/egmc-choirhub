import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';

const TABLES = [
  'churches', 'members', 'users', 'songs', 'church_song_status',
  'events', 'event_songs', 'event_rsvps', 'event_user_access',
  'messages', 'message_reads', 'attendance_history',
  'user_favorites', 'song_favorites', 'song_submissions',
  'recordings', 'exercise_assignments', 'smart_coach_exercises'
];

// Sync order matters for foreign keys
const SYNC_ORDER = [
  'churches', 'songs', 'members', 'users', 'church_song_status',
  'events', 'event_songs', 'event_rsvps', 'event_user_access',
  'messages', 'message_reads', 'attendance_history',
  'user_favorites', 'song_favorites', 'song_submissions',
  'recordings', 'exercise_assignments', 'smart_coach_exercises'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const neonPool = new Pool({
    connectionString: process.env.NEON_CONNECTION_STRING,
  });

  const results: Record<string, { rows: number; status: string }> = {};

  try {
    for (const table of SYNC_ORDER) {
      try {
        // Fetch all data from Supabase
        const { data, error } = await supabase.from(table).select('*');
        
        if (error) {
          results[table] = { rows: 0, status: `Error reading: ${error.message}` };
          continue;
        }

        if (!data || data.length === 0) {
          results[table] = { rows: 0, status: 'Empty table' };
          continue;
        }

        // Disable FK constraints temporarily
        await neonPool.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`);
        
        // Clear existing data
        await neonPool.query(`DELETE FROM "${table}"`);

        // Batch insert (chunks of 100)
        const chunkSize = 100;
        let inserted = 0;

        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const keys = Object.keys(chunk[0]);
          const colNames = keys.map(k => `"${k}"`).join(', ');

          for (const row of chunk) {
            const values = keys.map(k => row[k]);
            const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
            
            try {
              await neonPool.query(
                `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
              );
              inserted++;
            } catch (insertErr: any) {
              // Skip rows with constraint violations
              console.error(`Skip row in ${table}:`, insertErr.message);
            }
          }
        }

        // Re-enable constraints
        await neonPool.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`);

        results[table] = { rows: inserted, status: 'OK' };
      } catch (tableErr: any) {
        results[table] = { rows: 0, status: `Error: ${tableErr.message}` };
        // Re-enable triggers on error
        try { await neonPool.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`); } catch {}
      }
    }

    await neonPool.end();

    return res.json({
      success: true,
      syncedAt: new Date().toISOString(),
      tables: results,
    });
  } catch (error: any) {
    await neonPool.end();
    return res.status(500).json({ error: error.message });
  }
}

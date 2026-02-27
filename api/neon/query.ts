import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
  connectionString: process.env.NEON_CONNECTION_STRING,
});

// Allowed tables to prevent SQL injection
const ALLOWED_TABLES = [
  'attendance_history', 'church_song_status', 'churches', 'event_rsvps',
  'event_songs', 'event_user_access', 'events', 'exercise_assignments',
  'members', 'message_reads', 'messages', 'profiles', 'recordings',
  'smart_coach_exercises', 'song_favorites', 'song_submissions', 'songs',
  'user_favorites', 'users'
];

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

function buildWhereClause(filters: any[]): { clause: string; values: any[] } {
  if (!filters || filters.length === 0) return { clause: '', values: [] };
  
  const conditions: string[] = [];
  const values: any[] = [];
  
  filters.forEach((f, i) => {
    const col = sanitizeIdentifier(f.column);
    const op = ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'ILIKE', 'IN', 'IS'].includes(f.operator) 
      ? f.operator : '=';
    
    if (op === 'IN' && Array.isArray(f.value)) {
      const placeholders = f.value.map((_: any, j: number) => `$${values.length + j + 1}`).join(', ');
      conditions.push(`"${col}" IN (${placeholders})`);
      values.push(...f.value);
    } else if (op === 'IS' && f.value === null) {
      conditions.push(`"${col}" IS NULL`);
    } else {
      values.push(f.value);
      conditions.push(`"${col}" ${op} $${values.length}`);
    }
  });
  
  return { clause: `WHERE ${conditions.join(' AND ')}`, values };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, table, columns, filters, order, limit, data, onConflict } = req.body;
  
  // Validate table
  const cleanTable = sanitizeIdentifier(table);
  if (!ALLOWED_TABLES.includes(cleanTable)) {
    return res.status(400).json({ error: `Table '${cleanTable}' not allowed` });
  }

  try {
    switch (action) {
      case 'select': {
        const cols = columns === '*' ? '*' : columns.split(',').map((c: string) => `"${sanitizeIdentifier(c.trim())}"`).join(', ');
        const { clause, values } = buildWhereClause(filters);
        let sql = `SELECT ${cols} FROM "${cleanTable}" ${clause}`;
        if (order) sql += ` ORDER BY "${sanitizeIdentifier(order.column)}" ${order.ascending === false ? 'DESC' : 'ASC'}`;
        if (limit) sql += ` LIMIT ${parseInt(limit)}`;
        
        const result = await pool.query(sql, values);
        return res.json({ data: result.rows, error: null });
      }
      
      case 'count': {
        const { clause, values } = buildWhereClause(filters);
        const sql = `SELECT COUNT(*) as count FROM "${cleanTable}" ${clause}`;
        const result = await pool.query(sql, values);
        return res.json({ count: parseInt(result.rows[0].count), error: null });
      }
      
      case 'insert': {
        if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Missing data' });
        const keys = Object.keys(data).map(sanitizeIdentifier);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO "${cleanTable}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await pool.query(sql, values);
        return res.json({ data: result.rows[0], error: null });
      }
      
      case 'update': {
        if (!data || !filters?.length) return res.status(400).json({ error: 'Missing data or filters' });
        const keys = Object.keys(data).map(sanitizeIdentifier);
        const values = Object.values(data);
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const { clause, values: whereValues } = buildWhereClause(filters);
        // Offset parameter indices
        const offsetClause = clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + values.length}`);
        const sql = `UPDATE "${cleanTable}" SET ${setClauses} ${offsetClause} RETURNING *`;
        const result = await pool.query(sql, [...values, ...whereValues]);
        return res.json({ data: result.rows, error: null });
      }
      
      case 'delete': {
        const { clause, values } = buildWhereClause(filters);
        if (!clause) return res.status(400).json({ error: 'Delete requires filters' });
        const sql = `DELETE FROM "${cleanTable}" ${clause} RETURNING *`;
        const result = await pool.query(sql, values);
        return res.json({ data: result.rows, error: null });
      }
      
      case 'upsert': {
        if (!data || !onConflict) return res.status(400).json({ error: 'Missing data or onConflict' });
        const keys = Object.keys(data).map(sanitizeIdentifier);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const updateClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const conflictCols = onConflict.split(',').map((c: string) => `"${sanitizeIdentifier(c.trim())}"`).join(', ');
        const sql = `INSERT INTO "${cleanTable}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateClauses} RETURNING *`;
        const result = await pool.query(sql, values);
        return res.json({ data: result.rows[0], error: null });
      }
      
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    console.error('Neon query error:', error);
    return res.status(500).json({ error: error.message });
  }
}

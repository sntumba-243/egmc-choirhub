#!/bin/bash
# Sync Supabase → Neon Database
# Run: ./scripts/sync-to-neon.sh
# Schedule: cron every 6 hours

set -e

# Config - update these
SUPABASE_DB="postgresql://postgres.lpcepycxqfqzwwszmpks:YOUR_SUPABASE_DB_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
NEON_DB="postgresql://neondb_owner:npg_lJBAh2Uv0oIe@ep-soft-union-ainruaiw-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"

TABLES=(
  "churches"
  "members"
  "users"
  "songs"
  "church_song_status"
  "events"
  "event_songs"
  "event_rsvps"
  "event_user_access"
  "messages"
  "message_reads"
  "attendance_history"
  "user_favorites"
  "song_favorites"
  "song_submissions"
  "recordings"
  "exercise_assignments"
  "smart_coach_exercises"
)

DUMP_FILE="/tmp/supabase_dump_$(date +%Y%m%d_%H%M%S).sql"

echo "🔄 Starting Supabase → Neon sync at $(date)"

# Step 1: Dump schema + data from Supabase
echo "📦 Dumping Supabase tables..."
TABLE_ARGS=""
for t in "${TABLES[@]}"; do
  TABLE_ARGS="$TABLE_ARGS -t public.$t"
done

pg_dump "$SUPABASE_DB" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --no-comments \
  $TABLE_ARGS \
  > "$DUMP_FILE"

echo "📄 Dump size: $(du -h $DUMP_FILE | cut -f1)"

# Step 2: Restore to Neon
echo "🚀 Restoring to Neon..."
psql "$NEON_DB" < "$DUMP_FILE"

# Step 3: Cleanup
rm -f "$DUMP_FILE"

echo "✅ Sync completed at $(date)"
echo "📊 Table counts in Neon:"
for t in "${TABLES[@]}"; do
  COUNT=$(psql "$NEON_DB" -t -c "SELECT COUNT(*) FROM public.$t" 2>/dev/null || echo "ERROR")
  echo "   $t: $COUNT"
done

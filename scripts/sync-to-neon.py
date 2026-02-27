import json, subprocess, urllib.request, sys

ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY2VweWN4cWZxend3c3ptcGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MzE5MzcsImV4cCI6MjA3NzAwNzkzN30.AY5xmu5CYZN6kV-pSyyoCb3LHzPKJQ6WIExX5N8nm64"
BASE = "https://lpcepycxqfqzwwszmpks.supabase.co/rest/v1"
NEON = "postgresql://neondb_owner:npg_lJBAh2Uv0oIe@ep-soft-union-ainruaiw-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"

TABLES = [
    "churches", "songs", "members", "users", "church_song_status",
    "events", "event_songs", "event_rsvps", "event_user_access",
    "messages", "message_reads", "attendance_history",
    "user_favorites", "song_favorites", "song_submissions",
    "recordings", "exercise_assignments", "smart_coach_exercises"
]

def fetch_table(table):
    url = f"{BASE}/{table}?limit=10000"
    req = urllib.request.Request(url, headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Accept": "application/json"
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  Error fetching {table}: {e}")
        return []

def escape_val(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("'", "''")
    return f"'{s}'"

def generate_sql(table, data):
    if not data:
        return ""
    keys = list(data[0].keys())
    col_str = ", ".join(f'"{k}"' for k in keys)
    sqls = []
    for i in range(0, len(data), 50):
        chunk = data[i:i+50]
        rows = []
        for row in chunk:
            vals = ", ".join(escape_val(row.get(k)) for k in keys)
            rows.append(f"({vals})")
        sqls.append(f'INSERT INTO "{table}" ({col_str}) VALUES\n' + ",\n".join(rows) + "\nON CONFLICT DO NOTHING;")
    return "\n".join(sqls)

def run_psql(sql):
    proc = subprocess.run(
        ["psql", NEON, "-c", sql],
        capture_output=True, text=True,
        env={"PGPASSWORD": "npg_lJBAh2Uv0oIe", "PATH": "/usr/local/bin:/usr/bin:/bin"}
    )
    return proc.returncode == 0, proc.stderr

def count_neon(table):
    proc = subprocess.run(
        ["psql", NEON, "-t", "-c", f'SELECT COUNT(*) FROM "{table}"'],
        capture_output=True, text=True,
        env={"PGPASSWORD": "npg_lJBAh2Uv0oIe", "PATH": "/usr/local/bin:/usr/bin:/bin"}
    )
    return proc.stdout.strip() if proc.returncode == 0 else "?"

for table in TABLES:
    print(f"🔄 Syncing {table}...")
    data = fetch_table(table)
    
    if not data:
        print(f"  ⏭ empty, skipping")
        continue
    
    sql = generate_sql(table, data)
    sql_file = f"/tmp/sync_{table}.sql"
    with open(sql_file, "w") as f:
        f.write(sql)
    
    proc = subprocess.run(
        ["psql", NEON, "-f", sql_file],
        capture_output=True, text=True,
        env={"PGPASSWORD": "npg_lJBAh2Uv0oIe", "PATH": "/usr/local/bin:/usr/bin:/bin"}
    )
    
    if proc.returncode == 0:
        neon_count = count_neon(table)
        print(f"  ✅ {len(data)} from Supabase → {neon_count} in Neon")
    else:
        print(f"  ❌ Error: {proc.stderr[:200]}")

print("\n🎉 Sync complete!")

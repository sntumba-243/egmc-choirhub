# Neon Backup Database Setup

## Overview
Neon PostgreSQL serves as a backup database when Supabase is down or experiencing issues.

## Configuration

### Environment Variables (.env)
```
VITE_NEON_CONNECTION=postgresql://neondb_owner:npg_lJBAh2Uv0oIe@ep-soft-union-ainruaiw-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
VITE_USE_NEON=false  # Set to 'true' to use Neon instead of Supabase
```

## Usage

### Normal Operation (Supabase)
```bash
# In .env
VITE_USE_NEON=false

# Start app normally
npm run dev
```

### Failover to Neon
```bash
# In .env
VITE_USE_NEON=true

# Start Neon API server (Terminal 1)
npm run neon:server

# Start app (Terminal 2)
npm run dev
```

## Data Synchronization

### Export Supabase data to Neon
```bash
npm run neon:export
```

Run this periodically (weekly/monthly) to keep Neon backup current.

## Test Accounts
- **Admin**: admin@test.com / test123
- **Member**: soprano@test.com / test123

## Architecture
- **Supabase**: Primary database + authentication
- **Neon**: Backup database (no auth)
- **neon-server.js**: API bridge between app and Neon
- **neonClient.ts**: Supabase-compatible query builder for Neon

## Limitations of Neon Backup
- ⚠️ Custom auth (not Supabase Auth) - temporary
- ⚠️ No real-time subscriptions
- ⚠️ No storage (file uploads)
- ✅ All CRUD operations work
- ✅ Events, songs, members, RSVPs

## Files
- `neon-server.js` - API server for Neon
- `src/lib/neonClient.ts` - Query builder
- `src/lib/neonAuth.ts` - Authentication
- `export_supabase_to_neon.js` - Data export script

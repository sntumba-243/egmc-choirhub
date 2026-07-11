import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Local runs read creds from .env.local (repo convention); CI injects them
// via the workflow `env:` block, where these files are absent (no-op).
dotenv.config({ path: '.env.local' })
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const BASE = 'https://egmc.vercel.app'

const { data: songs, error } = await supabase
  .from('songs')
  .select('id, title, sheet_music_url')
  .not('sheet_music_url', 'is', null)

if (error) { console.error(error); process.exit(1) }

console.log('Warming cache for ' + songs.length + ' songs...')
let ok = 0, failed = 0

// 5 at a time to be polite to Drive
for (let i = 0; i < songs.length; i += 5) {
  const batch = songs.slice(i, i + 5)
  await Promise.all(batch.map(async (song) => {
    const match = (song.sheet_music_url || '').match(/drive\.google\.com\/file\/d\/([^/]+)/)
    if (!match) return
    try {
      const res = await fetch(BASE + '/api/pdf-proxy?fileId=' + match[1], { method: 'GET' })
      if (res.ok) { ok++; process.stdout.write('.') }
      else { failed++; console.log('\n✗ ' + song.title + ' (' + res.status + ')') }
    } catch (e) { failed++; console.log('\n✗ ' + song.title) }
  }))
}
console.log('\nDone: ' + ok + ' warmed, ' + failed + ' failed')

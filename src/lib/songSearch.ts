import Fuse from 'fuse.js'

// Same normalization family as our filename sanitizer — strip accents, lowercase.
// So "jésus" and "jesus" are equal, and typos are tolerated by Fuse below.
export const normalize = (s: string) =>
  (s || '').normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase()

export function createSongSearcher<T extends { title: string; composer?: string | null }>(songs: T[]) {
  const indexed = songs.map(s => ({
    ...s,
    _ntitle: normalize(s.title),
    _ncomposer: normalize(s.composer || ''),
  }))
  const fuse = new Fuse(indexed, {
    keys: [
      { name: '_ntitle', weight: 0.8 },
      { name: '_ncomposer', weight: 0.2 },
    ],
    threshold: 0.35, // typo tolerance without garbage matches
    ignoreLocation: true, // match anywhere in the title
    minMatchCharLength: 2,
  })
  return (query: string): T[] => {
    const q = normalize(query.trim())
    if (!q) return songs
    // Fuse v7 results are { item, refIndex, score }, relevance-ranked (best first).
    return fuse.search(q).map(r => r.item as T)
  }
}

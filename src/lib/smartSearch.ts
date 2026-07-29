import Fuse from 'fuse.js'

// Same normalization family as our filename sanitizer — strip accents, lowercase.
// So "jésus" and "jesus" are equal, and typos are tolerated by Fuse below.
export const normalize = (s: string) =>
  (s || '').normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase()

/**
 * One key to search on.
 * - `name`: field name, or a dot path ('churches.name'). Also the label Fuse uses internally.
 * - `weight`: relative importance (Fuse normalizes these, so 0.7/0.2/0.1 works as written).
 * - `get`: optional accessor for derived values — e.g. a full name built from
 *   first_name + last_name. Falls back to reading `name` off the item.
 */
export type SearchKey<T> = {
  name: keyof T | string
  weight?: number
  get?: (item: T) => string | string[] | null | undefined
}

// Dot-path read. Arrays collapse to their joined values so 'tags' or
// 'churches.name' both resolve to searchable text.
const readPath = (obj: any, path: string): string => {
  const value = path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj)
  if (value == null) return ''
  if (Array.isArray(value)) return value.filter(v => v != null).join(' ')
  return String(value)
}

const toText = (value: string | string[] | null | undefined): string =>
  Array.isArray(value) ? value.filter(Boolean).join(' ') : value || ''

/**
 * Fuzzy, accent-insensitive, typo-tolerant, relevance-ranked search.
 *
 * Returns a function of the query: non-empty query → Fuse results, best match
 * first; empty query → the original array in its original order (so the
 * caller's server sort / pagination is untouched when nobody is searching).
 *
 * Every key is normalized through a per-key getFn, so accent-insensitivity is
 * not something a call site can forget to opt into.
 */
export function createSearcher<T>(items: T[], keys: Array<SearchKey<T>>) {
  const fuse = new Fuse(items, {
    keys: keys.map(key => ({
      name: String(key.name),
      weight: key.weight ?? 1,
      getFn: (item: T) =>
        normalize(key.get ? toText(key.get(item)) : readPath(item, String(key.name))),
    })),
    threshold: 0.35, // typo tolerance without garbage matches
    ignoreLocation: true, // match anywhere in the field
    minMatchCharLength: 2,
  })
  return (query: string): T[] => {
    const q = normalize(query.trim())
    if (!q) return items
    // Fuse v7 results are { item, refIndex, score }, relevance-ranked (best first).
    return fuse.search(q).map(r => r.item as T)
  }
}

/** Shared key sets, so every dashboard weights the same entity the same way. */
export const MEMBER_KEYS = [
  { name: 'name', weight: 0.7, get: (m: any) => `${m.first_name || m.full_name || ''} ${m.last_name || ''}`.trim() },
  { name: 'email', weight: 0.2 },
  { name: 'voice_part', weight: 0.1 },
]

export const EVENT_KEYS = [
  { name: 'title', weight: 0.7 },
  { name: 'location', weight: 0.2 },
  { name: 'description', weight: 0.1 },
]

// Churches store their place as city/country, and people type the short name
// ("EGMC") as often as the full one — both fold into the two documented keys.
export const CHURCH_KEYS = [
  { name: 'name', weight: 0.8, get: (c: any) => [c.name, c.short_name] },
  { name: 'location', weight: 0.2, get: (c: any) => [c.location, c.city, c.country] },
]

// The column is `body` in most tables and `content` in a few — take whichever exists.
export const MESSAGE_KEYS = [
  { name: 'subject', weight: 0.7 },
  { name: 'content', weight: 0.3, get: (m: any) => m.body ?? m.content ?? m.message },
]

export const SONG_KEYS = [
  { name: 'title', weight: 0.8 },
  { name: 'composer', weight: 0.2 },
]

/** Songs — kept as a named helper because it predates the generic searcher. */
export function createSongSearcher<T extends { title: string; composer?: string | null }>(songs: T[]) {
  return createSearcher(songs, SONG_KEYS as Array<SearchKey<T>>)
}

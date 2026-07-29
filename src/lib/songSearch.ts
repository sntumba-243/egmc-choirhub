// Superseded by smartSearch.ts, which generalizes this to any entity.
// Re-exported so any remaining `from '.../lib/songSearch'` imports keep working.
export { normalize, createSongSearcher, createSearcher, SONG_KEYS } from './smartSearch'
export type { SearchKey } from './smartSearch'

/**
 * Display helpers for event times and song credits. Display-only: nothing here
 * changes what is stored.
 */

/**
 * "08:45:00" / "08:45" / "20:05" -> "8:45 AM" / "8:45 AM" / "8:05 PM".
 * Event times are stored as Postgres `time` strings (HH:MM[:SS]). Empty input
 * gives ''; anything that isn't HH:MM is returned unchanged rather than
 * mangled.
 */
export function formatEventTime(t?: string | null): string {
  if (!t) return '';
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*$/.exec(t);
  if (!m) return t;
  const hour = Number(m[1]);
  if (hour > 23) return t;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m[2]} ${ampm}`;
}

/** True when a composer is worth showing: not empty and not "Unknown". */
export function hasKnownComposer(composer?: string | null): composer is string {
  const c = (composer ?? '').trim();
  return c !== '' && c.toLowerCase() !== 'unknown';
}

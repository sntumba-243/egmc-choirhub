const DEFAULT_TZ = 'UTC';

/** Parses a date string as local time, preventing UTC timezone shift.
 *  '2026-04-04' → Apr 4 (not Apr 3 in US timezones) */
export function parseLocalDate(d: string): Date {
  if (!d) return new Date();
  if (d.includes('T')) return new Date(d);
  return new Date(d + 'T00:00:00');
}

/** Returns current Date adjusted to church timezone */
export function getChurchNow(timezone?: string): Date {
  const tz = timezone || DEFAULT_TZ;
  const nowStr = new Date().toLocaleString('en-US', { timeZone: tz });
  return new Date(nowStr);
}

/** Returns 'YYYY-MM-DD' string for today in church timezone */
export function getChurchToday(timezone?: string): string {
  const tz = timezone || DEFAULT_TZ;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts; // en-CA formats as YYYY-MM-DD
}

/** Converts a date string to YYYY-MM-DD in church timezone */
export function toChurchDate(dateStr: string, timezone?: string): string {
  const tz = timezone || DEFAULT_TZ;
  const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Returns { start, end } date strings for a period in church timezone */
export function getPeriodRange(
  period: 'week' | 'month' | 'year' | 'all',
  timezone?: string
): { start: string | null; end: string } {
  const end = getChurchToday(timezone);

  if (period === 'all') return { start: null, end };

  const now = getChurchNow(timezone);
  switch (period) {
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'month':
      now.setDate(now.getDate() - 30);
      break;
    case 'year':
      now.setDate(now.getDate() - 365);
      break;
  }

  const start = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || DEFAULT_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);

  return { start, end };
}

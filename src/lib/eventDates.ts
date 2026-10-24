// Multi-day event date helpers — the ONE place event spans are reasoned about.
//
// An event has a start `date` (YYYY-MM-DD) and an optional `end_date`
// (NULL = single day). An event is current/upcoming through its LAST day.
// Server-side, the generated column `last_date` (= end_date ?? date) is the
// filter equivalent: `.gte('last_date', today)`.

export interface EventSpan {
  date: string;
  end_date?: string | null;
}

/** Final day of the event (YYYY-MM-DD). */
export const eventEndDate = (e: EventSpan): string =>
  e.end_date && e.end_date > e.date ? e.end_date : e.date;

export const isMultiDay = (e: EventSpan): boolean => eventEndDate(e) !== e.date;

/** True when the YYYY-MM-DD day falls within the event's span (inclusive). */
export const eventCoversDay = (e: EventSpan, ymd: string): boolean =>
  e.date <= ymd && ymd <= eventEndDate(e);

/**
 * Past check honouring spans: a multi-day event is past only once its last
 * day has ended; single-day events keep the caller's existing rule.
 */
export const isEventPast = <E extends EventSpan>(
  e: E,
  singleDayIsPast: (e: E) => boolean,
  now: Date = new Date()
): boolean =>
  isMultiDay(e) ? new Date(`${eventEndDate(e)}T23:59:59`) < now : singleDayIsPast(e);

const ymdToDate = (ymd: string) => new Date(ymd + 'T00:00:00');
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', o);

/**
 * 'Oct 24 – 26' (same month), 'Oct 30 – Nov 2' (cross month),
 * 'Dec 30, 2026 – Jan 2, 2027' (cross year).
 */
export function formatDateRange(start: string, end: string): string {
  const s = ymdToDate(start);
  const e = ymdToDate(end);
  if (s.getFullYear() !== e.getFullYear()) {
    const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${fmt(s, o)} – ${fmt(e, o)}`;
  }
  if (s.getMonth() !== e.getMonth()) {
    const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${fmt(s, o)} – ${fmt(e, o)}`;
  }
  return `${fmt(s, { month: 'short', day: 'numeric' })} – ${e.getDate()}`;
}

/**
 * Event date label: the range for multi-day events, otherwise the page's
 * existing single-day format (so single-day display is unchanged).
 */
export const formatEventDates = (e: EventSpan, singleDay: (date: string) => string): string =>
  isMultiDay(e) ? formatDateRange(e.date, eventEndDate(e)) : singleDay(e.date);

/** Whole days from `todayYmd` until the event starts; 0 while it is running. */
export const daysUntilEvent = (e: EventSpan, todayYmd: string): number =>
  eventCoversDay(e, todayYmd)
    ? 0
    : Math.round((ymdToDate(e.date).getTime() - ymdToDate(todayYmd).getTime()) / 86_400_000);

/** Validation for forms: '' when OK, else a message. */
export const endDateError = (start: string, end: string): string =>
  end && start && end < start ? 'End date must be on or after the start date' : '';

/** 'Oct 24 – 26' for multi-day events, '' for single-day (for date-tile subtitles). */
export const eventRangeLabel = (e: EventSpan): string =>
  isMultiDay(e) ? formatDateRange(e.date, eventEndDate(e)) : '';

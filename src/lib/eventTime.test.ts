import { describe, it, expect } from 'vitest';
import { formatEventTime, hasKnownComposer } from './eventTime';

describe('formatEventTime', () => {
  it('formats Postgres time strings in 12-hour form', () => {
    expect(formatEventTime('08:45:00')).toBe('8:45 AM');
    expect(formatEventTime('08:45')).toBe('8:45 AM');
    expect(formatEventTime('00:00:00')).toBe('12:00 AM');
    expect(formatEventTime('12:00:00')).toBe('12:00 PM');
    expect(formatEventTime('20:05:00')).toBe('8:05 PM');
    expect(formatEventTime('23:59:59.123')).toBe('11:59 PM');
  });
  it('handles empty and unexpected input without mangling it', () => {
    expect(formatEventTime('')).toBe('');
    expect(formatEventTime(null)).toBe('');
    expect(formatEventTime(undefined)).toBe('');
    expect(formatEventTime('TBD')).toBe('TBD');
    expect(formatEventTime('25:00')).toBe('25:00');
  });
});

describe('hasKnownComposer', () => {
  it('hides empty and Unknown composers', () => {
    for (const c of [null, undefined, '', '   ', 'Unknown', 'unknown', ' UNKNOWN ']) expect(hasKnownComposer(c)).toBe(false);
    expect(hasKnownComposer('Jacques Berthier')).toBe(true);
  });
});

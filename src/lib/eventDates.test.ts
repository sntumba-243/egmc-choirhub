import { describe, it, expect } from 'vitest'
import {
  eventEndDate, isMultiDay, eventCoversDay, isEventPast, formatDateRange,
  formatEventDates, daysUntilEvent, endDateError,
} from './eventDates'

const single = { date: '2026-10-24', end_date: null, time: '18:00' }
const convention = { date: '2026-10-24', end_date: '2026-10-26', time: '09:00' }

// The single-day rule Calendar/Events use today: past once start date+time passes.
const startPassed = (e: { date: string; time: string }, now: Date) =>
  new Date(`${e.date}T${e.time}`) < now

describe('single-day events are unchanged', () => {
  it('end date is the start date', () => {
    expect(eventEndDate(single)).toBe('2026-10-24')
    expect(eventEndDate({ date: '2026-10-24' })).toBe('2026-10-24')
    expect(isMultiDay(single)).toBe(false)
  })
  it('end_date equal to date counts as single-day', () => {
    expect(isMultiDay({ date: '2026-10-24', end_date: '2026-10-24' })).toBe(false)
  })
  it('past check defers to the caller rule', () => {
    const before = new Date('2026-10-24T17:00:00')
    const after = new Date('2026-10-24T19:00:00')
    expect(isEventPast(single, e => startPassed(e, before), before)).toBe(false)
    expect(isEventPast(single, e => startPassed(e, after), after)).toBe(true)
  })
  it('formats with the page formatter', () => {
    expect(formatEventDates(single, d => `fmt(${d})`)).toBe('fmt(2026-10-24)')
  })
  it('days until: today 0, tomorrow 1, next week 7', () => {
    expect(daysUntilEvent(single, '2026-10-24')).toBe(0)
    expect(daysUntilEvent(single, '2026-10-23')).toBe(1)
    expect(daysUntilEvent(single, '2026-10-17')).toBe(7)
  })
})

describe('3-day convention (Oct 24–26)', () => {
  it('covers every day of its span, inclusive', () => {
    expect(eventCoversDay(convention, '2026-10-23')).toBe(false)
    expect(eventCoversDay(convention, '2026-10-24')).toBe(true)
    expect(eventCoversDay(convention, '2026-10-25')).toBe(true)
    expect(eventCoversDay(convention, '2026-10-26')).toBe(true)
    expect(eventCoversDay(convention, '2026-10-27')).toBe(false)
  })
  it('is still upcoming (not past) on day 2, even after its start time', () => {
    const day2 = new Date('2026-10-25T20:00:00')
    expect(isEventPast(convention, e => startPassed(e, day2), day2)).toBe(false)
  })
  it('is "next" on day 2: it survives the last_date >= today filter and sorts first by start', () => {
    const today = '2026-10-25'
    const events = [
      { id: 'rehearsal', date: '2026-10-28', end_date: null },
      { id: 'convention', ...convention },
      { id: 'old', date: '2026-10-20', end_date: null },
    ]
    const next = events
      .filter(e => eventEndDate(e) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    expect(next.id).toBe('convention')
    expect(daysUntilEvent(convention, today)).toBe(0)
  })
  it('is past only after its last day ends', () => {
    const lastEvening = new Date('2026-10-26T23:00:00')
    const dayAfter = new Date('2026-10-27T00:30:00')
    expect(isEventPast(convention, () => true, lastEvening)).toBe(false)
    expect(isEventPast(convention, () => false, dayAfter)).toBe(true)
  })
})

describe('range formatting', () => {
  it('same month', () => expect(formatDateRange('2026-10-24', '2026-10-26')).toBe('Oct 24 – 26'))
  it('cross month', () => expect(formatDateRange('2026-10-30', '2026-11-02')).toBe('Oct 30 – Nov 2'))
  it('cross year', () => expect(formatDateRange('2026-12-30', '2027-01-02')).toBe('Dec 30, 2026 – Jan 2, 2027'))
  it('multi-day events use the range, not the page formatter', () => {
    expect(formatEventDates(convention, () => 'unused')).toBe('Oct 24 – 26')
  })
})

describe('form validation', () => {
  it('empty end date is fine (single day)', () => expect(endDateError('2026-10-24', '')).toBe(''))
  it('end on or after start is fine', () => {
    expect(endDateError('2026-10-24', '2026-10-24')).toBe('')
    expect(endDateError('2026-10-24', '2026-10-26')).toBe('')
  })
  it('end before start is rejected', () => expect(endDateError('2026-10-24', '2026-10-23')).not.toBe(''))
})

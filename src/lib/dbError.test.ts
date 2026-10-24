import { describe, it, expect } from 'vitest'
import { dbErrorMessage, dbErrorReason } from './dbError'

describe('dbErrorReason', () => {
  it('turns RLS denials into plain words', () => {
    expect(dbErrorReason({ code: '42501', message: 'new row violates row-level security policy for table "event_songs"' }))
      .toBe("you don't have permission to change this")
    expect(dbErrorReason({ code: '42501' })).toBe("you don't have permission to change this")
  })
  it('names duplicates', () => expect(dbErrorReason({ code: '23505', message: 'duplicate key' })).toBe('it is already there'))
  it('passes other real messages through', () => expect(dbErrorReason({ message: 'JWT expired' })).toBe('JWT expired'))
  it('never returns empty', () => expect(dbErrorReason(undefined)).toBe('unknown error'))
  it('prefixes', () => expect(dbErrorMessage('Failed to add song', { code: '42501' }))
    .toBe("Failed to add song: you don't have permission to change this"))
})

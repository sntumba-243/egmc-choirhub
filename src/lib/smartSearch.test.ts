import { describe, it, expect } from 'vitest'
import { createSearcher, MEMBER_KEYS, EVENT_KEYS, CHURCH_KEYS, MESSAGE_KEYS, SONG_KEYS } from './smartSearch'

const members = [
  { id: '1', first_name: 'Jérémie', last_name: 'Kabongo', email: 'jeremie.k@egmc.org', voice_part: 'Ténor' },
  { id: '2', first_name: 'Marie', last_name: 'Nsimba', email: 'marie@egmc.org', voice_part: 'Soprano' },
  { id: '3', first_name: 'Joseph', last_name: 'Mbuyi', email: 'joseph@egmc.org', voice_part: 'Bass' },
]

const names = (rows: Array<{ first_name: string; last_name: string }>) =>
  rows.map(m => `${m.first_name} ${m.last_name}`)

describe('createSearcher — members', () => {
  const search = createSearcher(members, MEMBER_KEYS)

  it('finds an accented name from an unaccented query', () => {
    expect(names(search('jeremie'))[0]).toBe('Jérémie Kabongo')
  })

  it('finds an accented name from the accented query too', () => {
    expect(names(search('Jérémie'))[0]).toBe('Jérémie Kabongo')
  })

  it('tolerates a typo in the last name', () => {
    expect(names(search('kabango'))[0]).toBe('Jérémie Kabongo')
    expect(names(search('kabongo'))[0]).toBe('Jérémie Kabongo')
  })

  it('matches on email and on voice part', () => {
    expect(names(search('marie@egmc'))[0]).toBe('Marie Nsimba')
    expect(names(search('soprano'))[0]).toBe('Marie Nsimba')
    expect(names(search('tenor'))[0]).toBe('Jérémie Kabongo') // accent-folded voice part
  })

  it('ranks the better match first', () => {
    expect(names(search('mbuyi'))[0]).toBe('Joseph Mbuyi')
  })

  it('returns the original array, in order, for an empty query', () => {
    expect(search('')).toEqual(members)
    expect(search('   ')).toEqual(members)
  })

  it('returns nothing for a query that matches nothing', () => {
    expect(search('zzzzqqqq')).toEqual([])
  })
})

describe('createSearcher — other entities', () => {
  it('searches events on title, location, description', () => {
    const events = [
      { id: '1', title: 'Répétition Générale', location: 'Salle Principale', description: 'Full run-through' },
      { id: '2', title: 'Sunday Service', location: 'Sanctuary', description: 'Morning worship' },
    ]
    const search = createSearcher(events, EVENT_KEYS)
    expect(search('repetition')[0].id).toBe('1')
    expect(search('generale')[0].id).toBe('1')
    expect(search('sanctuary')[0].id).toBe('2')
    expect(search('worship')[0].id).toBe('2')
  })

  it('searches churches on name, short name, and city/country', () => {
    const churches = [
      { id: '1', name: 'Église Globale Montréal Centre', short_name: 'EGMC', city: 'Montréal', country: 'Canada' },
      { id: '2', name: 'Grace Chapel', short_name: 'GC', city: 'Toronto', country: 'Canada' },
    ]
    const search = createSearcher(churches, CHURCH_KEYS)
    expect(search('eglise')[0].id).toBe('1')
    expect(search('egmc')[0].id).toBe('1')
    expect(search('montreal')[0].id).toBe('1')
    expect(search('toronto')[0].id).toBe('2')
  })

  it('searches messages on subject and body', () => {
    const messages = [
      { id: '1', subject: 'Répétition annulée', body: 'No rehearsal tonight' },
      { id: '2', subject: 'Welcome', body: 'Bienvenue à tous' },
    ]
    const search = createSearcher(messages, MESSAGE_KEYS)
    expect(search('repetition')[0].id).toBe('1')
    expect(search('rehearsal')[0].id).toBe('1')
    expect(search('bienvenue')[0].id).toBe('2')
  })

  it('searches songs on title and composer', () => {
    const songs = [
      { id: '1', title: 'À Toi la Gloire', composer: 'Händel' },
      { id: '2', title: 'Amazing Grace', composer: 'Newton' },
    ]
    const search = createSearcher(songs, SONG_KEYS)
    expect(search('toi la gloire')[0].id).toBe('1')
    expect(search('handel')[0].id).toBe('1')
    expect(search('amazing')[0].id).toBe('2')
  })

  it('reads nested paths and derived keys', () => {
    const rows = [
      { member: { first_name: 'Jérémie', last_name: 'Kabongo', email: 'j@x.org' } },
      { member: { first_name: 'Marie', last_name: 'Nsimba', email: 'm@x.org' } },
    ]
    const search = createSearcher(rows, [
      { name: 'name', weight: 0.7, get: (r: any) => `${r.member.first_name} ${r.member.last_name}` },
      { name: 'member.email', weight: 0.3 },
    ])
    expect(search('jeremie')[0].member.last_name).toBe('Kabongo')
    expect(search('m@x.org')[0].member.last_name).toBe('Nsimba')
  })

  it('handles null and missing fields without throwing', () => {
    const rows = [{ title: 'Only Title', composer: null }, { title: null as any, composer: undefined }]
    const search = createSearcher(rows, SONG_KEYS)
    expect(() => search('title')).not.toThrow()
    expect(search('title')[0].title).toBe('Only Title')
  })
})

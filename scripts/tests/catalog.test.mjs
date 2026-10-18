// The English content catalog: every label points at something real, and the ladder engine runs on it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG, entriesFor, hasContent, pick, STATUS } from '../../src/lib/literacy/catalog.js'
import { TRACKS, start, nextProbe, record, gaps } from '../../src/lib/literacy/ladder.js'
import { BANDS, generateItem as vrItem } from '../../src/lib/englishTemplates.js'
import { SKILLS, generateItem as litItem } from '../../src/lib/literacy/engine.js'

test('every entry names a real step and a known status', () => {
  for (const e of CATALOG) {
    const n = Number(e.step.slice(e.track.length))
    assert.ok(TRACKS[e.track] && n >= 1 && n <= TRACKS[e.track], `${e.source} ${e.step}`)
    assert.ok(STATUS.includes(e.status))
  }
})

// Some generators return nothing for some seeds and the server tries the next one. Measured 2026-10-18 over 40
// seeds: most 30-40, sense 19, odd-synonym 17, suffix 8 (about 1 in 5 in every band). Each must make some.
test('every generator reference makes items', () => {
  for (const e of CATALOG.filter(x => x.kind === 'generator')) {
    let made = 0
    for (let seed = 1; seed <= 40; seed++) {
      if (e.source === 'vr-engine') {
        assert.ok(BANDS[e.ref.band]?.types.includes(e.ref.type), `${e.ref.type} is not in band ${e.ref.band}`)
        if (vrItem(e.ref.band, e.ref.type, seed * 7919)) made++
      } else {
        assert.ok(SKILLS[e.ref.skill], e.ref.skill)
        if (litItem(e.ref.skill, seed * 7919)) made++
      }
    }
    assert.ok(made >= 5, `${e.source} ${e.ref.type || e.ref.skill}${e.ref.band ? '@' + e.ref.band : ''}: ${made}/40`)
  }
})

test('nothing is approved yet, so a child screen gets nothing; the lab gets 30 of 32 steps', () => {
  assert.equal(gaps(hasContent('approved')).length, 32)
  assert.deepEqual(gaps(hasContent('draft')), ['A2', 'Ca2'])
})

test('pick is deterministic, alternates sources, and avoids items already seen', () => {
  const a = pick('A', 'A4', 7, { minStatus: 'checked' }), b = pick('A', 'A4', 7, { minStatus: 'checked' })
  assert.deepEqual(a, b)
  assert.equal(a.source, 'listening-bank')
  const seen = new Set(entriesFor('A', 'A4', { minStatus: 'checked' })[0].ids.slice(1))
  assert.equal(pick('A', 'A4', 3, { minStatus: 'checked', avoid: seen }).id, 'L4-001')
  const sources = new Set([0, 1, 2].map(s => pick('B', 'B3', s, { minStatus: 'draft' }).source))
  assert.ok(sources.size >= 2, 'B3 has a bank and a generator: both should come up')
  assert.equal(pick('A', 'A2', 1, { minStatus: 'draft' }), null)
})

test('the ladder engine runs on the catalog: every probe can be served', () => {
  const has = hasContent('checked')
  let s = start({ age: 8, stop: 'native' })
  for (let i = 0; i < 60; i++) {
    const p = nextProbe(s, { has, session: 1 + Math.floor(i / 10) })
    if (!p) break
    const got = pick(p.track, p.step, i, { minStatus: 'checked' })
    assert.ok(got, `nothing to serve at ${p.step}`)
    s = record(s, { track: p.track, step: p.step, item: got.id || JSON.stringify(got.ref), correct: i % 3 !== 0, session: 1 + Math.floor(i / 10) })
  }
  // A track with no checked content at all is never asked and stays unknown (Ca at "checked").
  assert.equal(s.tracks.Ca.history.length, 0)
})

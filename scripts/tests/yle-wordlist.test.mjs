import { test } from 'node:test'
import assert from 'node:assert/strict'
import { YLE_WORDLIST } from '../../src/lib/literacy/yleWordlist.generated.js'

// Read by eye off pages 23–24 of the Cambridge 2018 wordlist PDF (the combined A–Z list), not off the
// parser's output: a check that reads the same text the parser reads would agree with its mistakes.
const PAGE = [
  ['baby', ['n'], 'starters'],
  ['back', ['adj', 'adv', 'n'], 'movers'],
  ['backpack', ['n'], 'flyers', { uk: 'rucksack' }],
  ['badly', ['adv'], 'movers'],
  ['café', ['n'], 'movers'],
  ['candy', ['n'], 'starters', { uk: 'sweet(s)' }],
  ['colour', ['n', 'v'], 'starters', { us: 'color' }],
  ['cookie', ['n'], 'flyers', { uk: 'biscuit' }],
  ['dear', ['adj'], 'flyers'],
  ['dolphin', ['n'], 'movers'],
  ['autumn', ['n'], 'flyers', { us: 'fall' }],
  ['elevator', ['n'], 'movers', { uk: 'lift' }],
  ['earache', ['n'], 'movers'],
  ['child/children', ['n'], 'starters'],
  ['as … as', ['adv'], 'flyers'],
  ['a.m.', [], 'flyers'],
  ['by yourself', ['adv'], 'flyers'],
  ['comic book', ['n'], 'movers'],
]

const find = (word, note) => YLE_WORDLIST.filter(e => e.word === word && (!note || e.notes.some(n => n.includes(note))))

test('entries read by eye off the PDF are in the data as printed', () => {
  for (const [word, pos, level, alt = {}] of PAGE) {
    const hits = find(word)
    assert.equal(hits.length, 1, `${word}: expected one entry, found ${hits.length}`)
    const [e] = hits
    assert.deepEqual(e.pos, pos, `${word} part of speech`)
    assert.equal(e.level, level, `${word} level`)
    if (alt.uk) assert.equal(e.uk, alt.uk, `${word} UK form`)
    if (alt.us) assert.equal(e.us, alt.us, `${word} US form`)
  }
})

test('one word, two senses, two levels', () => {
  // The list tags senses, not spellings: "at" of place is Starters, "at" of time is Movers.
  for (const [word, a, b] of [['at', ['of place', 'starters'], ['of time', 'movers']],
    ['bat', ['as sports equipment', 'starters'], [null, 'movers']],
    ['catch', ['e.g. a ball', 'starters'], ['e.g. a bus', 'movers']],
    ['could', ['ability', 'movers'], ['possibility', 'flyers']]]) {
    const all = find(word)
    assert.equal(all.length, 2, `${word}: two entries`)
    assert.equal(find(word, a[0])[0]?.level, a[1], `${word} ${a[0]}`)
    const other = b[0] ? find(word, b[0])[0] : all.find(e => !e.notes.length)
    assert.equal(other?.level, b[1], `${word} ${b[0] ?? '(no note)'}`)
  }
})

test('sizes and topics', () => {
  const by = l => YLE_WORDLIST.filter(e => e.level === l).length
  assert.equal(YLE_WORDLIST.length, 1407)
  assert.deepEqual([by('starters'), by('movers'), by('flyers')], [495, 399, 513])
  const topics = new Set(YLE_WORDLIST.flatMap(e => e.topics))
  assert.equal(topics.size, 20)
  const inTopic = (w, t) => YLE_WORDLIST.some(e => e.word === w && e.topics.includes(t))
  assert.ok(inTopic('dolphin', 'Animals'))
  assert.ok(inTopic('blue', 'Colours'))
  assert.ok(inTopic('carrot', 'Food & drink'))
  assert.ok(inTopic('cloudy', 'Weather'))
})

test('ids are unique and words are clean', () => {
  assert.equal(new Set(YLE_WORDLIST.map(e => e.id)).size, YLE_WORDLIST.length)
  for (const e of YLE_WORDLIST) assert.doesNotMatch(e.word, /[()]/, e.word)
  // Removed in 2018 (Cambridge's own examples): not on the list.
  for (const gone of ['policeman', 'supper', 'John']) assert.equal(find(gone).length, 0, gone)
  // Added in 2018 (same document): on it.
  for (const added of ['laptop', 'shorts', 'by myself', 'police officer']) assert.equal(find(added).length, 1, added)
})

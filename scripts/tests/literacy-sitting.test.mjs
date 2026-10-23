// The child's English ladder sitting (server/literacyLab.js): every source a sitting deals is markable, and no key
// reaches the public item.
import { test } from 'node:test'
import assert from 'node:assert/strict'
process.env.SUPABASE_URL ||= 'https://example.supabase.co'
const { dealItem, publicItem, judge } = await import('../../server/literacyLab.js')
import STORIES from '../../src/lib/literacy/readingStories.generated.json' with { type: 'json' }
import { TEXT_ONLY_BLIND } from '../../src/lib/literacy/catalog.js'
import { pictureBuildItem, PICTURE_WORDS } from '../../src/lib/literacy/pictureWords.js'

const picks = [
  ['B', 'B1', { source: 'picture-words', format: 'read-picture', ref: { kind: 'read', seed: 5 } }],
  ['D', 'D1', { source: 'picture-words', format: 'build', ref: { kind: 'build', seed: 5 } }],
  ['Ca', 'Ca2', { source: 'sentence-bank', format: 'read-choice', id: 'C2-001' }],
  ['B', 'B3', { source: 'vr-engine', format: 'read-choice', ref: { type: 'antonym', band: '7-8', seed: 5 } }],
  ['Cd', 'Cd1', { source: 'literacy-engine', format: 'read-choice', ref: { skill: 'be', seed: 5 } }],
  ['E', 'E2', { source: 'reading-passages', format: 'passage', id: 'B2-E2-01' }],
  ['A', 'A5', { source: 'listening-bank', format: 'listen-answer', id: 'L5-001' }],
  ['A', 'A1', { source: 'picture-words', format: 'listen-picture', ref: { kind: 'listen', seed: 7 } }],
]

test('each source deals an item whose key judges right, and the public item carries no key', async () => {
  for (const [track, step, pick] of picks) {
    const item = await dealItem(track, step, pick)
    assert.ok(item, `${pick.source} dealt`)
    for (const q of item.questions) {
      const right = q.mode === 'build' ? q.key[0] : q.key
      assert.equal(judge(q, right), true, `${pick.source} key`)
      assert.equal(judge(q, q.mode === 'build' ? 'zzz' : ['nope']), false)
      assert.ok(q.skill && q.group && q.family, `${pick.source} evidence fields`)
    }
    const pub = JSON.stringify(publicItem(item))
    assert.ok(!/"key"|"explain"|"answer"/.test(pub), `${pick.source} public item leaks: ${pub.slice(0, 120)}`)
  }
})

// Every generator the catalog lists for a child deals without throwing (D1's definition build once crashed the
// sitting: it has letter tiles, not options).
test('every catalog generator deals markable items', async () => {
  const { CATALOG } = await import('../../src/lib/literacy/catalog.js')
  for (const e of CATALOG.filter(x => x.kind === 'generator' && x.status !== 'draft')) {
    let dealt = 0
    for (let seed = 1; seed <= 30 && dealt < 3; seed++) {
      const item = await dealItem(e.track, e.step, { source: e.source, format: e.format, ref: { ...e.ref, seed } })
      if (!item) continue
      dealt++
      for (const q of item.questions) {
        assert.equal(judge(q, q.mode === 'build' ? q.key[0] : q.key), true, `${e.source} ${e.step} ${JSON.stringify(e.ref)} key`)
        if (q.mode === 'build') assert.equal([...q.letters].map(l => l.letter).sort().join(''), [...q.key[0]].sort().join(''))
      }
    }
    assert.ok(dealt > 0, `${e.source} ${e.step} ${JSON.stringify(e.ref)} dealt nothing in 30 seeds`)
  }
})

test('a reading text deals its questions together, one group', async () => {
  const item = await dealItem('E', 'E2', { source: 'reading-passages', format: 'passage', id: 'B2-E2-01' })
  assert.ok(item.questions.length > 1)
  assert.equal(new Set(item.questions.map(q => q.group)).size, 1)
})

test('D1 build: a picture and shuffled letters that never already spell the word', () => {
  let n = 0
  for (let s = 1; s < 500; s++) {
    const it = pictureBuildItem(s)
    if (!it) continue
    n++
    assert.notEqual(it.letters.map(l => l.letter).join(''), it.key)
    assert.deepEqual([...it.key].sort(), it.letters.map(l => l.letter).sort())
    assert.ok(PICTURE_WORDS.some(w => w.word === it.key && w.emoji === it.prompt.picture.emoji))
  }
  assert.ok(n > 400)
})

test('listening: everything heard, nothing read; the options are sounds', async () => {
  const item = await dealItem('A', 'A5', { source: 'listening-bank', format: 'listen-answer', id: 'L5-001' })
  const pub = publicItem(item)
  assert.equal(pub.prompt.listen, true)
  assert.equal(pub.prompt.audio.length, 2, 'the talk, then the question')
  for (const o of pub.questions[0].options) { assert.ok(o.audio.endsWith('.m4a')); assert.equal(o.text, undefined) }
  // File names are content hashes: no clip id (which would say the answer is option 1) reaches the child.
  assert.ok(!/lo-L5|ld-L5|lq-L5/.test(JSON.stringify(pub)))
})

test('the 200 stories: only questions a blind solver could not answer are asked', async () => {
  const story = STORIES.items.find(i => i.questions.some(q => q.blindRight <= TEXT_ONLY_BLIND) && i.questions.some(q => q.blindRight === 3))
  const item = await dealItem('E', story.level, { source: 'reading-stories-200', format: 'passage', id: story.id })
  const kept = story.questions.filter(q => q.blindRight <= TEXT_ONLY_BLIND).map(q => q.stem)
  assert.deepEqual(item.questions.map(q => q.stem), kept)
})

// A script corrected after recording is held back until it is recorded again; every other item still plays.
test('listening items whose recordings no longer match the script are not dealt', async () => {
  const { recordingMatches } = await import('../../server/literacyLab.js')
  const { LISTENING_ITEMS } = await import('../../server/literacy/listeningBank.js')
  const stale = LISTENING_ITEMS.filter(it => !recordingMatches(it)).map(it => it.id)
  assert.deepEqual(stale.sort(), ['L4-006', 'L5-005', 'L5-006'])
  assert.equal(await dealItem('A', 'A4', { source: 'listening-bank', format: 'listen-answer', id: 'L4-006' }), null)
  assert.ok(await dealItem('A', 'A4', { source: 'listening-bank', format: 'listen-answer', id: 'L4-007' }))
})

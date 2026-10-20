// A1/B1 picture-word items: four distinct options, the key among them, no look-alikes or shared first letters,
// every picture drawn in the project, every word recorded, answer positions balanced.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pictureItem, PICTURE_WORDS } from '../../src/lib/literacy/pictureWords.js'
import { EMOJI_ART } from '../../src/lib/puzzleArt.generated.js'
import { YLE_WORDLIST } from '../../src/lib/literacy/yleWordlist.generated.js'
import { safety } from '../english-audio/safety.mjs'
const AUDIO = createRequire(import.meta.url)('../../src/lib/literacy/audioManifest.generated.json')

test('every picture word is a Starters word, drawn, recorded and safe', () => {
  const starters = new Set(YLE_WORDLIST.filter(e => e.level === 'starters').flatMap(e => [e.word, ...(e.forms || [])]))
  for (const w of PICTURE_WORDS) {
    assert.ok(starters.has(w.word), `${w.word} is not a Starters word`)
    assert.ok(EMOJI_ART[w.emoji], `${w.emoji} (${w.word}) is not drawn in the project`)
    for (const v of ['uk', 'us']) assert.ok(AUDIO[`yw-${w.word}:${v}`], `no ${v} recording of ${w.word}`)
    assert.deepEqual(safety(w.word).blocked, [])
  }
})

test('items: four distinct options, key among them, no shared first letter, no look-alikes', () => {
  const look = [['pen', 'pencil', 'crayon'], ['car', 'bus'], ['bird', 'chicken'], ['plane', 'helicopter']]
  const at = [0, 0, 0, 0]
  for (const kind of ['listen', 'read']) for (let seed = 1; seed <= 500; seed++) {
    const it = pictureItem(kind, seed)
    assert.ok(it, `${kind} ${seed}`)
    const ids = it.options.map(o => o.id)
    assert.equal(new Set(ids).size, 4)
    assert.ok(ids.includes(it.key))
    assert.equal(new Set(ids.map(w => w[0])).size, 4, `shared first letter: ${ids}`)
    for (const g of look) assert.ok(ids.filter(w => g.includes(w)).length <= 1, `look-alikes: ${ids}`)
    at[ids.indexOf(it.key)]++
    assert.equal(it.step, kind === 'listen' ? 'A1' : 'B1')
    assert.deepEqual(pictureItem(kind, seed), it)
  }
  for (const n of at) assert.ok(n > 180 && n < 320, `answer positions ${at}`)
})

test('avoid: a word already asked is not the target again', () => {
  const avoid = new Set(PICTURE_WORDS.slice(0, 31).map(w => w.word))
  for (let seed = 1; seed <= 20; seed++) assert.equal(pictureItem('read', seed, { avoid }).key, PICTURE_WORDS[31].word)
  assert.equal(pictureItem('read', 1, { avoid: new Set(PICTURE_WORDS.map(w => w.word)) }), null)
})

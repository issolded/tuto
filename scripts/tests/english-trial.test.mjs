import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TRIAL_ITEMS, PASSAGES } from '../../src/lib/literacy/trialSet.js'
import { CLIPS } from '../english-audio/clips.mjs'
import { SCENES, SETS } from '../english-art/art.mjs'

const doc = readFileSync(new URL('../../docs/ENGLISH-TRIAL-SET.md', import.meta.url), 'utf8')
const docIds = [...doc.matchAll(/^\| ([A-Z]{1,2}\d{2}) \/ /gm)].map(m => m[1])
const clipIds = new Set(CLIPS.map(c => c.id))
const OBJECTS = new Set(['dog', 'cat', 'rabbit', 'banana', 'pear', 'apple', 'sun', 'fish'])

test('the data has exactly the items of the document', () => {
  assert.equal(docIds.length, 36)
  assert.deepEqual(TRIAL_ITEMS.map(i => i.id).sort(), [...docIds].sort())
})

test('every key is one of the item\'s own options', () => {
  for (const it of TRIAL_ITEMS) {
    if (it.mode === 'build') {
      assert.equal([...it.letters].sort().join(''), [...it.answer].sort().join(''), `${it.id} letters spell the answer`)
      assert.notEqual(it.letters.join(''), it.answer, `${it.id} letters are not already in order`)
    } else if (it.mode === 'order') {
      assert.deepEqual([...it.order].sort(), it.cards.map(c => c.id).sort(), `${it.id} order uses every card once`)
    } else {
      assert.equal(it.options.filter(o => o.id === it.key).length, 1, `${it.id} key`)
      assert.equal(new Set(it.options.map(o => o.id)).size, it.options.length, `${it.id} option ids unique`)
      assert.equal(it.options.length, 3, `${it.id} three options`)
    }
  }
})

test('every sound and picture an item uses is defined', () => {
  for (const it of TRIAL_ITEMS) {
    const audio = [it.instruction?.audio, it.prompt?.audio, it.prompt?.question, it.feedback?.audio, ...(it.options || []).map(o => o.audio)].filter(Boolean)
    for (const a of audio) assert.ok(clipIds.has(a), `${it.id}: clip ${a}`)
    const pictures = [it.prompt?.picture, ...(it.options || []).map(o => o.picture)].filter(Boolean)
    for (const p of pictures) assert.ok(p.object ? OBJECTS.has(p.object) : SCENES[p.scene], `${it.id}: picture ${JSON.stringify(p)}`)
    if (it.passage) assert.ok(PASSAGES[it.passage], `${it.id}: passage`)
  }
})

test('listening items show no written English; feedback is English or a sound', () => {
  for (const it of TRIAL_ITEMS.filter(i => i.area === 'A')) {
    assert.equal(it.prompt.text, undefined, `${it.id} prompt is heard, not read`)
    assert.ok((it.options || []).every(o => !o.text), `${it.id} options are pictures or sounds`)
  }
  // The activity is all English (user decision 2026-10-16): no Turkish or Spanish letters in what a child sees.
  const shown = JSON.stringify(TRIAL_ITEMS.map(i => [i.instruction?.text, i.prompt, i.options?.map(o => o.text), i.cards, i.feedback?.text]))
  assert.doesNotMatch(shown, /[çğışöüÇĞİŞÖÜñáéíóú¿¡]/)
})

test('the picture sets match the items that use them', () => {
  for (const set of SETS) {
    const it = TRIAL_ITEMS.find(i => i.id === set.item)
    const keyScene = it.options.find(o => o.id === it.key).picture.scene
    assert.equal(keyScene, set.key, `${set.item}: the keyed picture is the one the recognition check expects`)
    assert.deepEqual(it.options.map(o => o.picture.scene).sort(), [...set.options].sort())
  }
})

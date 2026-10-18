// Picture-word items for the two lowest ladder steps (docs/ENGLISH-SKILL-LADDERS.md):
//   A1 listen-picture: hear "apple" (wordlist recording yw-apple) -> choose one of four pictures
//   B1 read-picture:   read "apple" -> choose one of four pictures; after a wrong answer the word is heard
// Pictures are the Noto emoji drawings already in the project (src/lib/puzzleArt.generated.js), words are
// Cambridge Starters nouns with a one-to-one picture. Left out on purpose: truck (UK "lorry"), sea (the emoji
// is a wave), fly (also a verb), motorbike (the emoji is a scooter).
//
// Four options, not three: a guess is right one time in four, and at the lowest step guessing is what most
// distorts placement (measured in scripts/tests/ladder.test.mjs). Distractors never start with the target's
// letter (apple / ant would test the first sound, not the word) and never come from the same look-alike group
// (pen / pencil / crayon). One distractor from the target's own topic, the others from elsewhere: fair at the
// first step, and still a word question rather than a category question.

export const PICTURE_WORDS = [
  ['apple', '🍎', 'food'], ['pear', '🍐', 'food'], ['banana', '🍌', 'food'], ['egg', '🥚', 'food'], ['milk', '🥛', 'food'],
  ['car', '🚗', 'transport'], ['bus', '🚌', 'transport'], ['bike', '🚲', 'transport'], ['train', '🚂', 'transport'],
  ['plane', '✈️', 'transport'], ['helicopter', '🚁', 'transport'], ['boat', '⛵', 'transport'],
  ['dog', '🐶', 'animal'], ['cat', '🐱', 'animal'], ['bear', '🐻', 'animal'], ['horse', '🐴', 'animal'], ['mouse', '🐭', 'animal'],
  ['cow', '🐄', 'animal'], ['sheep', '🐑', 'animal'], ['bee', '🐝', 'animal'], ['chicken', '🐔', 'animal'], ['fish', '🐟', 'animal'],
  ['bird', '🐦', 'animal'],
  ['sun', '☀️', 'world'], ['tree', '🌳', 'world'], ['flower', '🌻', 'world'], ['house', '🏠', 'world'],
  ['pencil', '✏️', 'school'], ['ruler', '📏', 'school'], ['pen', '🖊️', 'school'], ['crayon', '🖍️', 'school'], ['guitar', '🎸', 'school'],
].map(([word, emoji, topic]) => ({ word, emoji, topic }))

const LOOKALIKE = [['pen', 'pencil', 'crayon'], ['car', 'bus'], ['bird', 'chicken'], ['plane', 'helicopter']]
const together = (a, b) => LOOKALIKE.some(g => g.includes(a) && g.includes(b))

function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) }
const take = (list, r) => list[Math.floor(r() * list.length)]

// kind: 'listen' (A1) | 'read' (B1). avoid: words already asked (the target is then drawn from the rest).
export function pictureItem(kind, seed, { avoid = new Set() } = {}) {
  const r = rng(seed * 2654435761)
  const pool = PICTURE_WORDS.filter(w => !avoid.has(w.word))
  if (!pool.length) return null
  const target = take(pool, r)
  const ok = w => w.word !== target.word && w.word[0] !== target.word[0] && !together(w.word, target.word)
  const picked = [target]
  const fits = w => ok(w) && picked.every(p => p.word === target.word || (!together(p.word, w.word) && p.word[0] !== w.word[0]))
  const same = PICTURE_WORDS.filter(w => w.topic === target.topic && fits(w))
  if (same.length) picked.push(take(same, r))
  while (picked.length < 4) {
    const rest = PICTURE_WORDS.filter(w => w.topic !== target.topic && fits(w) && !picked.includes(w))
    if (!rest.length) return null
    picked.push(take(rest, r))
  }
  // answer position from the seed, so it is balanced over items
  const at = Math.floor(r() * 4)
  const options = picked.slice(1)
  options.splice(at, 0, target)
  const listen = kind === 'listen'
  return {
    id: `pw-${kind}-${target.word}-${seed}`,
    track: listen ? 'A' : 'B', area: listen ? 'A' : 'B', step: listen ? 'A1' : 'B1', mode: listen ? 'listen-picture' : 'read-picture',
    instruction: listen ? { audio: 'i-listen-picture' } : { text: 'Read the word. Choose the picture.' },
    prompt: listen ? { audio: `yw-${target.word}` } : { text: target.word },
    options: options.map(w => ({ id: w.word, picture: { emoji: w.emoji } })),
    key: target.word,
    feedback: { audio: `yw-${target.word}` },
  }
}

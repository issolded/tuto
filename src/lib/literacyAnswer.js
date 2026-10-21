// What the English ladder sitting shows for a missed question (the flash, the result list, a reopened sitting).

const same = (a, b) => String(a || '').trim().toLowerCase().replace(/[.!?]$/, '') === String(b || '').trim().toLowerCase().replace(/[.!?]$/, '')

// For a missed question: the right answer as words (or a picture), and the explanation when it adds something.
export function rightAnswer(q, result) {
  if (q.mode === 'build') return { text: result.key[0] }
  const right = q.options.filter(o => result.key.includes(o.id))
  const sounds = right.length && right.every(o => o.audio && !o.text && !o.picture)
  // An option that is only a sound has no words: its explanation says what it was.
  if (sounds) return { text: result.explain, audio: result.explain_audio, sound: true }
  const words = right.map(o => o.text).filter(Boolean).join(', ')
  return {
    text: words || null, pictures: right.filter(o => o.picture).map(o => o.picture.emoji),
    extra: result.explain && !same(result.explain, words) && !right.some(o => o.picture && same(result.explain, o.id)) ? result.explain : null,
    audio: result.explain_audio,
  }
}

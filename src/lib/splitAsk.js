// A word problem is a fact or two and then the question. Printed as one paragraph, a child reads
// "Each ⚽ stands for 4 goals. How many more goals did Theo score than Ada?" as one thing to hold;
// split, the question stands on its own line and is what they look back at. Display only.
// The split is at the last sentence end before a closing question; a sentence ends at . ! or ?
// followed by a space and a capital (or ¿ ¡), so 2.5 and 3.14 never split, and a title like
// "Mr. Ali" is kept whole.
const ABBR = /(?:\b(?:Mr|Mrs|Ms|Dr|St|Sr|Sra|Srta|vs|etc|No|approx|e\.g|i\.e))\.$/i

export function splitAsk(text) {
  if (typeof text !== 'string' || !/\?\s*$/.test(text) || text.includes('\n')) return [text]
  const re = /[.!?](?=\s+["“(¿¡]?[A-ZÇĞİÖŞÜÁÉÍÓÚÑ¿¡])/g
  let cut = -1
  for (const m of text.matchAll(re)) {
    if (m.index >= text.length - 1) break
    if (ABBR.test(text.slice(0, m.index + 1))) continue
    cut = m.index + 1
  }
  if (cut < 0) return [text]
  const info = text.slice(0, cut).trim()
  const ask = text.slice(cut).trim()
  return info && ask ? [info, ask] : [text]
}

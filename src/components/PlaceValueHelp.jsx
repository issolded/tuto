import { useState } from 'react'
import { say } from '../lib/i18n'

// Place-value help: a hundreds / tens / ones chart the child fills with blocks. Every place
// question for ages 8 and under was answered by its 💡 hint text read back — "Only one digit is
// being added to: the tens" — which names the rule and teaches nothing a child who got it wrong
// can use. Here they do the thing the rule describes, with blocks (Bond's and every Year 2-3
// classroom's picture):
//   build   — put each named part in its column, read the digits ("one hundred and nine": the
//             empty tens column is the 0)
//   missing — the number is already built; cover the parts you are given, count what is left
//   shift   — add or take one block; ten blocks swap for one of the next place, and an empty
//             column breaks one from the next place first
//   compare — go column by column from the left, keeping only the numbers that win there
//   arrange — fill the columns from the left, best digit first
//   digit   — find the digit, see its blocks, count them in its place
// Nothing here prints the answer before the child has made it: the digits under the columns are
// whatever the child has built, the same way the coin help's total is whatever they have tapped.
// A component of its own (not a render helper inside HelpPanel) so taps never remount it.

const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const INK = '#241f3a'
const INK_SOFT = '#8d83ad'
const ORANGE = '#f79433'
const GREEN = '#4cb685'
const MATH_DEEP = '#3d8fcf'
const COLOUR = { 100: '#f7c35f', 10: '#7ecbd0', 1: '#e6a6b4' }
const EDGE = { 100: '#c9912a', 10: '#3f9ba1', 1: '#b86a7c' }

const colName = (place, lang) => ({
  100: say(lang, 'Hundreds', 'Yüzler', 'Centenas'),
  10: say(lang, 'Tens', 'Onlar', 'Decenas'),
  1: say(lang, 'Ones', 'Birler', 'Unidades'),
}[place])
// The block's name ("ten", "onluk", "decena"); `unit` puts a count in front of it.
const noun = (place, lang, one = true) => ({
  100: say(lang, one ? 'hundred' : 'hundreds', 'yüzlük', one ? 'centena' : 'centenas'),
  10: say(lang, one ? 'ten' : 'tens', 'onluk', one ? 'decena' : 'decenas'),
  1: say(lang, one ? 'one' : 'ones', 'birlik', one ? 'unidad' : 'unidades'),
}[place])
const unit = (count, place, lang) => {
  const one = count === 1
  const w = {
    100: say(lang, one ? 'hundred' : 'hundreds', 'yüzlük', one ? 'centena' : 'centenas'),
    10: say(lang, one ? 'ten' : 'tens', 'onluk', one ? 'decena' : 'decenas'),
    1: say(lang, one ? 'one' : 'ones', 'birlik', one ? 'unidad' : 'unidades'),
  }[place]
  return `${count} ${w}`
}
const digitsOf = (n, places) => Object.fromEntries(places.map(p => [p, Math.floor(n / p) % 10]))

function Block({ place, dim, onTap }) {
  const base = { background: COLOUR[place], border: `1.5px solid ${EDGE[place]}`, borderRadius: 3, opacity: dim ? 0.22 : 1, transition: 'opacity .2s', cursor: onTap ? 'pointer' : 'default', flexShrink: 0 }
  if (place === 100) {
    return <div onClick={onTap} style={{ ...base, width: 22, height: 22,
      backgroundImage: `linear-gradient(${EDGE[100]}33 1px, transparent 1px), linear-gradient(90deg, ${EDGE[100]}33 1px, transparent 1px)`, backgroundSize: '4.4px 4.4px' }} />
  }
  if (place === 10) {
    return <div onClick={onTap} style={{ ...base, width: 7, height: 26,
      backgroundImage: `linear-gradient(${EDGE[10]}55 1px, transparent 1px)`, backgroundSize: '100% 2.6px' }} />
  }
  return <div onClick={onTap} style={{ ...base, width: 8, height: 8 }} />
}

export default function PlaceValueHelp({ help, language: lang }) {
  const { mode, places } = help
  const [placed, setPlaced] = useState([])            // build: part indices placed · missing: given parts covered
  const [counts, setCounts] = useState(() => mode === 'shift' ? digitsOf(help.start, places) : null)
  const [acted, setActed] = useState(false)           // shift: the +/- has been done
  const [note, setNote] = useState(null)              // shift / arrange: a nudge after a move that could not happen
  const [kept, setKept] = useState(() => help.numbers ? help.numbers.map((_, i) => i) : [])
  const [col, setCol] = useState(0)                   // compare: next column to test
  const [boxes, setBoxes] = useState([])              // arrange: digit indices in the columns, left to right
  const [found, setFound] = useState(false)           // digit: the asked digit has been tapped
  const [tally, setTally] = useState(0)               // digit: blocks counted

  let bubble, chart, below = null

  // One column: header, blocks, and the digit the child has built there (or null for none).
  const column = (place, blocks, digit, { onTap, lit = false, zero = false } = {}) => (
    <div key={place} onClick={onTap} style={{
      width: places.length === 3 ? 86 : 110, borderRadius: 14, background: lit ? '#fff7ef' : 'white',
      border: `2px ${lit ? 'dashed' : 'solid'} ${lit ? ORANGE : '#e4def3'}`, padding: '6px 4px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: onTap ? 'pointer' : 'default',
    }}>
      <div style={{ fontFamily: FRED, fontWeight: 700, fontSize: 12, color: INK_SOFT }}>{colName(place, lang)}</div>
      {/* Rows of five, as ten-frames and bead strings group them: 9 reads as 5 and 4. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: place === 1 ? 3 : 4, justifyContent: 'center', alignContent: 'flex-start', width: '100%', maxWidth: place === 1 ? 55 : place === 10 ? 55 : '100%', minHeight: 60 }}>
        {blocks}
      </div>
      {digit !== false && <div style={{ fontFamily: FRED, fontWeight: 700, fontSize: 26, lineHeight: 1, color: zero ? ORANGE : digit == null ? '#d6d0e6' : MATH_DEEP }}>{digit ?? '·'}</div>}
    </div>
  )
  const row = cols => <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>{cols}</div>
  const chip = (label, { done, onTap, key }) => (
    <button key={key} onClick={done ? undefined : onTap} className="math-press" style={{
      border: 'none', borderRadius: 999, padding: '7px 13px', fontFamily: FRED, fontWeight: 700, fontSize: 14,
      background: done ? '#eef9f3' : '#fff7ef', color: done ? GREEN : ORANGE, boxShadow: done ? 'none' : '0 3px 10px rgba(247,148,51,.18)',
      cursor: done ? 'default' : 'pointer', textDecoration: done ? 'line-through' : 'none',
    }}>{label}</button>
  )

  if (mode === 'build') {
    const have = Object.fromEntries(places.map(p => [p, 0]))
    const touchedCol = new Set()
    for (const i of placed) { have[help.parts[i].place] += help.parts[i].count; touchedCol.add(help.parts[i].place) }
    const all = placed.length === help.parts.length
    const empty = places.filter(p => !have[p])
    bubble = !all
      ? say(lang, 'Tap each part to put its blocks in the right column.', 'Her parçaya dokun, blokları doğru sütuna gitsin.', 'Toca cada parte para poner sus bloques en su columna.')
      : empty.length
        ? say(lang, `Nothing went in the ${colName(empty[0], lang).toLowerCase()} column — it still gets a 0. Now read the digits and type the number! 💪`,
                    `${colName(empty[0], lang)} sütununa hiçbir şey gelmedi — oraya yine de 0 yazılır. Şimdi rakamları oku ve sayıyı yaz! 💪`,
                    `En la columna de las ${colName(empty[0], lang).toLowerCase()} no hay nada: lleva un 0. ¡Ahora lee las cifras y escribe el número! 💪`)
        : say(lang, 'Read the digits under the columns and type the number! 💪', 'Sütunların altındaki rakamları oku ve sayıyı yaz! 💪', '¡Lee las cifras de debajo de las columnas y escribe el número! 💪')
    below = <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
      {help.parts.map((p, i) => chip(unit(p.count, p.place, lang), { key: i, done: placed.includes(i), onTap: () => setPlaced(x => [...x, i]) }))}
    </div>
    chart = row(places.map(p => column(p,
      Array.from({ length: have[p] }, (_, k) => <Block key={k} place={p} />),
      touchedCol.has(p) ? have[p] : all ? 0 : null,
      { zero: all && !have[p] })))
  } else if (mode === 'missing') {
    const d = digitsOf(help.n, places)
    const covered = Object.fromEntries(places.map(p => [p, 0]))
    for (const i of placed) { const v = help.given[i]; const p = 10 ** (String(v).length - 1); covered[p] += v / p }
    const all = placed.length === help.given.length
    bubble = !all
      ? say(lang, `This is ${help.n}. Tap each part you already have — it covers its blocks.`, `Bu ${help.n}. Elindeki parçalara dokun — her biri kendi bloklarını kapatır.`, `Esto es ${help.n}. Toca cada parte que ya tienes: tapa sus bloques.`)
      : say(lang, 'The blocks still bright are the missing part. What are they worth? 💪', 'Hâlâ parlak kalan bloklar eksik parça. Kaç ederler? 💪', 'Los bloques que siguen brillando son la parte que falta. ¿Cuánto valen? 💪')
    below = <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
      {help.given.map((v, i) => chip(String(v), { key: i, done: placed.includes(i), onTap: () => setPlaced(x => [...x, i]) }))}
    </div>
    chart = row(places.map(p => column(p,
      // No digit row: the digits would read the missing part straight off.
      Array.from({ length: d[p] }, (_, k) => <Block key={k} place={p} dim={k < covered[p]} />), false)))
  } else if (mode === 'shift') {
    const c = counts
    // Ten in a column is a swap only when adding. Taking away, ten ones is exactly what breaking
    // a ten is supposed to leave — prompting a swap there sent the child round in a circle.
    const full = help.up ? places.find(p => c[p] >= 10) : null
    const broke = !help.up && !acted && c[help.amount] > 0 && c[help.amount] !== digitsOf(help.start, places)[help.amount]
    const done = acted && full == null
    const sign = help.up ? '+' : '−'
    const act = () => {
      if (acted || full != null) return
      if (help.up) { setCounts(x => ({ ...x, [help.amount]: x[help.amount] + 1 })); setActed(true); setNote(null); return }
      if (c[help.amount] > 0) { setCounts(x => ({ ...x, [help.amount]: x[help.amount] - 1 })); setActed(true); setNote(null); return }
      setNote(breakNote(c))
    }
    // The column to break from is the nearest one above that still has a block: 100 − 1 breaks a
    // hundred into tens, then a ten into ones.
    function breakNote(cc) {
      const from = places.filter(p => p > help.amount && cc[p] > 0).pop()
      return say(lang,
        `There are no ${colName(help.amount, lang).toLowerCase()} to take. Tap the ${colName(from, lang).toLowerCase()} column to break one into 10.`,
        `Alınacak ${noun(help.amount, lang)} yok. ${colName(from, lang)} sütununa dokun, birini 10 parçaya böl.`,
        `No hay ${colName(help.amount, lang).toLowerCase()} que quitar. Toca la columna de las ${colName(from, lang).toLowerCase()} para romper una en 10.`)
    }
    const tapCol = p => {
      if (full === p) { setCounts(x => ({ ...x, [p]: x[p] - 10, [p * 10]: x[p * 10] + 1 })); return }
      // Breaking: only while a take-away is waiting, and only a column above the one needed.
      if (!help.up && !acted && p > help.amount && c[p] > 0 && c[help.amount] === 0) {
        const nx = { ...c, [p]: c[p] - 1, [p / 10]: c[p / 10] + 10 }
        setCounts(nx); setNote(nx[help.amount] > 0 ? null : breakNote(nx))
      }
    }
    bubble = full != null
      ? say(lang, `10 ${colName(full, lang).toLowerCase()}! Tap that column to swap them for 1 ${noun(full * 10, lang)}.`,
                  `10 ${noun(full, lang)} oldu! O sütuna dokun, onları 1 ${noun(full * 10, lang)} ile değiştir.`,
                  `¡10 ${colName(full, lang).toLowerCase()}! Toca esa columna para cambiarlas por 1 ${noun(full * 10, lang)}.`)
      : note ?? (broke
        ? say(lang, `Now there are ${c[help.amount]} ${noun(help.amount, lang, false)}. Tap ${sign}${help.amount}.`,
                    `Şimdi ${c[help.amount]} ${noun(help.amount, lang, false)} var. ${sign}${help.amount} düğmesine dokun.`,
                    `Ahora hay ${c[help.amount]} ${noun(help.amount, lang, false)}. Toca ${sign}${help.amount}.`)
        : done
        ? say(lang, 'Read the digits under the columns — that is your answer. Type it! 💪', 'Sütunların altındaki rakamları oku — cevabın bu. Yaz! 💪', 'Lee las cifras de debajo de las columnas: esa es tu respuesta. ¡Escríbela! 💪')
        : say(lang, `This is ${help.start}. Tap ${sign}${help.amount} to ${help.up ? 'add' : 'take away'} one ${noun(help.amount, lang)}.`,
                    `Bu ${help.start}. ${sign}${help.amount} düğmesine dokun, bir ${noun(help.amount, lang)} ${help.up ? 'ekle' : 'çıkar'}.`,
                    `Esto es ${help.start}. Toca ${sign}${help.amount} para ${help.up ? 'añadir' : 'quitar'} una ${noun(help.amount, lang)}.`))
    chart = row(places.map(p => column(p,
      // A leading 0 is left blank, as a chart is written: 99 reads 99, not 099.
      Array.from({ length: c[p] }, (_, k) => <Block key={k} place={p} />), c[p] >= 10 ? '10' : (c[p] === 0 && p !== 1 && places.every(q => q < p || c[q] === 0) ? null : c[p]),
      { onTap: () => tapCol(p), lit: full === p || (!!note && p > help.amount && c[p] > 0) })))
    below = !acted && (
      <button onClick={act} className="math-press" style={{
        border: 'none', borderRadius: 16, padding: '10px 22px', background: ORANGE, color: 'white',
        fontFamily: FRED, fontWeight: 700, fontSize: 22, boxShadow: '0 5px 14px rgba(247,148,51,.36)', cursor: 'pointer',
      }}>{sign}{help.amount}</button>
    )
  } else if (mode === 'compare') {
    const rows = help.numbers.map(n => digitsOf(n, places))
    const finished = kept.length === 1 || col >= places.length
    const test = () => {
      if (finished) return
      const p = places[col]
      const vals = kept.map(i => rows[i][p])
      const best = help.want === 'max' ? Math.max(...vals) : Math.min(...vals)
      setKept(k => k.filter(i => rows[i][p] === best))
      setCol(x => x + 1)
    }
    bubble = col === 0
      ? say(lang, `Start with the column on the left. Tap "${colName(places[0], lang)}" and keep only the ${help.want === 'max' ? 'biggest' : 'smallest'} digit.`,
                  `Soldaki sütundan başla. "${colName(places[0], lang)}" sütununa dokun, yalnız en ${help.want === 'max' ? 'büyük' : 'küçük'} rakamı tut.`,
                  `Empieza por la columna de la izquierda. Toca «${colName(places[0], lang)}» y quédate solo con la cifra ${help.want === 'max' ? 'mayor' : 'menor'}.`)
      : finished
        ? say(lang, 'One number is left — that one wins. Choose it! 💪', 'Tek bir sayı kaldı — kazanan o. Onu seç! 💪', 'Queda un solo número: ese gana. ¡Elígelo! 💪')
        : say(lang, `Still a tie. Tap "${colName(places[col], lang)}" next.`, `Hâlâ berabere. Şimdi "${colName(places[col], lang)}" sütununa dokun.`, `Siguen empatados. Toca ahora «${colName(places[col], lang)}».`)
    chart = (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${places.length}, 64px)`, gap: 6, justifyContent: 'center' }}>
        {places.map((p, j) => (
          <button key={p} onClick={j === col ? test : undefined} className="math-press" style={{
            border: `2px ${j === col && !finished ? 'dashed' : 'solid'} ${j === col && !finished ? ORANGE : '#e4def3'}`, borderRadius: 12,
            background: j < col ? '#eef9f3' : j === col && !finished ? '#fff7ef' : 'white', padding: '6px 2px',
            fontFamily: FRED, fontWeight: 700, fontSize: 12, color: j === col && !finished ? ORANGE : INK_SOFT, cursor: j === col && !finished ? 'pointer' : 'default',
          }}>{colName(p, lang)}</button>
        ))}
        {rows.map((r, i) => places.map((p, j) => (
          <div key={`${i}-${p}`} style={{
            height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: kept.includes(i) ? (j < col ? '#eef9f3' : 'white') : '#f3f1f8',
            fontFamily: FRED, fontWeight: 700, fontSize: 24, color: kept.includes(i) ? INK : '#cfc9e0',
            textDecoration: kept.includes(i) ? 'none' : 'line-through',
          }}>{r[p]}</div>
        )))}
      </div>
    )
  } else if (mode === 'arrange') {
    const used = new Set(boxes)
    const left = help.digits.map((d, i) => [d, i]).filter(([, i]) => !used.has(i))
    const tap = (d, i) => {
      if (boxes.length >= places.length) return
      const vals = left.map(([v]) => v)
      const pool = boxes.length === 0 && help.want === 'min' ? vals.filter(v => v > 0) : vals
      const best = help.want === 'max' ? Math.max(...pool) : Math.min(...pool)
      if (boxes.length === 0 && help.want === 'min' && d === 0) {
        setNote(say(lang, 'A number cannot start with 0 — try another digit here.', 'Sayı 0 ile başlayamaz — buraya başka bir rakam dene.', 'Un número no puede empezar por 0: prueba otra cifra aquí.')); return
      }
      if (d !== best) {
        setNote(help.want === 'max'
          ? say(lang, `This column is worth more than the ones after it. Is there a bigger digit for it?`, `Bu sütun sağındakilerden daha değerli. Buraya daha büyük bir rakam var mı?`, `Esta columna vale más que las de su derecha. ¿Hay una cifra mayor para ella?`)
          : say(lang, `This column is worth more than the ones after it. Is there a smaller digit for it?`, `Bu sütun sağındakilerden daha değerli. Buraya daha küçük bir rakam var mı?`, `Esta columna vale más que las de su derecha. ¿Hay una cifra menor para ella?`))
        return
      }
      setNote(null); setBoxes(b => [...b, i])
    }
    const full = boxes.length === places.length
    bubble = note ?? (full
      ? say(lang, 'That is your number — type it! 💪', 'İşte sayın — şimdi yaz! 💪', 'Ese es tu número: ¡escríbelo! 💪')
      : say(lang, `Fill the columns from the left. The left one is worth the most — which digit goes there?`, `Sütunları soldan doldur. En soldaki en değerlisi — oraya hangi rakam gelir?`, `Llena las columnas desde la izquierda. La de la izquierda vale más: ¿qué cifra va ahí?`))
    chart = row(places.map((p, j) => column(p,
      boxes[j] != null ? Array.from({ length: help.digits[boxes[j]] }, (_, k) => <Block key={k} place={p} />) : [],
      boxes[j] != null ? help.digits[boxes[j]] : null,
      { lit: j === boxes.length, onTap: boxes[j] != null ? () => { setBoxes(b => b.slice(0, j)); setNote(null) } : undefined })))
    below = <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {help.digits.map((d, i) => (
        <button key={i} onClick={used.has(i) ? undefined : () => tap(d, i)} className="math-press" style={{
          width: 52, height: 52, borderRadius: 14, border: 'none', fontFamily: FRED, fontWeight: 700, fontSize: 26,
          background: used.has(i) ? '#f3f1f8' : '#2c2745', color: used.has(i) ? '#cfc9e0' : 'white', cursor: used.has(i) ? 'default' : 'pointer',
        }}>{d}</button>
      ))}
    </div>
  } else if (mode === 'digit') {
    const d = digitsOf(help.n, places)
    const want = d[help.place]
    const counted = Math.min(tally, want)
    bubble = !found
      ? say(lang, `Tap the ${want} in ${help.n}.`, `${help.n} sayısındaki ${want} rakamına dokun.`, `Toca el ${want} de ${help.n}.`)
      : counted < want
        ? say(lang, `It is in the ${colName(help.place, lang).toLowerCase()} column: ${unit(want, help.place, lang)}. Tap each block to count it.`,
                    `${colName(help.place, lang)} sütununda: ${unit(want, help.place, lang)}. Saymak için her bloğa dokun.`,
                    `Está en la columna de las ${colName(help.place, lang).toLowerCase()}: ${unit(want, help.place, lang)}. Toca cada bloque para contarlo.`)
        : say(lang, `That is what the ${want} is worth. Choose it! 💪`, `${want} rakamının değeri bu. Onu seç! 💪`, `Eso es lo que vale el ${want}. ¡Elígelo! 💪`)
    const digitsRow = (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
        {places.map(p => (
          <button key={p} onClick={() => { if (p === help.place) setFound(true) }} className="math-press" style={{
            width: 46, height: 52, borderRadius: 12, border: `2px solid ${found && p === help.place ? ORANGE : '#e4def3'}`,
            background: found && p === help.place ? '#fff7ef' : 'white', fontFamily: FRED, fontWeight: 700, fontSize: 28, color: INK, cursor: 'pointer',
          }}>{d[p]}</button>
        ))}
      </div>
    )
    chart = <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      {digitsRow}
      {found && row(places.map(p => column(p,
        p === help.place ? Array.from({ length: want }, (_, k) => <Block key={k} place={p} dim={k >= counted} onTap={k === counted ? () => setTally(x => x + 1) : undefined} />) : [],
        false, { lit: p === help.place })))}
    </div>
    below = found && <div style={{ fontFamily: FRED, fontWeight: 700, fontSize: 24, color: MATH_DEEP }}>{counted ? counted * help.place : ''}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{
        fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK,
        background: 'rgba(90,169,230,.1)', borderRadius: 14, padding: '8px 14px', textAlign: 'center', maxWidth: 300,
      }}>{bubble}</div>
      {chart}
      {below}
    </div>
  )
}

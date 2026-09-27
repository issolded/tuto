// Every font stack in the app, checked against the letters Turkish needs.
//
// Fredoka and Fredoka One — the two display faces the child app is built on — do not have
// ğ Ğ ş Ş İ. Read from the fonts themselves (fontTools over the woff2 files Google serves),
// not measured by eye: a browser draws a missing letter in whatever it finds next, so the
// word keeps its shape and only the accented letters quietly change typeface. That is how
// İ went unnoticed for months while ğ and ş were being fixed.
//
// src/index.css answers it with a 'TrRound' face — Baloo 2, restricted by unicode-range to
// exactly those five code points — that sits in front of Fredoka in every stack. This checks
// that no stack was written without it, which is the one way the bug comes back:
//
//   npm run font:check
//
// Exits non-zero on a real finding so it can gate a build.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const SRC = 'src'
const CSS = 'src/index.css'

// The five Fredoka lacks. Kept here as the codepoints so this file can be read against the
// unicode-range in index.css without decoding anything by hand.
const NEEDED = { 'ğ': 'U+011F', 'Ğ': 'U+011E', 'ş': 'U+015F', 'Ş': 'U+015E', 'İ': 'U+0130' }
// Families that carry the whole Turkish alphabet themselves, so a stack naming one is fine.
const FULL = ['TrRound', 'Baloo 2', 'Nunito', 'Lexend', 'Plus Jakarta Sans']
// Families that do not.
const PARTIAL = ['Fredoka One', 'Fredoka']
// Generic keywords: the system supplies them and every desktop and phone font has Turkish.
const GENERIC = ['sans-serif', 'serif', 'monospace', 'cursive', 'system-ui']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(jsx?|css)$/.test(path)) out.push(path)
  }
  return out
}

const findings = []

// ── 1. the face that supplies the missing letters still covers all five ──────
const css = readFileSync(CSS, 'utf8')
const face = css.match(/@font-face\s*{[^}]*?font-family:\s*'TrRound'[^}]*}/s)?.[0]
if (!face) {
  findings.push({ where: CSS, what: "the 'TrRound' @font-face is gone — nothing supplies ğ Ğ ş Ş İ to Fredoka" })
} else {
  const range = (face.match(/unicode-range:\s*([^;]+);/i)?.[1] ?? '').toUpperCase()
  const covered = (cp) => {
    const n = parseInt(cp.slice(2), 16)
    return range.split(',').some(part => {
      const m = part.trim().match(/^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/)
      if (!m) return false
      const lo = parseInt(m[1], 16)
      const hi = m[2] ? parseInt(m[2], 16) : lo
      return n >= lo && n <= hi
    })
  }
  for (const [letter, cp] of Object.entries(NEEDED)) {
    if (!covered(cp)) findings.push({ where: CSS, what: `TrRound's unicode-range leaves out ${letter} (${cp}), so it falls to whatever is next in the stack` })
  }
}

// ── 2. no stack names a partial family without the face that completes it ────
const constDef = /const\s+(\w+)\s*=\s*["']([^"']*(?:Fredoka|Baloo|Nunito|Lexend|Jakarta|TrRound)[^"']*)["']/g
// Two shapes, and they have to be read differently. In JS the whole stack is one string
// literal, quotes and all. In CSS it runs to the semicolon — reading it as "the first quoted
// thing" sees only 'Fredoka One' in "'Fredoka One', 'TrRound', 'Baloo 2'" and reports a
// perfectly good stack as broken.
const useOfJs = /fontFamily\s*[:=]\s*\{?\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Z][A-Z_0-9]*)/g
const useOfCss = /font-family\s*:\s*([^;}\n]+)/g

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8')
  const consts = new Map()
  for (const m of text.matchAll(constDef)) consts.set(m[1], m[2])

  const uses = [
    ...[...text.matchAll(useOfJs)].map(m => {
      const raw = m[1]
      const isLiteral = raw.startsWith('"') || raw.startsWith("'")
      return { index: m.index, stack: isLiteral ? raw.slice(1, -1) : consts.get(raw) }
    }),
    ...[...text.matchAll(useOfCss)].map(m => ({
      index: m.index, stack: m[1].replace(/!important/gi, '').trim(),
    })),
  ]

  for (const m of uses) {
    const stack = m.stack
    if (!stack) continue                       // a constant defined elsewhere, or not a font
    const families = stack.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, ''))
    if (families.every(f => GENERIC.includes(f))) continue          // system font, always fine

    const partial = families.find(f => PARTIAL.includes(f))
    if (!partial) continue                                          // nothing missing to cover
    const rescue = families.find(f => FULL.includes(f))
    if (!rescue) {
      const line = text.slice(0, m.index).split('\n').length
      findings.push({
        where: `${relative('.', file)}:${line}`,
        what: `"${stack}" — ${partial} has no ğ Ğ ş Ş İ and nothing in the stack supplies them, so they drop to the system font`,
      })
    }
  }
}

if (findings.length) {
  console.log(`${findings.length} finding${findings.length === 1 ? '' : 's'}:\n`)
  for (const f of findings) console.log(`  ${f.where}\n    ${f.what}\n`)
  process.exit(1)
}
console.log('every font stack keeps its Turkish letters in the family it chose')

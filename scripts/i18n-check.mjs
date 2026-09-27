// One check for every way a translation has actually broken in this app.
//
// Each of these shipped, separately, and each was found by a person opening the screen
// rather than by anything automatic:
//
//   1. English text left in JSX          — "Books from Other Authors" on a Turkish screen
//   2. Turkish text hardcoded in JSX     — the whole forest archive, on an English screen;
//                                          and, on the parent side, "Kendi çizimi" and the
//                                          whole tree card, sitting in an English-only screen
//   3. t() called without importing t    — the chores screen opened blank
//   4. t(key, lang) where lang is not in scope — four blank screens in one week
//   5. a key that is not in the dictionary — renders as the key itself, silently
//   6. an entry missing a language        — falls back to English, silently
//
// The first two are the reason this exists at all: a scan written to find one language is
// blind to the other, so it has to be language-agnostic. It reports script (Latin words) and
// checks them against the dictionary — anything a child would read that is not in there.
//
//   npm run i18n:check
//
// Exits non-zero on a real finding so it can gate a build.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const SRC = 'src'
// Two dictionaries, two audiences: what the CHILD reads and what the PARENT reads. They are
// separate files for the reason set out at the top of each, and both are checked here — the
// parent screens used to be exempt from the prose scan ("not translated yet"), which is how
// four Turkish sentences ended up living in an otherwise English screen.
const DICT = 'src/lib/i18n.js'
const PARENT_DICT = 'src/lib/parentI18n.js'
const EXPORTS = ['t', 'translator', 'childLang', 'formatDay', 'localeFor', 'LANGS', 'say', 'useT', 'pt']

// Files whose strings nobody reads on a screen: prompts sent to the model, and anything that
// never renders.
const NOT_USER_FACING = [
  'lib/gemini.js', 'lib/supabase.js', 'lib/mathTemplates.js', 'lib/mathCurriculum.js',
  'lib/mathVerify.js', 'main.jsx', 'App.jsx',
  // Not a screen exemption so much as a prompt one: ReadingFlow builds the model's
  // instructions inline, and forty lines of English addressed to Gemini is not UI text.
  // Its child-facing strings all go through t() and are covered by the unknown-key check.
  'screens/ReadingFlow.jsx',
  // Developer sandboxes. No child reaches them — they are unlisted routes whose whole content
  // is attribute names and audit counters, and translating that would hide what it reports.
  'screens/PuzzleLab.jsx', 'screens/EnglishLab.jsx',
  // The English engine and its lexicon. Two separate reasons, and neither is "not translated
  // yet". The lexicon is the module's subject matter: it is a list of English words, and the
  // question "why is `garment` not in Turkish" has no answer. The engine's English strings are
  // its BOOK_COVERAGE notes — prose about what the Bond paper has that this does not, read by
  // whoever picks the module up next, never by a child. Every string a child sees on an
  // English question is a stem key in i18n.js (eng_stem_*), and those follow children.language
  // like everything else.
  'lib/englishTemplates.js', 'lib/englishLexicon.generated.js',
  // The puzzle vocabulary tables. Their Turkish is not a string waiting to be translated, it is
  // one of the two readings a row already carries — every group, trait and relation is written
  // in both languages on purpose, because a relation that is obvious in English can be a shrug
  // in Turkish and the table is meant to be reviewed in both. Routing them through the
  // dictionary would put that side by side with UI copy and lose the pairing.
  'lib/puzzleGlyphs.js', 'lib/puzzleIcons.js',
]

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.jsx?$/.test(p)) out.push(p)
  }
  return out
}

const dictSrc = readFileSync(DICT, 'utf8')
const langs = [...dictSrc.matchAll(/code: '(\w+)'/g)].map(m => m[1])

// An entry can span several lines, so the field text runs to the closing brace rather than to
// the end of the line: a three-language entry wrapped for width was being read as one-language
// and reported missing two.
function readDict(src, marker) {
  const body = src.slice(src.indexOf(marker))
  return [...body.matchAll(/^ {2}(\w+):\s*\{([\s\S]*?)\},?$/gm)]
}

const entries = readDict(dictSrc, 'const STRINGS')
const keys = new Set(entries.map(e => e[1]))

const parentSrc = readFileSync(PARENT_DICT, 'utf8')
const parentEntries = readDict(parentSrc, 'const P = {')
const parentKeys = new Set(parentEntries.map(e => e[1]))

const findings = []
const add = (kind, file, line, detail) => findings.push({ kind, file, line, detail })

// ── 6. every entry carries every language, in both dictionaries ──────────────
for (const [dict, rows] of [[DICT, entries], [PARENT_DICT, parentEntries]]) {
  for (const [, key, fields] of rows) {
    for (const lang of langs) {
      if (!new RegExp(`\\b${lang}:`).test(fields)) add('missing-translation', dict, 0, `${key} → ${lang}`)
    }
  }
}

const used = new Set()
const parentUsed = new Set()
const dynamic = new Set()   // key prefixes built at runtime

// Which lines of a file sit inside a say(lang, en, tr, es) call.
//
// say() is the OTHER way a string gets translated: a dictionary key cannot carry a sentence
// with a number in the middle of it, so those are written out per language at the call site.
// The scans below look for prose sitting loose in the source, and every argument of a say()
// call looks exactly like that — so without this, adding a third language to a call made the
// report three findings worse for a line that had just been translated properly. A checker
// that gets noisier the more you translate is one people stop reading.
//
// Depth counting skips over quoted text, template literals included, so a `${cond ? 'a' : 'b'}`
// inside an argument does not close the call early.
function sayLines(src) {
  const lines = new Set()
  for (const m of src.matchAll(/\bsay\s*\(/g)) {
    let depth = 1
    let quote = null
    let i = m.index + m[0].length
    for (; i < src.length && depth > 0; i++) {
      const c = src[i]
      if (quote) {
        if (c === '\\') i++
        else if (c === quote) quote = null
        continue
      }
      if (c === '\'' || c === '"' || c === '`') { quote = c; continue }
      if (c === '(') depth++
      else if (c === ')') depth--
    }
    const from = src.slice(0, m.index).split('\n').length
    const to = src.slice(0, i).split('\n').length
    for (let n = from; n <= to; n++) lines.add(n)
  }
  return lines
}

for (const file of walk(SRC)) {
  if (/i18n\.js$|parentI18n\.js$/.test(file)) continue
  const userFacing = !NOT_USER_FACING.some(x => file.includes(x))
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const translated = sayLines(src)

  const imported = new Set(
    [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']*[iI]18n'/g)]
      .flatMap(m => m[1].split(',').map(s => s.trim()))
  )

  // ── 3. used without being imported ─────────────────────────────────────────
  for (const name of EXPORTS) {
    if (new RegExp(`[^\\w.]${name}\\s*\\(`).test(src) && !imported.has(name)) {
      add('missing-import', file, 0, name)
    }
  }

  // Walk scopes by brace depth so we know which function each line sits in, and which
  // identifiers that function can actually see. The build cannot catch an undefined
  // identifier inside JSX — it becomes a blank screen at runtime instead.
  const stack = []
  let depth = 0
  let inBlockComment = false

  lines.forEach((raw, i) => {
    const n = i + 1
    const code = raw.split('//')[0]
    // Block comments carry prose that looks exactly like UI text, so track them properly
    // rather than matching the first line and letting the body through.
    // Delimiters are only delimiters outside a string. `accept="image/*"` on the photo input
    // in DrawingsScreen opened a comment that nothing ever closed, and the next 113 lines —
    // the whole reward screen and half the library — were skipped as if they were prose. The
    // untranslated string that hid there only surfaced when an unrelated edit moved the lines.
    const bare = raw.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""')
    const wasInBlock = inBlockComment
    if (inBlockComment && bare.includes('*/')) inBlockComment = false
    else if (!inBlockComment && /\/\*/.test(bare) && !bare.includes('*/')) inBlockComment = true
    const isComment = wasInBlock || inBlockComment || /^\s*(\/\/|\*|\/\*)/.test(raw)

    if (!isComment) {
      const fn = code.match(/(?:export default |export )?function (\w+)\s*\(([^)]*)\)/)
              || code.match(/const (\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/)
      if (fn) stack.push({ name: fn[1], params: fn[2] ?? '', depth, locals: new Set() })

      const top = stack[stack.length - 1]
      if (top) {
        const d = code.match(/const \[?(\w+)/)
        if (d) top.locals.add(d[1])
      }

      // t(`score_${band}`) builds its key at runtime; record the prefix so the unused
      // report does not accuse a key that is reached this way.
      for (const m of code.matchAll(/\bt\(\s*`(\w+?)\$\{/g)) dynamic.add(m[1])

      // A bound translator: `const s = useT()` on a parent screen, `translator(lang)` on a
      // child one. Both are called the same way, so the key has to exist in one dictionary or
      // the other — in neither, it renders as the key itself, which is the same silent failure
      // an unknown t() key is.
      for (const m of code.matchAll(/(?<![\w.])s\(\s*[`'](\w+)[`']/g)) {
        parentUsed.add(m[1]); used.add(m[1])
        if (!parentKeys.has(m[1]) && !keys.has(m[1])) add('unknown-key', file, n, `${m[1]} (via s())`)
      }
      // Any key built from a template — s(`cap_note_${key}`), childT(`task_${key}`, lang) —
      // is the same runtime-built shape as t(`score_${band}`) and gets the same exemption.
      for (const m of code.matchAll(/`(\w+?)\$\{/g)) dynamic.add(m[1])

      for (const m of code.matchAll(/\bt\(\s*'(\w+)'\s*,\s*(\w+)\s*\)/g)) {
        used.add(m[1])
        // ── 5. key exists ──────────────────────────────────────────────────
        if (!keys.has(m[1])) add('unknown-key', file, n, m[1])
        // ── 4. the lang argument is in scope ───────────────────────────────
        // Only judge when the enclosing function is known. Brace-depth tracking drifts in
        // very large files, and a checker that cries wolf gets ignored — every real crash it
        // has caught so far had a named scope.
        const scope = stack[stack.length - 1]
        if (scope) {
          const visible = new RegExp(`\\b${m[2]}\\b`).test(scope.params) || scope.locals.has(m[2])
          if (!visible) add('lang-out-of-scope', file, n, `${m[2]} in ${scope.name}`)
        }
      }

      depth += (code.match(/{/g) ?? []).length - (code.match(/}/g) ?? []).length
      while (stack.length && depth <= stack[stack.length - 1].depth) stack.pop()
    }

    // ── 1 & 2. text a child would read, sitting in the source ────────────────
    // Bare text on its own line inside JSX is the shape that hid the library, and it is
    // the shape a regex over quoted strings can never see.
    if (!userFacing || isComment || translated.has(n)) return
    const text = raw.trim()
    if (!text || text.startsWith('<') || text.startsWith('{') || text.startsWith('import')) return
    if (/^[^A-Za-zÀ-ÿĞğŞşİıÇçÖöÜü]*$/.test(text)) return          // punctuation/emoji only
    if (/[{}<>=;()[\]`]/.test(text)) return                        // code, not prose
    if (text.endsWith(',')) return                                 // a style prop, continued
    if (/^(return|const|let|var|else|case|default)\b/.test(text)) return   // a statement
    if (/^[?:.|&]/.test(text)) return                              // a continued expression
    if (/\b[\w-]+:\s/.test(text)) return                          // key: value, not a sentence
    const words = text.split(/\s+/).filter(w => /[A-Za-zÀ-ÿĞğŞşİıÇçÖöÜü]{2,}/.test(w))
    if (words.length < 2) return
    add('hardcoded-text', file, n, text.slice(0, 60))
  })

  // Prose in a quoted string inside a JSX expression — {busy ? 'Sending…' : 'Add'}.
  // This shape defeated both earlier scans, and the unused-key report is what exposed it:
  // keys had been written for strings that were still sitting here untranslated.
  if (userFacing) {
    lines.forEach((raw, i) => {
      if (translated.has(i + 1)) return
      const text = raw.trim()
      if (/^(import|export|const [A-Z_]+ =)/.test(text)) return
      if (!/[{?:]/.test(text)) return
      for (const m of raw.matchAll(/'([^'\\]{4,60})'/g)) {
        const v = m[1]
        // Style values outnumber prose here by roughly ten to one, so the filter is written
        // to let through only what reads like a sentence a child would see.
        if (/[:;(){}<>=|#\\]|^,|,$/.test(v)) continue                     // style / code
        if (/\d/.test(v)) continue                                       // 12px 28px, 1fr
        if (/sans-serif|serif|cursive|monospace|Fredoka|Baloo|Nunito|Georgia|Jakarta|Lexend/.test(v)) continue
        const words = v.split(/\s+/).filter(w => /^[A-Za-zÀ-ÿĞğŞşİıÇçÖöÜü'’.,!?…-]+$/.test(w)
                                                && /[A-Za-zÀ-ÿĞğŞşİıÇçÖöÜü]{2}/.test(w))
        if (words.length !== v.split(/\s+/).length) continue             // something unwordy
        const looksWritten = /^[A-ZÀ-ÿĞŞİÇÖÜ]/.test(v) || /[.!?…]$/.test(v)
                          || /[\u{1F300}-\u{1FAFF}\u2600-\u27BF✓◷]/u.test(v)
        if (!looksWritten || words.length < 2) continue
        add('hardcoded-expr', file, i + 1, v)
      }
    })
  }

  // Quoted prose passed to a prop that renders — title=, placeholder=, aria-label=
  if (userFacing) {
    lines.forEach((raw, i) => {
      for (const m of raw.matchAll(/(?:title|placeholder|aria-label)="([^"]{4,})"/g)) {
        // A mask, not a sentence: placeholder="XXXXXXXX" and the like have nothing to translate.
        if (!/[a-zà-ÿğşıçöü]/.test(m[1]) && !/\s/.test(m[1])) continue
        // An address or a URL is the same in every language; there is nothing to translate.
        if (/^\S+@\S+\.\S+$/.test(m[1]) || /^https?:\/\//.test(m[1])) continue
        add('hardcoded-attr', file, i + 1, m[1].slice(0, 60))
      }
    })
  }
}

// ── unused keys: not a failure, but they rot ─────────────────────────────────
const allSrc = walk(SRC).filter(f => !/i18n\.js$|parentI18n\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n')
const isUnused = (k, seen) => !seen.has(k) && !new RegExp(`'${k}'`).test(allSrc) && ![...dynamic].some(p => k.startsWith(p))
const unused = [...keys].filter(k => isUnused(k, used))
const parentUnused = [...parentKeys].filter(k => isUnused(k, parentUsed))

const order = ['missing-import', 'lang-out-of-scope', 'unknown-key', 'hardcoded-text', 'hardcoded-expr', 'hardcoded-attr', 'missing-translation']
findings.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))

if (!findings.length) {
  console.log(`i18n ok — ${keys.size} child keys + ${parentKeys.size} parent keys, ${langs.length} languages (${langs.join(', ')})`)
} else {
  let last = ''
  for (const f of findings) {
    if (f.kind !== last) { console.log(`\n${f.kind}`); last = f.kind }
    console.log(`  ${f.file}${f.line ? ':' + f.line : ''}  ${f.detail}`)
  }
  console.log(`\n${findings.length} findings`)
}
if (unused.length) console.log(`\nunused child keys (${unused.length}): ${unused.join(', ')}`)
if (parentUnused.length) console.log(`\nunused parent keys (${parentUnused.length}): ${parentUnused.join(', ')}`)

// A hardcoded string renders; a missing import does not. Only fail on the ones that break.
const fatal = findings.filter(f => ['missing-import', 'lang-out-of-scope', 'unknown-key'].includes(f.kind))
process.exit(fatal.length ? 1 : 0)

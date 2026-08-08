// One check for every way a translation has actually broken in this app.
//
// Each of these shipped, separately, and each was found by a person opening the screen
// rather than by anything automatic:
//
//   1. English text left in JSX          — "Books from Other Authors" on a Turkish screen
//   2. Turkish text hardcoded in JSX     — the whole forest archive, on an English screen
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
const DICT = 'src/lib/i18n.js'
const EXPORTS = ['t', 'translator', 'childLang', 'formatDay', 'localeFor', 'LANGS']

// Files whose strings are not read by a child: prompts sent to the model, parent-only
// screens (the parent UI is not translated yet), and anything that never renders.
const NOT_CHILD_FACING = [
  'lib/gemini.js', 'lib/supabase.js', 'lib/mathTemplates.js', 'lib/mathCurriculum.js',
  'screens/Parent', 'screens/ReadingFlow.jsx', 'main.jsx', 'App.jsx',
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
const body = dictSrc.slice(dictSrc.indexOf('const STRINGS'), dictSrc.indexOf('\n}\n'))
const entries = [...body.matchAll(/^ {2}(\w+):\s*\{([^}]*)\}/gm)]
const keys = new Set(entries.map(e => e[1]))

const findings = []
const add = (kind, file, line, detail) => findings.push({ kind, file, line, detail })

// ── 6. every entry carries every language ────────────────────────────────────
for (const [, key, fields] of entries) {
  for (const lang of langs) {
    if (!new RegExp(`\\b${lang}:`).test(fields)) add('missing-translation', DICT, 0, `${key} → ${lang}`)
  }
}

const used = new Set()
const dynamic = new Set()   // key prefixes built at runtime

for (const file of walk(SRC)) {
  if (file.endsWith('i18n.js')) continue
  const childFacing = !NOT_CHILD_FACING.some(x => file.includes(x))
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')

  const imported = new Set(
    [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']*i18n'/g)]
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
    const wasInBlock = inBlockComment
    if (inBlockComment && raw.includes('*/')) inBlockComment = false
    else if (!inBlockComment && /\/\*/.test(raw) && !raw.includes('*/')) inBlockComment = true
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
    if (!childFacing || isComment) return
    const text = raw.trim()
    if (!text || text.startsWith('<') || text.startsWith('{') || text.startsWith('import')) return
    if (/^[^A-Za-zÀ-ÿĞğŞşİıÇçÖöÜü]*$/.test(text)) return          // punctuation/emoji only
    if (/[{}<>=;()[\]`]/.test(text)) return                        // code, not prose
    if (text.endsWith(',')) return                                 // a style prop, continued
    if (/\b[\w-]+:\s/.test(text)) return                          // key: value, not a sentence
    const words = text.split(/\s+/).filter(w => /[A-Za-zÀ-ÿĞğŞşİıÇçÖöÜü]{2,}/.test(w))
    if (words.length < 2) return
    add('hardcoded-text', file, n, text.slice(0, 60))
  })

  // Quoted prose passed to a prop that renders — title=, placeholder=, aria-label=
  if (childFacing) {
    lines.forEach((raw, i) => {
      for (const m of raw.matchAll(/(?:title|placeholder|aria-label)="([^"]{4,})"/g)) {
        add('hardcoded-attr', file, i + 1, m[1].slice(0, 60))
      }
    })
  }
}

// ── unused keys: not a failure, but they rot ─────────────────────────────────
const allSrc = walk(SRC).filter(f => !f.endsWith('i18n.js')).map(f => readFileSync(f, 'utf8')).join('\n')
const unused = [...keys].filter(k =>
  !used.has(k) &&
  !new RegExp(`'${k}'`).test(allSrc) &&
  ![...dynamic].some(p => k.startsWith(p))
)

const order = ['missing-import', 'lang-out-of-scope', 'unknown-key', 'hardcoded-text', 'hardcoded-attr', 'missing-translation']
findings.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))

if (!findings.length) {
  console.log(`i18n ok — ${keys.size} keys, ${langs.length} languages (${langs.join(', ')})`)
} else {
  let last = ''
  for (const f of findings) {
    if (f.kind !== last) { console.log(`\n${f.kind}`); last = f.kind }
    console.log(`  ${f.file}${f.line ? ':' + f.line : ''}  ${f.detail}`)
  }
  console.log(`\n${findings.length} findings`)
}
if (unused.length) console.log(`\nunused keys (${unused.length}): ${unused.join(', ')}`)

// A hardcoded string renders; a missing import does not. Only fail on the ones that break.
const fatal = findings.filter(f => ['missing-import', 'lang-out-of-scope', 'unknown-key'].includes(f.kind))
process.exit(fatal.length ? 1 : 0)

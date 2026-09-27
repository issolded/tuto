// Builds the Android app's copies of web code. Run from the repo root after `npm ci` there and in
// mobile/engine:   node mobile/engine/build.mjs
//
//   androidApp/src/main/assets/engine/math.js   the web maths engine + figures (entry.jsx), for QuickJS
//   androidApp/src/main/assets/i18n.json        the child's dictionary, src/lib/i18n.js, all languages
//   androidApp/src/main/assets/lottie/*.json    Tuto and the task icons (design/native-icons)
//
// Generated, not committed: the web files are the source and these are rebuilt on every CI run.
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const assets = join(here, '..', 'androidApp', 'src', 'main', 'assets')
mkdirSync(join(assets, 'engine'), { recursive: true })
mkdirSync(join(assets, 'lottie'), { recursive: true })

// QuickJS has no TextEncoder or MessageChannel, both of which React's server renderer and its
// scheduler touch when they load. Rendering here is synchronous, so small stand-ins are enough.
const prelude = `
if (typeof TextEncoder === 'undefined') {
  globalThis.TextEncoder = class { encode(s) { const u = unescape(encodeURIComponent(String(s))); const a = new Uint8Array(u.length); for (let i = 0; i < u.length; i++) a[i] = u.charCodeAt(i); return a } };
}
if (typeof TextDecoder === 'undefined') {
  globalThis.TextDecoder = class { decode(a) { let s = ''; for (let i = 0; i < (a ? a.length : 0); i++) s += String.fromCharCode(a[i]); return decodeURIComponent(escape(s)) } };
}
if (typeof queueMicrotask === 'undefined') globalThis.queueMicrotask = (f) => Promise.resolve().then(f);
if (typeof setTimeout === 'undefined') { globalThis.setTimeout = (f) => { Promise.resolve().then(f); return 0 }; globalThis.clearTimeout = () => {} }
if (typeof MessageChannel === 'undefined') {
  globalThis.MessageChannel = class { constructor() { const a = { onmessage: null }, b = { onmessage: null }; a.postMessage = (d) => setTimeout(() => b.onmessage && b.onmessage({ data: d })); b.postMessage = (d) => setTimeout(() => a.onmessage && a.onmessage({ data: d })); this.port1 = a; this.port2 = b } };
}
if (typeof console === 'undefined') globalThis.console = { log() {}, warn() {}, error() {}, info() {} };
`

await build({
  entryPoints: [join(here, 'entry.jsx')],
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  mainFields: ['browser', 'module', 'main'],
  conditions: ['browser', 'default'],
  target: 'es2020',
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  banner: { js: prelude },
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env': '{}',
  },
  // The web modules are resolved from the web app's own node_modules.
  nodePaths: [join(root, 'node_modules')],
  outfile: join(assets, 'engine', 'math.js'),
  logLevel: 'warning',
})

// The child's dictionary. STRINGS is private to i18n.js; its keys are read off the source and
// every key is looked up through the module's own t(), so fallbacks behave exactly as on the web.
const { t, LANGS } = await import(join(root, 'src', 'lib', 'i18n.js'))
const src = readFileSync(join(root, 'src', 'lib', 'i18n.js'), 'utf8')
const keys = [...new Set([...src.matchAll(/^\s{2}([a-z][a-z0-9_]*):\s*\{/gm)].map(m => m[1]))]
const langs = LANGS.map(l => (typeof l === 'string' ? l : l.code))
const dict = {}
for (const k of keys) {
  dict[k] = {}
  for (const l of langs) dict[k][l] = t(k, l)
}
writeFileSync(join(assets, 'i18n.json'), JSON.stringify({ langs, strings: dict }))

cpSync(join(root, 'design', 'native-icons', 'lottie'), join(assets, 'lottie'), { recursive: true })
console.log(`engine + ${keys.length} strings x ${langs.length} langs + lottie -> ${assets}`)

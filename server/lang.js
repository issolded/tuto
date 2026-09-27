// The languages the PARENT can be written to in, and the two helpers every message uses.
//
// This mirrors src/lib/i18n.js rather than importing it: the server is a separate deploy with
// no build step over src/, and the child dictionary is 300 strings of screen text the server
// has no use for. What has to stay in step is the list of codes, and it is short.
//
// Until today the server chose with `prefs.language === 'en' ? 'en' : 'tr'`, forty-six times.
// That shape is not wrong so much as unable to grow: a third language reads as Turkish at every
// one of those sites, silently. parentLang() names the set, say() picks from it, and an unknown
// code lands on Turkish as it always did.
export const PARENT_LANGS = [
  { code: 'tr', name: 'Turkish', label: 'Türkçe' },
  { code: 'en', name: 'English', label: 'English' },
  { code: 'es', name: 'Spanish', label: 'Español' },
]

const KNOWN = new Set(PARENT_LANGS.map(l => l.code))

// English, and it is a product decision rather than a technical one: Turkish was the default
// because the first family was Turkish, which stops being a good reason the moment anyone else
// signs up. Every parent on the system today has 'tr' written into their row explicitly (the
// column default put it there), so changing this moves nobody — see
// server/migrations/2026-09-08_parent_language_default.sql, which backfills any row that
// somehow lacks the key before the column default flips too.
export const DEFAULT_PARENT_LANG = 'en'

export function parentLang(prefs) {
  const code = prefs?.language
  return KNOWN.has(code) ? code : DEFAULT_PARENT_LANG
}

// say(lang, english, turkish, spanish). A missing translation falls back to English rather
// than printing `undefined` to a parent.
export function say(lang, en, tr, es) {
  if (lang === 'tr') return tr ?? en
  if (lang === 'es') return es ?? en
  return en
}

// For prompts: "write in ${langName(lang)}".
export function langName(lang) {
  return (PARENT_LANGS.find(l => l.code === lang) ?? PARENT_LANGS[0]).name
}

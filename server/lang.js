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

// Turkish is the default for the same reason the column default is: these are the families
// already on the system, and none of them chose anything.
export const DEFAULT_PARENT_LANG = 'tr'

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

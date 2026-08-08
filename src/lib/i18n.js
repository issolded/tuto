// The words the CHILD reads, in the language their parent chose for them.
//
// Everything the child is asked — questions, hints, the model's replies — already follows
// children.language. This is the frame around it: the tiles, the greetings, the buttons. A
// Turkish-speaking child was solving Turkish questions inside an English app.
//
// One flat dictionary rather than a file per screen: there are not many strings, and a single
// list makes a missing translation obvious. Keys read as English so a screen stays legible
// without cross-referencing.
const STRINGS = {
  // ── ChildHome ───────────────────────────────────────────────────────────────
  greeting_morning:   { en: 'Good morning ☀️',      tr: 'Günaydın ☀️' },
  greeting_afternoon: { en: 'Good afternoon 👋',    tr: 'İyi günler 👋' },
  greeting_evening:   { en: 'Good evening 🌙',      tr: 'İyi akşamlar 🌙' },
  hello_name:         { en: 'Hello',                tr: 'Merhaba' },
  friend:             { en: 'Friend',               tr: 'Arkadaşım' },
  all_done_young:     { en: 'You did everything today! 🌟', tr: 'Bugün her şeyi yaptın! 🌟' },
  all_done_mature:    { en: 'You did everything today',     tr: 'Bugün her şeyi tamamladın' },
  start_young:        { en: "Let's start today 🌱",  tr: 'Hadi bugüne başlayalım 🌱' },
  start_mature:       { en: 'Get started today',     tr: 'Bugüne başla' },

  // Activity names — shown on the home tiles and in the gem history.
  task_reading:       { en: 'My Books',      tr: 'Kitaplarım' },
  task_math:          { en: 'My Math',       tr: 'Matematik' },
  task_writing:       { en: 'My Stories',    tr: 'Hikâyelerim' },
  task_homework:      { en: 'My Homework',   tr: 'Ödevlerim' },
  task_drawing:       { en: 'My Drawings',   tr: 'Çizimlerim' },
  task_tree:          { en: 'My Tree',       tr: 'Ağacım' },
  chip_books:         { en: 'Books',         tr: 'Kitap' },
  chip_math:          { en: 'Math',          tr: 'Matematik' },
  chip_story:         { en: 'Story',         tr: 'Hikâye' },
  chip_homework:      { en: 'Homework',      tr: 'Ödev' },
  chip_drawing:       { en: 'Drawing',       tr: 'Çizim' },

  // ── Navigation (rail on tablet, bar on phone) ───────────────────────────────
  nav_home:           { en: 'Home',     tr: 'Ana Sayfa' },
  nav_library:        { en: 'Library',  tr: 'Kitaplık' },
  // "Gem" stays the currency word everywhere — parent messages, the ledger, the parent app —
  // so translating it here alone would split the name in two.
  nav_gems:           { en: 'Gems',     tr: 'Gem’lerim' },
  nav_goals:          { en: 'Goals',    tr: 'Hedeflerim' },

  // ── GemsScreen ──────────────────────────────────────────────────────────────
  gems_history:       { en: 'History',       tr: 'Geçmiş' },
  gems_none_title:    { en: 'No gems yet!',  tr: 'Henüz gem yok!' },
  gems_none_body:     { en: 'Complete a task to earn your first gems! ⭐', tr: 'İlk gem’lerini kazanmak için bir görev tamamla! ⭐' },
  gems_today:         { en: 'Today',         tr: 'Bugün' },
  gems_yesterday:     { en: 'Yesterday',     tr: 'Dün' },

  // ── MathScreen: the frame around the questions ──────────────────────────────
  math_mode_title:    { en: 'How do you want to work? 🤔', tr: 'Nasıl çalışmak istersin? 🤔' },
  math_on_paper:      { en: 'On Paper',      tr: 'Kâğıtta' },
  math_on_screen:     { en: 'On Screen',     tr: 'Ekranda' },
  math_paper_desc:    { en: 'We love pen and paper! Your brain grows every time you write! 🧠',
                        tr: 'Kalem kâğıt harika! Her yazdığında beynin büyür! 🧠' },
  math_screen_desc:   { en: 'Type your answers right here, one by one.',
                        tr: 'Cevaplarını burada tek tek yaz.' },
  math_up_to_gems:    { en: 'Up to',         tr: 'En fazla' },
  math_gems_word:     { en: 'Gems',          tr: 'Gem' },
  math_lets_go:       { en: "Let's go! →",   tr: 'Hadi başlayalım! →' },
  math_correct:       { en: 'correct',       tr: 'doğru' },
  math_back_home:     { en: 'Back home',     tr: 'Ana sayfaya dön' },
}

// `t('math_on_paper', lang)` — falls back to English rather than showing a key, because a
// missing translation should read oddly, not break the screen.
export function t(key, lang) {
  const entry = STRINGS[key]
  if (!entry) return key
  return (lang === 'tr' ? entry.tr : entry.en) ?? entry.en
}

// For a component that reads many strings: `const s = translator(lang); s('task_math')`.
export function translator(lang) {
  return (key) => t(key, lang)
}

export function childLang(child) {
  return child?.language === 'tr' ? 'tr' : 'en'
}

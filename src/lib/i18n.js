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
  start_young:        { en: "Let's start today 🌱",  tr: 'Haydi bugüne başlayalım 🌱' },
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

  // ── My Tree ─────────────────────────────────────────────────────────────────
  tree_leaves_today:  { en: 'leaves today',  tr: 'yaprak bugün' },
  tree_this_month:    { en: 'this month 🌳', tr: 'bu ay 🌳' },
  tree_title:         { en: 'My Tree 🌳',    tr: 'Ağacım 🌳' },
  tree_meet:          { en: 'Meet your tree! 🌳', tr: 'Ağacınla tanış! 🌳' },
  tree_my_part:       { en: 'My Part 💪',    tr: 'Benim Payım 💪' },
  tree_helped_today:  { en: 'Did you help today? Tap one 👇', tr: 'Bugün yardım ettin mi? Birine dokun 👇' },
  tree_add_today:     { en: 'Add to today',  tr: 'Bugüne ekle' },
  tree_nothing_yet:   { en: 'Nothing logged yet today.', tr: 'Bugün henüz bir şey eklemedin.' },
  tree_all_caught_up: { en: 'All caught up — nice work! 🌟', tr: 'Hepsi tamam — çok iyi! 🌟' },
  tree_what_did_you:  { en: 'What did you do to help?', tr: 'Yardım için ne yaptın?' },
  tree_something_else:{ en: 'Did something else? Write it here', tr: 'Başka bir şey mi yaptın? Buraya yaz' },
  tree_add_photo:     { en: 'Add with photo', tr: 'Fotoğrafla ekle' },
  tree_add_no_photo:  { en: 'Add without a photo', tr: 'Fotoğrafsız ekle' },
  tree_cancel:        { en: 'Cancel',        tr: 'Vazgeç' },
  tree_sending:       { en: 'Sending…',      tr: 'Gönderiliyor…' },
  tree_sending_photo: { en: 'Sending photo…', tr: 'Fotoğraf gönderiliyor…' },
  tree_sent:          { en: 'Sent for approval', tr: 'Onaya gönderildi' },
  tree_logged_young:  { en: 'Logged it! Your parent will confirm soon 🌱', tr: 'Kaydettim! Annen baban birazdan onaylayacak 🌱' },
  tree_logged_mature: { en: 'Logged — your parent will confirm it.', tr: 'Kaydedildi — annen baban onaylayacak.' },
  tree_nice_check:    { en: 'Nice! I’ll check this with your parent 🌱', tr: 'Harika! Bunu annenle babanla konuşacağım 🌱' },
  tree_approved:      { en: 'Approved',      tr: 'Onaylandı' },
  tree_pending:       { en: 'Pending',       tr: 'Bekliyor' },
  tree_waiting:       { en: 'Waiting',       tr: 'Bekliyor' },

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
                        tr: 'Gerçek uzmanlar kalem ve kâğıt kullanır, ekran amatörlerin işi! 🧠' },
  math_screen_desc:   { en: 'Type your answers right here, one by one.',
                        tr: 'Cevaplarını burada tek tek yaz.' },
  math_up_to_gems:    { en: 'Up to',         tr: 'En fazla' },
  math_gems_word:     { en: 'Gems',          tr: 'Gem' },
  math_lets_go:       { en: "Let's go! →",   tr: 'Haydi başlayalım! →' },
  math_correct:       { en: 'correct',       tr: 'doğru' },
  math_back_home:     { en: 'Back home',     tr: 'Ana sayfaya dön' },
  // Score messages: three bands × three ages. Kept whole rather than assembled from pieces —
  // an encouragement stitched together from fragments reads like one.
  score_hi_young:     { en: "WOW! You're a math superstar! 🌟 I'm so proud of you!", tr: 'VAY! Sen bir matematik yıldızısın! 🌟 Seninle gurur duyuyorum!' },
  score_hi_mid:       { en: "Excellent work! You crushed it! 🔥 Keep those math skills sharp!", tr: 'Mükemmel! Hepsini götürdün! 🔥 Böyle devam!' },
  score_hi_older:     { en: "Outstanding! 🌟 Your math skills are seriously impressive!", tr: 'Muhteşem! 🌟 Matematiğin cidden çok iyi!' },
  score_mid_young:    { en: "Great job! You did really well! ⭐ Let's keep practicing!", tr: 'Aferin! Gerçekten iyi yaptın! ⭐ Haydi çalışmaya devam!' },
  score_mid_mid:      { en: "Nice work! You're getting stronger every session! 💪", tr: 'Güzel iş! Her seferinde daha da güçleniyorsun! 💪' },
  score_mid_older:    { en: "Good effort! You're making solid progress! 💡", tr: 'İyi uğraştın! Sağlam ilerliyorsun! 💡' },
  score_low_young:    { en: "You're trying so hard and that makes me happy! 🤗 Let's practice more!", tr: 'Çok uğraşıyorsun, bu beni mutlu ediyor! 🤗 Biraz daha çalışalım!' },
  score_low_mid:      { en: "You gave it your best! 💪 Every practice makes you better!", tr: 'Daha da iyi olacağız! 💪' },
  score_low_older:    { en: "Keep pushing! Every challenge helps you grow! 💪", tr: 'Devam et! Her zorluk seni büyütüyor! 💪' },
  score_vlow_young:   { en: "It's okay! Math takes practice and you're doing amazing! 🤗", tr: 'Önemli değil! Matematik çalışmak ister, sen harika gidiyorsun! 🤗' },
  score_vlow_mid:     { en: "These were tough! You'll get there with practice! 💪", tr: 'Zor sorulardı! Çalıştıkça daha da iyi olacağız! 💪' },
  score_vlow_older:   { en: "Challenging problems! Persistence is the key to mastery! 🔑", tr: 'Zorlu sorulardı! Ustalığın anahtarı pes etmemek! 🔑' },
  // Paper mode — its own screen, never translated at all.
  math_paper_title:   { en: 'My Math 🔢',  tr: 'Matematiğim 🔢' },
  math_paper_now:     { en: 'Now solve these on paper! ✏️', tr: 'Şimdi bunları kâğıtta çöz! ✏️' },
  math_paper_ready:   { en: "I'm ready, Tuto! 📸", tr: 'Hazırım Tuto! 📸' },
  math_paper_hint:    { en: 'Hint', tr: 'İpucu' },

  // Per-question feedback and the result screen.
  math_yes:           { en: 'Yes! ⭐',      tr: 'Doğru! ⭐' },
  math_almost:        { en: 'Almost! The answer was', tr: 'Az kaldı! Doğrusu' },
  math_your_answers:  { en: 'Your answers:', tr: 'Senin cevapların:' },
  math_your_answer:   { en: 'Your answer:',  tr: 'Senin cevabın:' },
  math_answer_was:    { en: 'The answer was', tr: 'Doğrusu' },
  math_new_level:     { en: 'You unlocked a new level! 🎉', tr: 'Yeni bir seviye açtın! 🎉' },
  math_done:          { en: 'Done',          tr: 'Bitti' },
  math_score:         { en: 'Score',         tr: 'Puan' },
  math_earned:        { en: 'Earned',        tr: 'Kazandın' },

  // Leaving mid-session — the answers so far are lost, so it asks first.
  math_leave_title:   { en: 'Leave this session?', tr: 'Buradan çıkalım mı?' },
  math_leave_body:    { en: 'Your answers so far will not be saved.', tr: 'Şimdiye kadarki cevapların kaydedilmeyecek.' },
  math_leave_stay:    { en: 'Keep going', tr: 'Devam edeyim' },
  math_leave_go:      { en: 'Leave',      tr: 'Çık' },

  math_adventure:     { en: 'Math Adventure', tr: 'Matematik Macerası' },
  math_preparing:     { en: 'Preparing your puzzles…', tr: 'Sorularını hazırlıyorum…' },
  math_checking:      { en: 'Checking your work…',     tr: 'Yaptıklarına bakıyorum…' },
  math_save_failed:   { en: "Couldn't save — try again later", tr: 'Kaydedemedim — birazdan tekrar dene' },
  math_welcome_young: { en: "Let's go on a number adventure! 🚀\nI'll show you some fun puzzles — just do your best!",
                        tr: 'Haydi sayı macerasına çıkalım! 🚀\nSana eğlenceli sorular göstereceğim!' },
  math_welcome_mid:   { en: "Time to level up your math powers! ⚡\nShow me what you've got!",
                        tr: 'Matematik gücünü artırma zamanı! ⚡\nHaydi göster kendini!' },
  math_welcome_older: { en: "Ready for a challenge? 🔥\nLet's see those math skills!",
                        tr: 'Zorlu bir şeye hazır mısın? 🔥\nBakalım matematiğin nasıl!' },
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

// Dates were formatted with a hardcoded locale — 'en-GB' in the library and drawings,
// 'en-US' on the tree — so a Turkish child read "16 Jul" and "Friday, August 8". One helper,
// driven by the same language as everything else.
export function localeFor(lang) {
  return lang === 'tr' ? 'tr-TR' : 'en-GB'
}

export function formatDay(iso, lang, opts = { day: 'numeric', month: 'short' }) {
  const d = iso instanceof Date ? iso : new Date(iso)
  return isNaN(d) ? '' : d.toLocaleDateString(localeFor(lang), opts)
}

export function childLang(child) {
  return child?.language === 'tr' ? 'tr' : 'en'
}

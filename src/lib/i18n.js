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

  home_trees_month:   { en: 'trees this month', tr: 'ağaç bu ay' },
  home_to_goal:       { en: 'to',        tr: 'kaldı:' },
  home_so_close:      { en: 'So close to', tr: 'Çok az kaldı:' },
  home_always_on:     { en: '🌱 Always on', tr: '🌱 Her zaman açık' },

  // ── Goals ───────────────────────────────────────────────────────────────────
  goal_claim:         { en: 'Claim! 🎉',  tr: 'İstiyorum! 🎉' },
  goal_claiming:      { en: 'Claiming…',  tr: 'Gönderiliyor…' },

  // ── Homework ────────────────────────────────────────────────────────────────
  hw_title:           { en: 'My Homework', tr: 'Ödevlerim' },
  hw_looking:         { en: 'Tuto is looking at your homework', tr: 'Tuto ödevine bakıyor' },
  hw_need_photo:      { en: 'Add at least one photo', tr: 'En az bir fotoğraf ekle' },
  hw_today_q:         { en: 'Did you do this homework today?', tr: 'Bu ödevi bugün mü yaptın?' },
  hw_send:            { en: 'Send to Tuto',  tr: "Tuto'ya gönder" },
  hw_sending:         { en: 'Sending…',      tr: 'Gönderiliyor…' },
  hw_great:           { en: 'Great job! 🎉', tr: 'Harika iş! 🎉' },
  hw_yes_today:       { en: 'Yes, today',    tr: 'Evet, bugün' },

  // ── Library ─────────────────────────────────────────────────────────────────
  lib_title:          { en: 'My Library 📚', tr: 'Kitaplığım 📚' },
  lib_loading:        { en: 'Loading...',    tr: 'Yükleniyor…' },
  lib_no_books:       { en: 'No books yet!',   tr: 'Henüz kitap yok!' },
  lib_no_stories:     { en: 'No stories yet!', tr: 'Henüz hikâye yok!' },
  lib_not_yet:        { en: 'Not yet...',    tr: 'Henüz değil…' },
  // Was also called lib_finished and lost to the section header of the same name below, so
  // the "did you really finish it?" dialog answered itself with "Finished Books 🏆".
  lib_yes_read_all:   { en: 'Yes, I read it all! 📚', tr: 'Evet, hepsini okudum! 📚' },
  lib_remove_q:       { en: 'Remove this book?', tr: 'Bu kitabı kaldıralım mı?' },
  lib_remove_body:    { en: 'Are you sure you want to remove this book from your library?',
                        tr: 'Bu kitabı kitaplığından kaldırmak istediğine emin misin?' },
  lib_remove:         { en: 'Remove', tr: 'Kaldır' },
  lib_cancel:         { en: 'Cancel', tr: 'Vazgeç' },

  lib_my_books:       { en: '✍️ Books I Wrote', tr: '✍️ Benim Yazdığım Kitaplar' },
  lib_write_first:    { en: 'Write your first story →', tr: 'İlk hikâyeni yaz →' },
  lib_add_first:      { en: 'Add your first book →',    tr: 'İlk kitabını ekle →' },
  lib_reading_now:    { en: 'Reading Now 📖',    tr: 'Şu An Okuduklarım 📖' },
  lib_finished:       { en: 'Finished Books 🏆', tr: 'Bitirdiklerim 🏆' },
  lib_really_done:    { en: 'Wow, did you really finish the whole book? 🎉', tr: 'Vay, kitabın hepsini bitirdin mi? 🎉' },
  lib_amazing:        { en: 'Amazing! You finished', tr: 'Harika! Bitirdiğin kitap:' },
  story_untitled:     { en: 'Untitled Story', tr: 'Adsız Hikâye' },
  story_in_progress:  { en: 'In Progress',    tr: 'Devam ediyor' },

  lib_other_authors:  { en: '📚 Books from Other Authors', tr: '📚 Başka Yazarların Kitapları' },
  lib_write:          { en: '✏️ Write', tr: '✏️ Yaz' },
  lib_add:            { en: '+ Add',    tr: '+ Ekle' },
  lib_books_of:       { en: "📖 Books by",  tr: '📖 Kendi Kitapları:' },
  // A book with no page count gets a page number instead of a percentage — an honest "page 42"
  // rather than a bar filled to a fraction of a total nobody knows.
  lib_page:           { en: 'page', tr: 'sayfa' },
  // Turkish puts the sign before the number and English after it. Two keys rather than a
  // format string because one of them is empty in each language, which no placeholder does.
  lib_pct_before:     { en: '',  tr: '%' },
  lib_pct_after:      { en: '%', tr: ''  },

  // ── ReadingFlow ─────────────────────────────────────────────────────────────
  // %title%, %n%, %c%, %a% are filled in by the screen. The whole flow was English-only:
  // a Turkish child was answering Turkish questions about a Turkish book inside an English
  // frame, and the two page questions below are new in both languages.
  rd_title:           { en: 'Read a Book 📖', tr: 'Kitap Oku 📖' },
  rd_tap_here:        { en: 'Tap here!', tr: 'Buraya dokun!' },
  rd_checking:        { en: 'Checking your library... 📚', tr: 'Kitaplığına bakıyorum… 📚' },
  rd_cover_young:     { en: 'Hi! I love books! 📚 Which book are you reading? Take a photo of the cover!',
                        tr: 'Merhaba! Kitapları çok severim! 📚 Hangi kitabı okuyorsun? Kapağının fotoğrafını çek!' },
  rd_cover_mid:       { en: 'New book time! 📚 Take a photo of the cover so I know what we\'re reading!',
                        tr: 'Yeni kitap zamanı! 📚 Ne okuduğumuzu bileyim, kapağın fotoğrafını çek!' },
  rd_cover_older:     { en: 'Starting a new book? 📚 Snap a photo of the cover first!',
                        tr: 'Yeni bir kitaba mı başlıyorsun? 📚 Önce kapağın fotoğrafını çek!' },
  rd_cover_label:     { en: 'Take a photo of the cover', tr: 'Kapağın fotoğrafını çek' },
  rd_cover_loading:   { en: 'Let me see what book this is... 🔍', tr: 'Bakalım bu hangi kitap… 🔍' },
  rd_not_book:        { en: "Hmm, that doesn't look like a book cover! 😄 Show me what you're reading!",
                        tr: 'Hmm, bu bir kitap kapağına benzemiyor! 😄 Ne okuduğunu göster bana!' },
  rd_low_confidence:  { en: 'Is this your book? Let me make sure I got it right!',
                        tr: 'Kitabın bu mu? Doğru anladığımdan emin olayım!' },
  rd_try_again:       { en: "I couldn't see the cover clearly... try better lighting? 📸",
                        tr: 'Kapağı net göremedim… Işık biraz daha iyi olabilir mi? 📸' },
  rd_dupe:            { en: 'This book is already in your library! 📚', tr: 'Bu kitap zaten kitaplığında! 📚' },
  rd_is_this:         { en: 'Is this your book? 🤔', tr: 'Kitabın bu mu? 🤔' },
  rd_book_title:      { en: 'Book title', tr: 'Kitabın adı' },
  rd_yes_right:       { en: "Yes, that's right! ✅", tr: 'Evet, doğru! ✅' },
  rd_found_it:        { en: 'Found it! 📚', tr: 'Buldum! 📚' },
  rd_have_you_read:   { en: '"%title%" — great choice! 🌟 Have you already read this book?',
                        tr: '"%title%" — harika seçim! 🌟 Bu kitabı daha önce okudun mu?' },
  rd_yes_finished:    { en: 'Yes, I finished it! ✅', tr: 'Evet, bitirdim! ✅' },
  rd_no_reading:      { en: "No, I'm reading it now 📖", tr: 'Hayır, şimdi okuyorum 📖' },
  rd_total_q:         { en: 'How long is this book? 📖 Look at the number on the very last page!',
                        tr: 'Bu kitap ne kadar uzun? 📖 En son sayfadaki numaraya bak!' },
  rd_total_ph:        { en: 'e.g. 120', tr: 'örn. 120' },
  rd_page_q:          { en: 'Which page are you on? 📖', tr: 'Kaçıncı sayfadasın? 📖' },
  rd_stopped_q:       { en: 'Which page did you stop at? 📖', tr: 'Kaçıncı sayfada kaldın? 📖' },
  rd_page_ph:         { en: 'e.g. 42', tr: 'örn. 42' },
  rd_save:            { en: 'Save →', tr: 'Kaydet →' },
  rd_skip:            { en: "I don't know", tr: 'Bilmiyorum' },
  rd_added:           { en: 'Amazing! Added to your finished books! 🏆', tr: 'Harika! Bitirdiğin kitaplara eklendi! 🏆' },
  rd_go_library:      { en: 'Go to My Library →', tr: 'Kitaplığıma git →' },
  rd_welcome_back:    { en: 'Welcome back! Ready to read more of "%title%"? 📖',
                        tr: 'Tekrar hoş geldin! "%title%" kitabına devam edelim mi? 📖' },
  rd_been_reading:    { en: "I've been reading! →", tr: 'Okudum! →' },
  rd_other_book:      { en: 'Start a different book', tr: 'Başka bir kitaba başla' },
  rd_pages_prompt:    { en: 'Take photos of all the pages you read! Add as many as you need 📸',
                        tr: 'Okuduğun bütün sayfaların fotoğrafını çek! İstediğin kadar ekleyebilirsin 📸' },
  rd_tap_first_page:  { en: 'Tap to add first page', tr: 'İlk sayfayı eklemek için dokun' },
  rd_add_another:     { en: '📸 Add another page (%n%/10)', tr: '📸 Bir sayfa daha ekle (%n%/10)' },
  rd_done_talk:       { en: "Done! Let's talk 📚", tr: 'Bitti! Şimdi konuşalım 📚' },
  rd_pages_failed:    { en: 'Could not read the pages. Try again!', tr: 'Sayfaları okuyamadım. Bir daha dener misin?' },
  rd_page_loading:    { en: "Let me see what you've been reading... 🧐 I'm cooking up some questions!",
                        tr: 'Bakalım neler okumuşsun… 🧐 Sana sorular hazırlıyorum!' },
  rd_correct:         { en: '✅ Correct!', tr: '✅ Doğru!' },
  rd_answer_was:      { en: '❌ The answer was: %a%', tr: '❌ Doğrusu şuydu: %a%' },
  rd_write_answer:    { en: 'Write your answer here...', tr: 'Cevabını buraya yaz…' },
  rd_send:            { en: 'Send →', tr: 'Gönder →' },
  rd_result:          { en: 'Amazing! You got %c% out of %n% right! 🎉',
                        tr: 'Harika! %n% sorudan %c% tanesini doğru bildin! 🎉' },
  rd_save_failed:     { en: "Couldn't save", tr: 'Kaydedemedim' },
  rd_nearly:          { en: 'Nearly there!', tr: 'Az kaldı!' },
  rd_capped:          { en: 'All your gems for today!', tr: 'Bugünün gemleri tamam!' },
  rd_earned:          { en: 'You earned!', tr: 'Kazandın!' },
  rd_tell_grownup:    { en: 'Tell a grown-up', tr: 'Bir büyüğüne söyle' },
  rd_counting:        { en: 'Counting your gems…', tr: 'Gemlerin sayılıyor…' },
  rd_come_back:       { en: 'Come back tomorrow 📚', tr: 'Yarın yine gel 📚' },
  rd_gems:            { en: '+%n% Gems', tr: '+%n% Gem' },
  rd_back_books:      { en: 'Back to My Books', tr: 'Kitaplarıma dön' },

  gems_balance:       { en: 'Your Gem Balance', tr: 'Gem Bakiyen' },
  goals_title:        { en: 'My Goals 🏆', tr: 'Hedeflerim 🏆' },
  hw_sent:            { en: 'I sent your homework to your grown-up to check.', tr: 'Ödevini kontrol etmesi için annene babana gönderdim.' },
  hw_take_photo:      { en: 'Take a photo of your finished homework!', tr: 'Bitirdiğin ödevin fotoğrafını çek!' },
  hw_add_photo:       { en: 'Add photo', tr: 'Fotoğraf ekle' },
  hw_looking_dots:    { en: 'Tuto is looking at your homework…', tr: 'Tuto ödevine bakıyor…' },
  tree_photo_optional:{ en: "Want to show a photo? It's up to you.", tr: 'Fotoğraf göstermek ister misin? Sana kalmış.' },
  tree_helping_grows: { en: '🌱 Helping makes your tree grow', tr: '🌱 Yardım etmek ağacını büyütür' },
  // ── My Tree: the forest archive (was written Turkish-only)
  // ── small strings the sweep missed: attributes and one-liners
  hw_waiting_for:     { en: 'Waiting for ✔ · then ⭐', tr: '✔ bekleniyor · sonra ⭐' },
  hw_this_week:       { en: '📅 This week', tr: '📅 Bu hafta' },
  hw_one_sec:         { en: 'One sec 👀', tr: 'Bir saniye 👀' },
  hw_remove:          { en: 'remove', tr: 'kaldır' },
  lab_next_problem:   { en: 'Next problem →', tr: 'Sonraki soru →' },
  lab_your_answer:    { en: 'your answer', tr: 'cevabın' },
  tree_no_server:     { en: "⚠️ Couldn't reach the server — try again in a bit.", tr: '⚠️ Sunucuya ulaşamadım — birazdan tekrar dene.' },
  tree_cant_add:      { en: "Couldn't add that — try writing something else.", tr: 'Bunu ekleyemedim — başka bir şey yazmayı dene.' },
  tree_photo_opt:     { en: 'Add a photo (optional)', tr: 'Fotoğraf ekle (isteğe bağlı)' },
  a_close:            { en: 'Close', tr: 'Kapat' },
  a_prev_page:        { en: 'Previous page', tr: 'Önceki sayfa' },
  a_next_page:        { en: 'Next page', tr: 'Sonraki sayfa' },
  a_tuto_reading:     { en: 'Tuto reading', tr: 'Tuto okuyor' },

  // ── My Stories
  st_what_called:     { en: 'What will your story be called? 📖', tr: 'Hikâyenin adı ne olsun? 📖' },
  st_placeholder:     { en: 'My amazing story...', tr: 'Harika hikâyem...' },
  st_yes_fix:         { en: 'Yes, fix it!', tr: 'Evet, düzelt!' },
  st_yes_fix_tick:    { en: '✅ Yes, fix it!', tr: '✅ Evet, düzelt!' },
  st_no_keep:         { en: 'No, keep mine', tr: 'Hayır, benimki kalsın' },
  st_not_sure:        { en: '🤷 Not sure', tr: '🤷 Emin değilim' },
  st_title_later:     { en: "I'll think of a title later", tr: 'Adını sonra düşünürüm' },
  st_add_page:        { en: '📸 Add another page', tr: '📸 Bir sayfa daha ekle' },
  st_im_ready:        { en: "I'm ready, Tuto! 📸", tr: 'Hazırım Tuto! 📸' },
  st_go_back:         { en: '← Go back and try again', tr: '← Geri dön ve tekrar dene' },
  st_your_story:      { en: 'Your story! 📖', tr: 'Hikâyen! 📖' },
  st_looks_good:      { en: 'Looks good! →', tr: 'Güzel olmuş! →' },
  st_edit_cover:      { en: '🎨 Edit cover', tr: '🎨 Kapağı düzenle' },
  st_delete_story:    { en: '🗑️ Delete this story', tr: '🗑️ Bu hikâyeyi sil' },
  st_with_fixes:      { en: "Here's your story with the fixes! How does it look? ✨", tr: 'İşte düzeltilmiş hâli! Nasıl olmuş? ✨' },
  st_finish_later:    { en: "📝 I'll finish this book later", tr: '📝 Bu kitabı sonra bitiririm' },
  st_tap_word:        { en: '✏️ Tap any word to fix it', tr: '✏️ Düzeltmek için bir kelimeye dokun' },
  st_no_fix_it:       { en: '✏️ No, fix it', tr: '✏️ Hayır, düzelt' },
  st_save_cover:      { en: '📚 Done, save my cover!', tr: '📚 Bitti, kapağımı kaydet!' },
  st_skip_for_now:    { en: 'Skip for now →', tr: 'Şimdilik geç →' },
  st_design_cover:    { en: '🎨 Design your cover!', tr: '🎨 Kapağını tasarla!' },
  st_back_to_stories: { en: 'Back to My Stories', tr: 'Hikâyelerime dön' },
  st_continue_writing:{ en: 'Continue Writing 📝', tr: 'Yazmaya devam et 📝' },
  st_write_new:       { en: '✏️ Write New Story', tr: '✏️ Yeni hikâye yaz' },

  // ── My Drawings
  dr_loading:         { en: 'Loading drawings…', tr: 'Çizimler yükleniyor…' },
  dr_load_failed:     { en: "Couldn't load drawings", tr: 'Çizimleri yükleyemedim' },
  dr_check_conn:      { en: 'Check your connection and try again.', tr: 'Bağlantını kontrol edip tekrar dene.' },
  dr_own_idea:        { en: 'Draw my own idea', tr: 'Kendi fikrimi çizeyim' },
  dr_skip_steps:      { en: 'Skip the steps — draw whatever you want', tr: 'Adımları atla — ne istersen çiz' },
  dr_open_library:    { en: 'Open library ▸', tr: 'Kütüphaneyi aç ▸' },
  dr_take_photo:      { en: 'Take a photo of your finished drawing!', tr: 'Bitirdiğin çizimin fotoğrafını çek!' },
  dr_my_paintings:    { en: 'My Paintings', tr: 'Resimlerim' },
  dr_leave_drawing:   { en: 'Leave this drawing?', tr: 'Bu çizimden çıkalım mı?' },
  dr_delete:          { en: 'Delete', tr: 'Sil' },
  dr_delete_painting: { en: 'Delete this painting?', tr: 'Bu resmi sileyim mi?' },

  tree_add_with_photo:{ en: 'Add with photo', tr: 'Fotoğrafla ekle' },
  tree_sent_approval: { en: 'Sent for approval', tr: 'Onaya gönderildi' },
  tree_write_here:    { en: 'Did something else? Write it here', tr: 'Başka bir şey mi yaptın? Buraya yaz' },
  dr_not_this_time:   { en: 'Not this time', tr: 'Bu sefer olmadı' },
  dr_my_own_idea:     { en: 'My own idea', tr: 'Kendi fikrim' },
  dr_add_to_library:  { en: 'Add to my library', tr: 'Kütüphaneme ekle' },
  dr_saved_seen:      { en: 'Your masterpiece is saved. Your grown-up can see it too!', tr: 'Şaheserin kaydedildi. Annen baban da görebilir!' },
  dr_saved_reward:    { en: 'Saved to your library. Reward added to your balance.', tr: 'Kütüphanene kaydedildi. Ödülün bakiyene eklendi.' },
  lab_show_help:      { en: 'Show help', tr: 'Yardım göster' },
  lab_more_help:      { en: 'More help', tr: 'Daha fazla yardım' },
  lab_fully_revealed: { en: 'Fully revealed', tr: 'Hepsi açıldı' },
  hw_send_failed:     { en: "Couldn't send — want to try again?", tr: 'Gönderilemedi, tekrar dener misin?' },

  gem_bonus_gift:     { en: 'Bonus Gift 🎁', tr: 'Sürpriz Hediye 🎁' },
  gem_adjustment:     { en: 'Adjustment ⚖️', tr: 'Düzeltme ⚖️' },
  gem_welcome:        { en: 'Welcome Bonus 🎉', tr: 'Hoş Geldin Hediyesi 🎉' },
  gem_task:           { en: 'Task ⭐', tr: 'Görev ⭐' },

  tree_this_month:    { en: 'THIS MONTH', tr: 'BU AY' },
  tree_n_trees:       { en: 'trees', tr: 'ağaç' },
  tree_you_grew:      { en: 'you grew 🌳', tr: 'ağaç yetiştirdin 🌳' },
  tree_back_today:    { en: 'Back to today', tr: 'Bugüne dön' },
  tree_past_forests:  { en: 'Past forests', tr: 'Geçmiş ormanlar' },
  tree_fox_watches:   { en: 'The fox is watching your forest grow', tr: 'Tilki büyüttüğün ormanı takip ediyor' },
  tree_loading:       { en: 'Loading forests…', tr: 'Ormanlar yükleniyor…' },
  tree_load_failed:   { en: "Couldn't load the forests. Try again in a bit 🦊", tr: 'Ormanlar şu an yüklenemedi. Biraz sonra tekrar dene 🦊' },
  tree_no_past:       { en: 'No past forests yet — keep growing this month! 🌱', tr: 'Henüz geçmiş bir orman yok — bu ay büyümeye devam et! 🌱' },
  tree_earlier_years: { en: 'Earlier years', tr: 'Önceki yıllar' },
  tree_fox_keeps:     { en: 'The fox keeps every forest you grow 🦊🌲', tr: 'Tilki büyüttüğün her ormanı saklıyor 🦊🌲' },

  tree_new_month:     { en: '🌱 A new tree starts every month', tr: '🌱 Her ay yeni bir ağaç başlar' },
  tree_grow:          { en: "Let's grow my tree! →", tr: 'Haydi ağacımı büyütelim! →' },
  story_edit:         { en: '✏️ Edit', tr: '✏️ Düzenle' },
  just_a_moment:      { en: 'Just a moment!', tr: 'Bir saniye!' },

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
  math_capped:        { en: 'All done today', tr: 'Bugünlük tamam' },
  math_come_back:     { en: 'Come back tomorrow for more gems', tr: 'Yarın yine gel, gemler seni bekliyor' },
  math_welcome_young: { en: "Let's go on a number adventure! 🚀\nI'll show you some fun puzzles — just do your best!",
                        tr: 'Haydi sayı macerasına çıkalım! 🚀\nSana eğlenceli sorular göstereceğim!' },
  math_welcome_mid:   { en: "Time to level up your math powers! ⚡\nShow me what you've got!",
                        tr: 'Matematik gücünü artırma zamanı! ⚡\nHaydi göster kendini!' },
  math_welcome_older: { en: "Ready for a challenge? 🔥\nLet's see those math skills!",
                        tr: 'Zorlu bir şeye hazır mısın? 🔥\nBakalım matematiğin nasıl!' },
}

// ── Adding a language ────────────────────────────────────────────────────────
// One entry here, then a field on each string above. Nothing else in the app hardcodes a
// language: the pickers, the date locale and the fallback all read this list. `npm run
// i18n:check` will then print exactly which keys the new language is still missing.
export const LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧', locale: 'en-GB' },
  { code: 'tr', label: 'Türkçe',  flag: '🇹🇷', locale: 'tr-TR' },
]
export const DEFAULT_LANG = 'en'

const KNOWN = new Set(LANGS.map(l => l.code))

// `t('math_on_paper', lang)` — falls back to English rather than showing a key, because a
// missing translation should read oddly, not break the screen.
export function t(key, lang) {
  const entry = STRINGS[key]
  if (!entry) return key
  return entry[lang] ?? entry[DEFAULT_LANG] ?? key
}

// For a component that reads many strings: `const s = translator(lang); s('task_math')`.
export function translator(lang) {
  return (key) => t(key, lang)
}

// Dates were formatted with a hardcoded locale — 'en-GB' in the library and drawings,
// 'en-US' on the tree — so a Turkish child read "16 Jul" and "Friday, August 8". One helper,
// driven by the same language as everything else.
export function localeFor(lang) {
  return (LANGS.find(l => l.code === lang) ?? LANGS[0]).locale
}

export function formatDay(iso, lang, opts = { day: 'numeric', month: 'short' }) {
  const d = iso instanceof Date ? iso : new Date(iso)
  return isNaN(d) ? '' : d.toLocaleDateString(localeFor(lang), opts)
}

export function childLang(child) {
  return KNOWN.has(child?.language) ? child.language : DEFAULT_LANG
}

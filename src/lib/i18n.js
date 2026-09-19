// The words the CHILD reads, in the language their parent chose for them.
//
// Everything the child is asked — questions, hints, the model's replies — already follows
// children.language. This is the frame around it: the tiles, the greetings, the buttons. A
// Turkish-speaking child was solving Turkish questions inside an English app.
//
// One flat dictionary rather than a file per screen: there are not many strings, and a single
// list makes a missing translation obvious. Keys read as English so a screen stays legible
// without cross-referencing.
//
// Spanish is written for a reader anywhere it is spoken, not for one country: tú throughout,
// no vosotros, and no vocabulary that only lands in Spain (no "vale", no "guay", no
// "ordenador"). Where English has a gendered address the Spanish avoids picking one — the app
// does not know whether the child is a boy or a girl and must not guess at them by name.
const STRINGS = {
  // ── ChildHome ───────────────────────────────────────────────────────────────
  greeting_morning:   { en: 'Good morning ☀️',      tr: 'Günaydın ☀️',        es: 'Buenos días ☀️' },
  greeting_afternoon: { en: 'Good afternoon 👋',    tr: 'İyi günler 👋',      es: 'Buenas tardes 👋' },
  greeting_evening:   { en: 'Good evening 🌙',      tr: 'İyi akşamlar 🌙',    es: 'Buenas noches 🌙' },
  hello_name:         { en: 'Hello',                tr: 'Merhaba',            es: 'Hola' },
  // "Peque" rather than "Amigo": this stands in for a name we do not have, and the one thing
  // it must not do is address a girl as a boy.
  friend:             { en: 'Friend',               tr: 'Arkadaşım',          es: 'Peque' },
  all_done_young:     { en: 'You did everything today! 🌟', tr: 'Bugün her şeyi yaptın! 🌟', es: '¡Hoy lo has hecho todo! 🌟' },
  all_done_mature:    { en: 'You did everything today',     tr: 'Bugün her şeyi tamamladın', es: 'Hoy lo has completado todo' },
  start_young:        { en: "Let's start today 🌱",  tr: 'Haydi bugüne başlayalım 🌱', es: '¡Empecemos el día 🌱' },
  start_mature:       { en: 'Get started today',     tr: 'Bugüne başla',       es: 'Empieza el día' },

  // Activity names — shown on the home tiles and in the gem history.
  // ── A finished sitting opened again from the gem history ─────────────────────
  review_loading:     { en: 'Opening…', tr: 'Açılıyor…', es: 'Abriendo…' },
  review_sheet_gone:  { en: "This puzzle round is from before we kept every question, so it can't be opened. All your new ones can.",
                        tr: 'Bu bulmaca turu, soruları saklamaya başlamadan önceydi; o yüzden açılamıyor. Yenilerinin hepsi açılabilecek.',
                        es: 'Esta ronda es de antes de que guardáramos cada pregunta, así que no se puede abrir. Las nuevas sí.' },
  review_none:        { en: "The questions for this one couldn't be found.", tr: 'Bunun soruları bulunamadı.', es: 'No se han encontrado las preguntas de esta.' },
  home_goals_all_done: { en: "You've reached all your goals", tr: 'Bütün hedeflerine ulaştın', es: 'Has conseguido todas tus metas' },
  home_no_goals:      { en: 'No goals yet — ask your parent to add one', tr: 'Henüz hedef yok — annenden ya da babandan eklemesini iste',
                        es: 'Todavía no hay metas: pide a tu madre o a tu padre que añadan una' },
  goals_empty_1:      { en: 'No goals yet!', tr: 'Henüz hedef yok!', es: '¡Todavía no hay metas!' },
  goals_empty_2:      { en: 'Ask your parent to add some', tr: 'Annenden ya da babandan eklemesini iste', es: 'Pide a tu madre o a tu padre que añadan alguna' },
  task_reading:       { en: 'My Books',      tr: 'Kitaplarım', es: 'Mis Libros' },
  task_math:          { en: 'My Math',       tr: 'Matematik', es: 'Mis Mates' },
  task_writing:       { en: 'My Stories',    tr: 'Hikâyelerim', es: 'Mis Cuentos' },
  task_homework:      { en: 'My Homework',   tr: 'Ödevlerim', es: 'Mis Deberes' },
  task_drawing:       { en: 'My Drawings',   tr: 'Çizimlerim', es: 'Mis Dibujos' },
  task_puzzle:        { en: 'My Puzzles',    tr: 'Bulmacalarım',
                        es: 'Mis Acertijos' },
  task_tree:          { en: 'My Tree',       tr: 'Ağacım', es: 'Mi Árbol' },
  chip_books:         { en: 'Books',         tr: 'Kitap', es: 'Libros' },
  chip_math:          { en: 'Math',          tr: 'Matematik', es: 'Mates' },
  chip_story:         { en: 'Story',         tr: 'Hikâye', es: 'Cuento' },
  chip_homework:      { en: 'Homework',      tr: 'Ödev', es: 'Deberes' },
  chip_drawing:       { en: 'Drawing',       tr: 'Çizim', es: 'Dibujo' },
  chip_puzzle:        { en: 'Puzzles',       tr: 'Bulmaca',
                        es: 'Acertijos' },

  home_trees_month:   { en: 'trees this month', tr: 'ağaç bu ay', es: 'árboles este mes' },
  // The 12+ card: the same two counts, in grown-up words.
  // ── 9–11 home ─────────────────────────────────────────────────────────────
  home_this_week:     { en: 'This week', tr: 'Bu hafta', es: 'Esta semana' },
  home_n_done:        { en: '%n% done', tr: '%n% etkinlik', es: '%n% hechas' },
  home_quest_tag:     { en: "Today's quest", tr: 'Bugünün görevi', es: 'Misión de hoy' },
  home_quest_title:   { en: 'Do 3 things today', tr: 'Bugün 3 etkinlik yap', es: 'Haz 3 cosas hoy' },
  home_quest_done:    { en: 'Quest done! 🎉', tr: 'Görev tamam! 🎉', es: '¡Misión cumplida! 🎉' },
  home_quest_next:    { en: 'Next: %task%', tr: 'Sıradaki: %task%', es: 'Siguiente: %task%' },
  home_go:            { en: 'Go', tr: 'Başla', es: 'Vamos' },
  home_activities:    { en: 'Activities', tr: 'Etkinlikler', es: 'Actividades' },
  home_level:         { en: 'Lv %n%', tr: 'Sv %n%', es: 'Nv %n%' },
  home_goal:          { en: 'Your goal', tr: 'Hedefin', es: 'Tu meta' },
  home_contrib_today: { en: 'contributions today', tr: 'katkı bugün', es: 'aportaciones hoy' },
  home_to_goal:       { en: 'to',        tr: 'kaldı:',        es: 'para' },
  home_so_close:      { en: 'So close to', tr: 'Çok az kaldı:', es: 'Ya casi tienes' },
  home_always_on:     { en: '🌱 Always on', tr: '🌱 Her zaman açık', es: '🌱 Siempre disponible' },

  // ── Goals ───────────────────────────────────────────────────────────────────
  goal_claim:         { en: 'Claim! 🎉',  tr: 'İstiyorum! 🎉',  es: '¡Lo quiero! 🎉' },
  goal_claiming:      { en: 'Claiming…',  tr: 'Gönderiliyor…',  es: 'Enviando…' },
  goal_ask:           { en: 'Ask for a goal', tr: 'Yeni hedef iste', es: 'Pedir una meta' },
  goal_ask_title:     { en: 'What would you like?', tr: 'Ne istersin?', es: '¿Qué te gustaría?' },
  goal_ask_name:      { en: 'What is it?', tr: 'Nedir?', es: '¿Qué es?' },
  goal_ask_name_ph:   { en: 'e.g. A skateboard', tr: 'örn. Kaykay', es: 'p. ej. Un monopatín' },
  goal_ask_gems:      { en: 'How many gems do you think?', tr: 'Sence kaç gem olmalı?', es: '¿Cuántas gems crees que vale?' },
  goal_ask_note:      { en: 'Your parent decides the real number.', tr: 'Gerçek sayıya annen ya da baban karar verir.',
                        es: 'El número final lo decide tu madre o tu padre.' },
  goal_ask_send:      { en: 'Ask', tr: 'İste', es: 'Pedir' },
  goal_ask_sending:   { en: 'Sending…', tr: 'Gönderiliyor…', es: 'Enviando…' },
  goal_ask_cancel:    { en: 'Not now', tr: 'Şimdi değil', es: 'Ahora no' },
  goal_ask_needname:  { en: 'Tell Tuto what you would like first.', tr: "Önce Tuto'ya ne istediğini yaz.",
                        es: 'Primero cuéntale a Tuto qué te gustaría.' },
  goal_ask_toomany:   { en: 'You already asked for a few. Wait for an answer first!', tr: 'Zaten birkaç tane istedin. Önce cevabını bekle!',
                        es: 'Ya has pedido unas cuantas. ¡Espera la respuesta primero!' },
  goal_asked_waiting: { en: 'Asked — waiting for your parent', tr: 'İstendi — cevap bekleniyor', es: 'Pedido — esperando respuesta' },

  // ── Homework ────────────────────────────────────────────────────────────────
  hw_title:           { en: 'My Homework', tr: 'Ödevlerim', es: 'Mis Deberes' },
  hw_looking:         { en: 'Tuto is looking at your homework', tr: 'Tuto ödevine bakıyor', es: 'Tuto está mirando tus deberes' },
  hw_need_photo:      { en: 'Add at least one photo', tr: 'En az bir fotoğraf ekle', es: 'Añade al menos una foto' },
  hw_today_q:         { en: 'Did you do this homework today?', tr: 'Bu ödevi bugün mü yaptın?', es: '¿Has hecho estos deberes hoy?' },
  hw_send:            { en: 'Send to Tuto',  tr: "Tuto'ya gönder", es: 'Enviar a Tuto' },
  hw_sending:         { en: 'Sending…',      tr: 'Gönderiliyor…',  es: 'Enviando…' },
  hw_great:           { en: 'Great job! 🎉', tr: 'Harika iş! 🎉',  es: '¡Muy bien! 🎉' },
  hw_yes_today:       { en: 'Yes, today',    tr: 'Evet, bugün',    es: 'Sí, hoy' },

  // ── Library ─────────────────────────────────────────────────────────────────
  lib_title:          { en: 'My Library 📚', tr: 'Kitaplığım 📚', es: 'Mi Biblioteca 📚' },
  lib_loading:        { en: 'Loading...',    tr: 'Yükleniyor…',   es: 'Cargando…' },
  lib_no_books:       { en: 'No books yet!',   tr: 'Henüz kitap yok!',   es: '¡Todavía no hay libros!' },
  lib_no_stories:     { en: 'No stories yet!', tr: 'Henüz hikâye yok!',  es: '¡Todavía no hay cuentos!' },
  lib_not_yet:        { en: 'Not yet...',    tr: 'Henüz değil…',  es: 'Todavía no…' },
  // Was also called lib_finished and lost to the section header of the same name below, so
  // the "did you really finish it?" dialog answered itself with "Finished Books 🏆".
  lib_yes_read_all:   { en: 'Yes, I read it all! 📚', tr: 'Evet, hepsini okudum! 📚', es: '¡Sí, lo he leído entero! 📚' },
  lib_remove_q:       { en: 'Remove this book?', tr: 'Bu kitabı kaldıralım mı?', es: '¿Quitamos este libro?' },
  lib_remove_body:    { en: 'Are you sure you want to remove this book from your library?',
                        tr: 'Bu kitabı kitaplığından kaldırmak istediğine emin misin?',
                        es: '¿Seguro que quieres quitar este libro de tu biblioteca?' },
  lib_remove:         { en: 'Remove', tr: 'Kaldır', es: 'Quitar' },
  lib_cancel:         { en: 'Cancel', tr: 'Vazgeç', es: 'Cancelar' },

  lib_my_books:       { en: '✍️ Books I Wrote', tr: '✍️ Benim Yazdığım Kitaplar', es: '✍️ Libros que he escrito' },
  lib_write_first:    { en: 'Write your first story →', tr: 'İlk hikâyeni yaz →', es: 'Escribe tu primer cuento →' },
  lib_add_first:      { en: 'Add your first book →',    tr: 'İlk kitabını ekle →', es: 'Añade tu primer libro →' },
  lib_reading_now:    { en: 'Reading Now 📖',    tr: 'Şu An Okuduklarım 📖', es: 'Leyendo ahora 📖' },
  lib_finished:       { en: 'Finished Books 🏆', tr: 'Bitirdiklerim 🏆',     es: 'Libros terminados 🏆' },
  lib_really_done:    { en: 'Wow, did you really finish the whole book? 🎉', tr: 'Vay, kitabın hepsini bitirdin mi? 🎉',
                        es: '¡Hala! ¿De verdad has terminado el libro entero? 🎉' },
  lib_amazing:        { en: 'Amazing! You finished', tr: 'Harika! Bitirdiğin kitap:', es: '¡Increíble! Has terminado' },
  story_untitled:     { en: 'Untitled Story', tr: 'Adsız Hikâye', es: 'Cuento sin título' },
  story_in_progress:  { en: 'In Progress',    tr: 'Devam ediyor', es: 'En marcha' },

  lib_other_authors:  { en: '📚 Books from Other Authors', tr: '📚 Başka Yazarların Kitapları', es: '📚 Libros de otros autores' },
  lib_write:          { en: '✏️ Write', tr: '✏️ Yaz',  es: '✏️ Escribir' },
  lib_add:            { en: '+ Add',    tr: '+ Ekle',  es: '+ Añadir' },
  lib_books_of:       { en: "📖 Books by",  tr: '📖 Kendi Kitapları:', es: '📖 Libros de' },
  // A book with no page count gets a page number instead of a percentage — an honest "page 42"
  // rather than a bar filled to a fraction of a total nobody knows.
  lib_page:           { en: 'page', tr: 'sayfa', es: 'página' },
  // Turkish puts the sign before the number and English after it. Two keys rather than a
  // format string because one of them is empty in each language, which no placeholder does.
  // Spanish follows English here.
  lib_pct_before:     { en: '',  tr: '%', es: ''  },
  lib_pct_after:      { en: '%', tr: '',  es: '%' },

  // ── ReadingFlow ─────────────────────────────────────────────────────────────
  // %title%, %n%, %c%, %a% are filled in by the screen. The whole flow was English-only:
  // a Turkish child was answering Turkish questions about a Turkish book inside an English
  // frame, and the two page questions below are new in both languages.
  rd_title:           { en: 'Read a Book 📖', tr: 'Kitap Oku 📖', es: 'Leer un libro 📖' },
  rd_tap_here:        { en: 'Tap here!', tr: 'Buraya dokun!', es: '¡Toca aquí!' },
  rd_checking:        { en: 'Checking your library... 📚', tr: 'Kitaplığına bakıyorum… 📚', es: 'Estoy mirando tu biblioteca… 📚' },
  rd_cover_young:     { en: 'Hi! I love books! 📚 Which book are you reading? Take a photo of the cover!',
                        tr: 'Merhaba! Kitapları çok severim! 📚 Hangi kitabı okuyorsun? Kapağının fotoğrafını çek!',
                        es: '¡Hola! ¡Me encantan los libros! 📚 ¿Qué libro estás leyendo? ¡Haz una foto de la portada!' },
  rd_cover_mid:       { en: 'New book time! 📚 Take a photo of the cover so I know what we\'re reading!',
                        tr: 'Yeni kitap zamanı! 📚 Ne okuduğumuzu bileyim, kapağın fotoğrafını çek!',
                        es: '¡Libro nuevo! 📚 Haz una foto de la portada para que sepa qué estamos leyendo.' },
  rd_cover_older:     { en: 'Starting a new book? 📚 Snap a photo of the cover first!',
                        tr: 'Yeni bir kitaba mı başlıyorsun? 📚 Önce kapağın fotoğrafını çek!',
                        es: '¿Empiezas un libro nuevo? 📚 Primero haz una foto de la portada.' },
  rd_cover_label:     { en: 'Take a photo of the cover', tr: 'Kapağın fotoğrafını çek', es: 'Haz una foto de la portada' },
  rd_cover_loading:   { en: 'Let me see what book this is... 🔍', tr: 'Bakalım bu hangi kitap… 🔍', es: 'A ver qué libro es… 🔍' },
  rd_not_book:        { en: "Hmm, that doesn't look like a book cover! 😄 Show me what you're reading!",
                        tr: 'Hmm, bu bir kitap kapağına benzemiyor! 😄 Ne okuduğunu göster bana!',
                        es: 'Mmm, esto no parece la portada de un libro 😄 ¡Enséñame lo que estás leyendo!' },
  rd_low_confidence:  { en: 'Is this your book? Let me make sure I got it right!',
                        tr: 'Kitabın bu mu? Doğru anladığımdan emin olayım!',
                        es: '¿Es este tu libro? Quiero asegurarme de que lo he entendido bien.' },
  rd_try_again:       { en: "I couldn't see the cover clearly... try better lighting? 📸",
                        tr: 'Kapağı net göremedim… Işık biraz daha iyi olabilir mi? 📸',
                        es: 'No he visto bien la portada… ¿Pruebas con más luz? 📸' },
  rd_dupe:            { en: 'This book is already in your library! 📚', tr: 'Bu kitap zaten kitaplığında! 📚',
                        es: '¡Este libro ya está en tu biblioteca! 📚' },
  rd_is_this:         { en: 'Is this your book? 🤔', tr: 'Kitabın bu mu? 🤔', es: '¿Es este tu libro? 🤔' },
  rd_book_title:      { en: 'Book title', tr: 'Kitabın adı', es: 'Título del libro' },
  rd_yes_right:       { en: "Yes, that's right! ✅", tr: 'Evet, doğru! ✅', es: '¡Sí, es ese! ✅' },
  rd_found_it:        { en: 'Found it! 📚', tr: 'Buldum! 📚', es: '¡Lo encontré! 📚' },
  rd_have_you_read:   { en: '"%title%" — great choice! 🌟 Have you already read this book?',
                        tr: '"%title%" — harika seçim! 🌟 Bu kitabı daha önce okudun mu?',
                        es: '«%title%» — ¡buena elección! 🌟 ¿Ya has leído este libro?' },
  rd_yes_finished:    { en: 'Yes, I finished it! ✅', tr: 'Evet, bitirdim! ✅', es: '¡Sí, lo terminé! ✅' },
  rd_no_reading:      { en: "No, I'm reading it now 📖", tr: 'Hayır, şimdi okuyorum 📖', es: 'No, lo estoy leyendo ahora 📖' },
  rd_total_q:         { en: 'How long is this book? 📖 Look at the number on the very last page!',
                        tr: 'Bu kitap ne kadar uzun? 📖 En son sayfadaki numaraya bak!',
                        es: '¿Cuánto ocupa este libro? 📖 ¡Mira el número de la última página!' },
  rd_total_ph:        { en: 'e.g. 120', tr: 'örn. 120', es: 'p. ej. 120' },
  rd_page_q:          { en: 'Which page are you on? 📖', tr: 'Kaçıncı sayfadasın? 📖', es: '¿Por qué página vas? 📖' },
  rd_stopped_q:       { en: 'Which page did you stop at? 📖', tr: 'Kaçıncı sayfada kaldın? 📖', es: '¿En qué página lo dejaste? 📖' },
  rd_page_ph:         { en: 'e.g. 42', tr: 'örn. 42', es: 'p. ej. 42' },
  rd_save:            { en: 'Save →', tr: 'Kaydet →', es: 'Guardar →' },
  rd_skip:            { en: "I don't know", tr: 'Bilmiyorum', es: 'No lo sé' },
  rd_added:           { en: 'Amazing! Added to your finished books! 🏆', tr: 'Harika! Bitirdiğin kitaplara eklendi! 🏆',
                        es: '¡Genial! Lo he puesto con tus libros terminados 🏆' },
  rd_go_library:      { en: 'Go to My Library →', tr: 'Kitaplığıma git →', es: 'Ir a mi biblioteca →' },
  rd_welcome_back:    { en: 'Welcome back! Ready to read more of "%title%"? 📖',
                        tr: 'Tekrar hoş geldin! "%title%" kitabına devam edelim mi? 📖',
                        es: '¡Bienvenido de nuevo! ¿Seguimos con «%title%»? 📖' },
  rd_been_reading:    { en: 'I read some pages 📸', tr: 'Birkaç sayfa okudum 📸', es: 'He leído unas páginas 📸' },
  rd_set_page:        { en: 'Which page are you on? 📖', tr: 'Kaçıncı sayfadasın? 📖', es: '¿Por qué página vas? 📖' },
  rd_cancel:          { en: 'Cancel', tr: 'Vazgeç', es: 'Cancelar' },
  rd_finished_book:   { en: 'I finished this book! 🏆', tr: 'Bu kitabı bitirdim! 🏆', es: '¡He terminado este libro! 🏆' },
  rd_finish_confirm:  { en: 'You finished "%title%"? 🏆 Once I put it on your finished shelf you cannot read more of it.',
                        tr: '"%title%" bitti mi? 🏆 Bitirdiğin kitaplara koyarsam bu kitaba devam edemezsin.',
                        es: '¿Has terminado «%title%»? 🏆 Cuando lo ponga en tus libros terminados ya no podrás seguir leyéndolo.' },
  rd_finish_yes:      { en: 'Yes, I finished it! 🏆', tr: 'Evet, bitirdim! 🏆', es: '¡Sí, lo he terminado! 🏆' },
  rd_finish_no:       { en: 'Not yet, I am still reading', tr: 'Daha bitmedi, okumaya devam', es: 'Todavía no, sigo leyendo' },
  rd_last_page:       { en: 'You stopped on page %n% 📖', tr: '%n%. sayfaya kadar okumuştun 📖', es: 'Te quedaste en la página %n% 📖' },
  rd_last_page_of:    { en: 'You stopped on page %n% of %total% 📖', tr: '%total% sayfanın %n%. sayfasındaydın 📖',
                        es: 'Te quedaste en la página %n% de %total% 📖' },
  rd_other_book:      { en: 'Start a different book', tr: 'Başka bir kitaba başla', es: 'Empezar otro libro' },
  rd_pages_prompt:    { en: 'Take photos of all the pages you read! Add as many as you need 📸',
                        tr: 'Okuduğun bütün sayfaların fotoğrafını çek! İstediğin kadar ekleyebilirsin 📸',
                        es: '¡Haz fotos de todas las páginas que has leído! Añade las que necesites 📸' },
  rd_tap_first_page:  { en: 'Tap to add first page', tr: 'İlk sayfayı eklemek için dokun', es: 'Toca para añadir la primera página' },
  rd_add_another:     { en: '📸 Add another page (%n%/10)', tr: '📸 Bir sayfa daha ekle (%n%/10)', es: '📸 Añadir otra página (%n%/10)' },
  rd_done_talk:       { en: "Done! Let's talk 📚", tr: 'Bitti! Şimdi konuşalım 📚', es: '¡Listo! Ahora hablamos 📚' },
  rd_pages_failed:    { en: 'Could not read the pages. Try again!', tr: 'Sayfaları okuyamadım. Bir daha dener misin?',
                        es: 'No he podido leer las páginas. ¿Lo intentas otra vez?' },
  rd_page_loading:    { en: "Let me see what you've been reading... 🧐 I'm cooking up some questions!",
                        tr: 'Bakalım neler okumuşsun… 🧐 Sana sorular hazırlıyorum!',
                        es: 'A ver qué has estado leyendo… 🧐 ¡Te estoy preparando unas preguntas!' },
  rd_correct:         { en: '✅ Correct!', tr: '✅ Doğru!', es: '✅ ¡Correcto!' },
  rd_answer_was:      { en: '❌ The answer was: %a%', tr: '❌ Doğrusu şuydu: %a%', es: '❌ La respuesta era: %a%' },
  rd_write_answer:    { en: 'Write your answer here...', tr: 'Cevabını buraya yaz…', es: 'Escribe tu respuesta aquí…' },
  rd_send:            { en: 'Send →', tr: 'Gönder →', es: 'Enviar →' },
  rd_result:          { en: 'Amazing! You got %c% out of %n% right! 🎉',
                        tr: 'Harika! %n% sorudan %c% tanesini doğru bildin! 🎉',
                        es: '¡Genial! ¡Has acertado %c% de %n%! 🎉' },
  rd_save_failed:     { en: "Couldn't save", tr: 'Kaydedemedim', es: 'No he podido guardarlo' },
  rd_nearly:          { en: 'Nearly there!', tr: 'Az kaldı!', es: '¡Ya casi!' },
  rd_capped:          { en: 'All your gems for today!', tr: 'Bugünün gemleri tamam!', es: '¡Ya tienes todas las gems de hoy!' },
  rd_earned:          { en: 'You earned!', tr: 'Kazandın!', es: '¡Has ganado!' },
  rd_tell_grownup:    { en: 'Tell a grown-up', tr: 'Bir büyüğüne söyle', es: 'Díselo a una persona mayor' },
  rd_counting:        { en: 'Counting your gems…', tr: 'Gemlerin sayılıyor…', es: 'Contando tus gems…' },
  rd_come_back:       { en: 'Come back tomorrow 📚', tr: 'Yarın yine gel 📚', es: 'Vuelve mañana 📚' },
  rd_gems:            { en: '+%n% Gems', tr: '+%n% Gem', es: '+%n% Gems' },
  rd_back_books:      { en: 'Back to My Books', tr: 'Kitaplarıma dön', es: 'Volver a Mis Libros' },

  gems_balance:       { en: 'Your Gem Balance', tr: 'Gem Bakiyen', es: 'Tus gems' },
  goals_title:        { en: 'My Goals 🏆', tr: 'Hedeflerim 🏆', es: 'Mis Metas 🏆' },
  hw_sent:            { en: 'I sent your homework to your grown-up to check.', tr: 'Ödevini kontrol etmesi için annene babana gönderdim.',
                        es: 'He enviado tus deberes a tu madre o tu padre para que los revise.' },
  hw_take_photo:      { en: 'Take a photo of your finished homework!', tr: 'Bitirdiğin ödevin fotoğrafını çek!',
                        es: '¡Haz una foto de los deberes que has terminado!' },
  hw_add_photo:       { en: 'Add photo', tr: 'Fotoğraf ekle', es: 'Añadir foto' },
  hw_looking_dots:    { en: 'Tuto is looking at your homework…', tr: 'Tuto ödevine bakıyor…', es: 'Tuto está mirando tus deberes…' },
  tree_photo_optional:{ en: "Want to show a photo? It's up to you.", tr: 'Fotoğraf göstermek ister misin? Sana kalmış.',
                        es: '¿Quieres enseñar una foto? Tú decides.' },
  tree_helping_grows: { en: '🌱 Helping makes your tree grow', tr: '🌱 Yardım etmek ağacını büyütür',
                        es: '🌱 Ayudar hace crecer tu árbol' },
  // ── My Tree: the forest archive (was written Turkish-only)
  // ── small strings the sweep missed: attributes and one-liners
  hw_waiting_for:     { en: 'Waiting for ✔ · then ⭐', tr: '✔ bekleniyor · sonra ⭐', es: 'Esperando ✔ · luego ⭐' },
  hw_this_week:       { en: '📅 This week', tr: '📅 Bu hafta', es: '📅 Esta semana' },
  hw_one_sec:         { en: 'One sec 👀', tr: 'Bir saniye 👀', es: 'Un momento 👀' },
  hw_remove:          { en: 'remove', tr: 'kaldır', es: 'quitar' },
  lab_next_problem:   { en: 'Next problem →', tr: 'Sonraki soru →', es: 'Siguiente problema →' },
  lab_your_answer:    { en: 'your answer', tr: 'cevabın', es: 'tu respuesta' },
  tree_no_server:     { en: "⚠️ Couldn't reach the server — try again in a bit.", tr: '⚠️ Sunucuya ulaşamadım — birazdan tekrar dene.',
                        es: '⚠️ No he podido conectar con el servidor — inténtalo dentro de un rato.' },
  tree_cant_add:      { en: "Couldn't add that — try writing something else.", tr: 'Bunu ekleyemedim — başka bir şey yazmayı dene.',
                        es: 'No he podido añadir eso — prueba a escribir otra cosa.' },
  tree_photo_opt:     { en: 'Add a photo (optional)', tr: 'Fotoğraf ekle (isteğe bağlı)', es: 'Añadir una foto (opcional)' },
  a_close:            { en: 'Close', tr: 'Kapat', es: 'Cerrar' },
  a_prev_page:        { en: 'Previous page', tr: 'Önceki sayfa', es: 'Página anterior' },
  a_next_page:        { en: 'Next page', tr: 'Sonraki sayfa', es: 'Página siguiente' },
  a_tuto_reading:     { en: 'Tuto reading', tr: 'Tuto okuyor', es: 'Tuto leyendo' },

  // ── My Stories
  st_what_called:     { en: 'What will your story be called? 📖', tr: 'Hikâyenin adı ne olsun? 📖',
                        es: '¿Cómo se va a llamar tu cuento? 📖' },
  st_placeholder:     { en: 'My amazing story...', tr: 'Harika hikâyem...', es: 'Mi cuento genial…' },
  st_yes_fix:         { en: 'Yes, fix it!', tr: 'Evet, düzelt!', es: '¡Sí, corrígelo!' },
  st_yes_fix_tick:    { en: '✅ Yes, fix it!', tr: '✅ Evet, düzelt!', es: '✅ ¡Sí, corrígelo!' },
  st_no_keep:         { en: 'No, keep mine', tr: 'Hayır, benimki kalsın', es: 'No, déjalo como está' },
  st_not_sure:        { en: '🤷 Not sure', tr: '🤷 Emin değilim', es: '🤷 No estoy seguro' },
  st_title_later:     { en: "I'll think of a title later", tr: 'Adını sonra düşünürüm', es: 'Ya pensaré el título luego' },
  st_add_page:        { en: '📸 Add another page', tr: '📸 Bir sayfa daha ekle', es: '📸 Añadir otra página' },
  st_im_ready:        { en: "I'm ready, Tuto! 📸", tr: 'Hazırım Tuto! 📸', es: '¡Estoy listo, Tuto! 📸' },
  st_go_back:         { en: '← Go back and try again', tr: '← Geri dön ve tekrar dene', es: '← Volver e intentarlo otra vez' },
  st_your_story:      { en: 'Your story! 📖', tr: 'Hikâyen! 📖', es: '¡Tu cuento! 📖' },
  st_looks_good:      { en: 'Looks good! →', tr: 'Güzel olmuş! →', es: '¡Ha quedado bien! →' },
  st_edit_cover:      { en: '🎨 Edit cover', tr: '🎨 Kapağı düzenle', es: '🎨 Editar la portada' },
  st_delete_story:    { en: '🗑️ Delete this story', tr: '🗑️ Bu hikâyeyi sil', es: '🗑️ Borrar este cuento' },
  st_with_fixes:      { en: "Here's your story with the fixes! How does it look? ✨", tr: 'İşte düzeltilmiş hâli! Nasıl olmuş? ✨',
                        es: '¡Aquí está tu cuento con las correcciones! ¿Qué te parece? ✨' },
  st_finish_later:    { en: "📝 I'll finish this book later", tr: '📝 Bu kitabı sonra bitiririm', es: '📝 Terminaré este libro luego' },
  st_tap_word:        { en: '✏️ Tap any word to fix it', tr: '✏️ Düzeltmek için bir kelimeye dokun',
                        es: '✏️ Toca una palabra para corregirla' },
  st_no_fix_it:       { en: '✏️ No, fix it', tr: '✏️ Hayır, düzelt', es: '✏️ No, corrígelo' },
  st_save_cover:      { en: '📚 Done, save my cover!', tr: '📚 Bitti, kapağımı kaydet!', es: '📚 ¡Listo, guarda mi portada!' },
  st_skip_for_now:    { en: 'Skip for now →', tr: 'Şimdilik geç →', es: 'Saltar por ahora →' },
  st_design_cover:    { en: '🎨 Design your cover!', tr: '🎨 Kapağını tasarla!', es: '🎨 ¡Diseña tu portada!' },
  st_back_to_stories: { en: 'Back to My Stories', tr: 'Hikâyelerime dön', es: 'Volver a Mis Cuentos' },
  st_continue_writing:{ en: 'Continue Writing 📝', tr: 'Yazmaya devam et 📝', es: 'Seguir escribiendo 📝' },
  st_write_new:       { en: '✏️ Write New Story', tr: '✏️ Yeni hikâye yaz', es: '✏️ Escribir un cuento nuevo' },

  // ── My Drawings
  dr_loading:         { en: 'Loading drawings…', tr: 'Çizimler yükleniyor…', es: 'Cargando dibujos…' },
  dr_load_failed:     { en: "Couldn't load drawings", tr: 'Çizimleri yükleyemedim', es: 'No he podido cargar los dibujos' },
  dr_check_conn:      { en: 'Check your connection and try again.', tr: 'Bağlantını kontrol edip tekrar dene.',
                        es: 'Comprueba tu conexión e inténtalo otra vez.' },
  dr_own_idea:        { en: 'Draw my own idea', tr: 'Kendi fikrimi çizeyim', es: 'Dibujar mi propia idea' },
  dr_skip_steps:      { en: 'Skip the steps — draw whatever you want', tr: 'Adımları atla — ne istersen çiz',
                        es: 'Sáltate los pasos: dibuja lo que quieras' },
  dr_open_library:    { en: 'Open library ▸', tr: 'Kütüphaneyi aç ▸', es: 'Abrir la galería ▸' },
  dr_take_photo:      { en: 'Take a photo of your finished drawing!', tr: 'Bitirdiğin çizimin fotoğrafını çek!',
                        es: '¡Haz una foto del dibujo que has terminado!' },
  dr_my_paintings:    { en: 'My Paintings', tr: 'Resimlerim', es: 'Mis Cuadros' },

  // The crop step (components/PhotoCrop.jsx). The same six keys exist in parentI18n.js, since
  // the same component runs on parent screens and those read a different dictionary.
  crop_title:         { en: 'Drag the corners to frame it', tr: 'Köşelerden çekip çerçeveye al',
                        es: 'Arrastra las esquinas para encuadrarlo' },
  crop_retake:        { en: 'Retake', tr: 'Yeniden çek', es: 'Repetir' },
  crop_use:           { en: 'Use this', tr: 'Bunu kullan', es: 'Usar esto' },
  crop_use_all:       { en: 'Use the photo', tr: 'Fotoğrafı kullan', es: 'Usar la foto' },
  crop_working:       { en: 'One moment…', tr: 'Bir saniye…', es: 'Un momento…' },
  crop_cancel:        { en: 'Cancel', tr: 'Vazgeç', es: 'Cancelar' },
  dr_leave_drawing:   { en: 'Leave this drawing?', tr: 'Bu çizimden çıkalım mı?', es: '¿Salimos de este dibujo?' },
  dr_delete:          { en: 'Delete', tr: 'Sil', es: 'Borrar' },
  dr_close:           { en: 'Close', tr: 'Kapat', es: 'Cerrar' },
  dr_delete_painting: { en: 'Delete this painting?', tr: 'Bu resmi sileyim mi?', es: '¿Borro este cuadro?' },

  // The rest of My Drawings. Until now the screen translated its dialogs and
  // hints but not its headings, buttons or the drawing names themselves, so a
  // Turkish child read Turkish step instructions under the title "Galata Tower"
  // and pressed a button marked "Next". The catalogue has carried name_tr since
  // day one; only the parent's notification was reading it.
  dr_title:            { en: 'My Drawings', tr: 'Çizimlerim',
                        es: 'Mis Dibujos' },
  // One per age skin: same instruction, three tones.
  dr_ready_young:      { en: "Grab some paper and a pencil.\nTap ready when you're set!", tr: 'Bir kâğıtla kalem kap.\nHazır olunca düğmeye bas!',
                        es: 'Coge un papel y un lápiz.\n¡Pulsa cuando estés listo!' },
  dr_ready_mid:        { en: 'Get your paper and pencil ready. Take your time — no rush!', tr: 'Kâğıdını ve kalemini hazırla. Acelen olmasın, zaman senin!',
                        es: 'Prepara tu papel y tu lápiz. Tómate tu tiempo, ¡sin prisa!' },
  dr_ready_mature:     { en: "Grab paper and a pencil. When you're set, start the guided steps.", tr: 'Kâğıt ve kalem al. Hazır olduğunda adım adım başla.',
                        es: 'Coge papel y lápiz. Cuando estés listo, empieza los pasos guiados.' },
  dr_im_ready:         { en: "I'm ready!", tr: 'Hazırım!',
                        es: '¡Estoy listo!' },
  dr_step_lower:       { en: 'step', tr: 'adım',
                        es: 'paso' },
  dr_step_upper:       { en: 'Step', tr: 'Adım',
                        es: 'Paso' },
  // "8 steps" on a card. Turkish does not pluralise after a number.
  dr_steps_unit:       { en: 'steps', tr: 'adım',
                        es: 'pasos' },
  dr_all:              { en: 'All', tr: 'Hepsi',
                        es: 'Todos' },
  dr_cat_animals:      { en: 'Animals', tr: 'Hayvanlar',
                        es: 'Animales' },
  dr_cat_characters:   { en: 'Characters', tr: 'Karakterler',
                        es: 'Personajes' },
  dr_cat_objects:      { en: 'Objects', tr: 'Nesneler',
                        es: 'Objetos' },
  dr_cat_nature:       { en: 'Nature', tr: 'Doğa',
                        es: 'Naturaleza' },
  dr_try_again:        { en: 'Try again', tr: 'Tekrar dene',
                        es: 'Inténtalo otra vez' },
  dr_soon:             { en: 'SOON', tr: 'YAKINDA',
                        es: 'PRONTO' },
  dr_back:             { en: 'Back', tr: 'Geri',
                        es: 'Atrás' },
  dr_next:             { en: 'Next', tr: 'İleri',
                        es: 'Siguiente' },
  dr_i_drew_it:        { en: 'I drew it!', tr: 'Çizdim!',
                        es: '¡Ya lo he dibujado!' },
  dr_leave_body:       { en: "Your steps so far won't be saved.", tr: 'Buraya kadar geldiğin adımlar kaydedilmeyecek.',
                        es: 'Los pasos que llevas no se guardarán.' },
  dr_keep_drawing:     { en: 'Keep drawing', tr: 'Çizmeye devam',
                        es: 'Seguir dibujando' },
  dr_leave:            { en: 'Leave', tr: 'Çık',
                        es: 'Salir' },
  dr_add_photo:        { en: 'Add photo', tr: 'Fotoğraf ekle',
                        es: 'Añadir foto' },
  dr_saving:           { en: 'Saving…', tr: 'Kaydediliyor…',
                        es: 'Guardando…' },
  dr_save_failed:      { en: "Couldn't save that — try again?", tr: 'Kaydedemedim — tekrar deneyelim mi?',
                        es: 'No se ha podido guardar. ¿Lo intentamos otra vez?' },
  dr_great_job:        { en: 'Great job! 🎉', tr: 'Harika iş! 🎉',
                        es: '¡Muy bien! 🎉' },
  dr_sent_to_grownup:  { en: 'I sent your drawing to your grown-up to look at.', tr: 'Çizimini bakması için annene babana gönderdim.',
                        es: 'He enviado tu dibujo a tu madre o tu padre para que lo vean.' },
  // %reward% is the age skin's gem icon plus the amount, e.g. "⭐ +20".
  // Percent signs rather than braces: scripts/i18n-check.mjs reads an entry with
  // a regex that stops at the first "}".
  dr_waiting_then:     { en: '◷ Waiting for ✔ · then %reward%', tr: '◷ ✔ bekleniyor · sonra %reward%',
                        es: '◷ Esperando ✔ · después %reward%' },
  dr_see_library:      { en: 'See my library', tr: 'Kütüphaneme bak',
                        es: 'Ver mi galería' },
  dr_draw_again:       { en: 'Draw again', tr: 'Yine çiz',
                        es: 'Dibujar otra vez' },
  dr_loading_short:    { en: 'Loading…', tr: 'Yükleniyor…',
                        es: 'Cargando…' },
  dr_nothing_yet:      { en: 'Nothing here yet — draw something!', tr: 'Burada henüz bir şey yok — hadi bir şey çiz!',
                        es: 'Aquí no hay nada todavía. ¡Dibuja algo!' },
  dr_my_own_drawing:   { en: 'My own drawing', tr: 'Kendi çizimim',
                        es: 'Mi propio dibujo' },
  dr_delete_body_kept: { en: 'This removes it from your library. The %reward% you already earned stays yours.', tr: 'Bu, resmi kütüphanenden siler. Kazandığın %reward% sende kalır.',
                        es: 'Esto lo quita de tu galería. Los %reward% que ya ganaste siguen siendo tuyos.' },
  dr_delete_body:      { en: "This removes it from your library — you can't undo this.", tr: 'Bu, resmi kütüphanenden siler — geri alamazsın.',
                        es: 'Esto lo quita de tu galería y no se puede deshacer.' },
  dr_keep_it:          { en: 'Keep it', tr: 'Kalsın',
                        es: 'Guardarlo' },
  dr_waiting:          { en: '◷ Waiting', tr: '◷ Bekliyor',
                        es: '◷ Esperando' },
  dr_approved:         { en: '✓ Approved', tr: '✓ Onaylandı',
                        es: '✓ Aprobado' },

  tree_add_with_photo:{ en: 'Add with photo', tr: 'Fotoğrafla ekle', es: 'Añadir con foto' },
  tree_sent_approval: { en: 'Sent for approval', tr: 'Onaya gönderildi', es: 'Enviado para aprobar' },
  tree_write_here:    { en: 'Did something else? Write it here', tr: 'Başka bir şey mi yaptın? Buraya yaz', es: '¿Has hecho otra cosa? Escríbelo aquí' },
  dr_not_this_time:   { en: 'Not this time', tr: 'Bu sefer olmadı', es: 'Esta vez no' },
  dr_my_own_idea:     { en: 'My own idea', tr: 'Kendi fikrim', es: 'Mi propia idea' },
  dr_add_to_library:  { en: 'Add to my library', tr: 'Kütüphaneme ekle', es: 'Añadir a mi galería' },
  dr_saved_seen:      { en: 'Your masterpiece is saved. Your grown-up can see it too!', tr: 'Şaheserin kaydedildi. Annen baban da görebilir!', es: 'Tu obra maestra está guardada. ¡Tu madre o tu padre también pueden verla!' },
  dr_saved_reward:    { en: 'Saved to your library. Reward added to your balance.', tr: 'Kütüphanene kaydedildi. Ödülün bakiyene eklendi.', es: 'Guardado en tu galería. La recompensa ya está en tus gems.' },
  lab_show_help:      { en: 'Show help', tr: 'Yardım göster', es: 'Ver la ayuda' },
  lab_more_help:      { en: 'More help', tr: 'Daha fazla yardım', es: 'Más ayuda' },
  lab_fully_revealed: { en: 'Fully revealed', tr: 'Hepsi açıldı', es: 'Todo descubierto' },
  hw_send_failed:     { en: "Couldn't send — want to try again?", tr: 'Gönderilemedi, tekrar dener misin?', es: 'No se ha podido enviar. ¿Lo intentas otra vez?' },

  gem_bonus_gift:     { en: 'Bonus Gift 🎁', tr: 'Sürpriz Hediye 🎁', es: 'Regalo sorpresa 🎁' },
  gem_adjustment:     { en: 'Adjustment ⚖️', tr: 'Düzeltme ⚖️', es: 'Ajuste ⚖️' },
  gem_welcome:        { en: 'Welcome Bonus 🎉', tr: 'Hoş Geldin Hediyesi 🎉', es: 'Regalo de bienvenida 🎉' },
  gem_task:           { en: 'Task ⭐', tr: 'Görev ⭐', es: 'Tarea ⭐' },

  // Two keys, because two screens want two different things and they used to share a name:
  // this one is the caption over the forest archive's count (MyTree upper-cases it in CSS), and
  // tree_this_month below is the tail of ChildHome's "3 leaves today · 2 this month 🌳". The
  // duplicate meant the second definition won both, so the archive caption was reading
  // "THIS MONTH 🌳" with a tree emoji in the middle of a label.
  tree_month_label:   { en: 'this month', tr: 'bu ay', es: 'este mes' },
  tree_n_trees:       { en: 'trees', tr: 'ağaç', es: 'árboles' },
  tree_you_grew:      { en: 'you grew 🌳', tr: 'ağaç yetiştirdin 🌳', es: 'has hecho crecer 🌳' },
  tree_back_today:    { en: 'Back to today', tr: 'Bugüne dön', es: 'Volver a hoy' },
  tree_past_forests:  { en: 'Past forests', tr: 'Geçmiş ormanlar', es: 'Bosques anteriores' },
  tree_fox_watches:   { en: 'The fox is watching your forest grow', tr: 'Tilki büyüttüğün ormanı takip ediyor',
                        es: 'El zorro está viendo crecer tu bosque' },
  tree_loading:       { en: 'Loading forests…', tr: 'Ormanlar yükleniyor…', es: 'Cargando bosques…' },
  tree_load_failed:   { en: "Couldn't load the forests. Try again in a bit 🦊", tr: 'Ormanlar şu an yüklenemedi. Biraz sonra tekrar dene 🦊',
                        es: 'No he podido cargar los bosques. Inténtalo dentro de un rato 🦊' },
  tree_no_past:       { en: 'No past forests yet — keep growing this month! 🌱', tr: 'Henüz geçmiş bir orman yok — bu ay büyümeye devam et! 🌱',
                        es: 'Todavía no hay bosques anteriores: ¡sigue creciendo este mes! 🌱' },
  tree_earlier_years: { en: 'Earlier years', tr: 'Önceki yıllar', es: 'Años anteriores' },
  tree_fox_keeps:     { en: 'The fox keeps every forest you grow 🦊🌲', tr: 'Tilki büyüttüğün her ormanı saklıyor 🦊🌲',
                        es: 'El zorro guarda todos los bosques que haces crecer 🦊🌲' },

  tree_new_month:     { en: '🌱 A new tree starts every month', tr: '🌱 Her ay yeni bir ağaç başlar',
                        es: '🌱 Cada mes empieza un árbol nuevo' },
  tree_grow:          { en: "Let's grow my tree! →", tr: 'Haydi ağacımı büyütelim! →', es: '¡Vamos a hacer crecer mi árbol! →' },
  story_edit:         { en: '✏️ Edit', tr: '✏️ Düzenle', es: '✏️ Editar' },
  just_a_moment:      { en: 'Just a moment!', tr: 'Bir saniye!', es: '¡Un momento!' },

  // ── Navigation (rail on tablet, bar on phone) ───────────────────────────────
  nav_home:           { en: 'Home',     tr: 'Ana Sayfa', es: 'Inicio' },
  nav_library:        { en: 'Library',  tr: 'Kitaplık',  es: 'Biblioteca' },
  // "Gem" stays the currency word everywhere — parent messages, the ledger, the parent app —
  // so translating it here alone would split the name in two.
  nav_gems:           { en: 'Gems',     tr: 'Gem’lerim', es: 'Gems' },
  nav_goals:          { en: 'Goals',    tr: 'Hedeflerim', es: 'Metas' },

  // ── My Tree ─────────────────────────────────────────────────────────────────
  tree_leaves_today:  { en: 'leaves today',  tr: 'yaprak bugün', es: 'hojas hoy' },
  tree_this_month:    { en: 'this month 🌳', tr: 'bu ay 🌳',     es: 'este mes 🌳' },
  tree_title:         { en: 'My Tree 🌳',    tr: 'Ağacım 🌳',    es: 'Mi Árbol 🌳' },
  tree_meet:          { en: 'Meet your tree! 🌳', tr: 'Ağacınla tanış! 🌳', es: '¡Conoce a tu árbol! 🌳' },
  tree_my_part:       { en: 'My Part 💪',    tr: 'Benim Payım 💪', es: 'Mi Parte 💪' },
  tree_helped_today:  { en: 'Did you help today? Tap one 👇', tr: 'Bugün yardım ettin mi? Birine dokun 👇',
                        es: '¿Has ayudado hoy? Toca una 👇' },
  tree_add_today:     { en: 'Add to today',  tr: 'Bugüne ekle', es: 'Añadir a hoy' },
  tree_nothing_yet:   { en: 'Nothing logged yet today.', tr: 'Bugün henüz bir şey eklemedin.', es: 'Hoy todavía no has apuntado nada.' },
  tree_all_caught_up: { en: 'All caught up — nice work! 🌟', tr: 'Hepsi tamam — çok iyi! 🌟', es: 'Todo al día. ¡Muy bien! 🌟' },
  tree_what_did_you:  { en: 'What did you do to help?', tr: 'Yardım için ne yaptın?', es: '¿Qué has hecho para ayudar?' },
  tree_something_else:{ en: 'Did something else? Write it here', tr: 'Başka bir şey mi yaptın? Buraya yaz',
                        es: '¿Has hecho otra cosa? Escríbelo aquí' },
  tree_add_photo:     { en: 'Add with photo', tr: 'Fotoğrafla ekle', es: 'Añadir con foto' },
  tree_add_no_photo:  { en: 'Add without a photo', tr: 'Fotoğrafsız ekle', es: 'Añadir sin foto' },
  tree_cancel:        { en: 'Cancel',        tr: 'Vazgeç',        es: 'Cancelar' },
  tree_sending:       { en: 'Sending…',      tr: 'Gönderiliyor…', es: 'Enviando…' },
  tree_sending_photo: { en: 'Sending photo…', tr: 'Fotoğraf gönderiliyor…', es: 'Enviando la foto…' },
  tree_sent:          { en: 'Sent for approval', tr: 'Onaya gönderildi', es: 'Enviado para aprobar' },
  tree_logged_young:  { en: 'Logged it! Your parent will confirm soon 🌱', tr: 'Kaydettim! Annen baban birazdan onaylayacak 🌱',
                        es: '¡Apuntado! Tu madre o tu padre lo confirmarán enseguida 🌱' },
  tree_logged_mature: { en: 'Logged — your parent will confirm it.', tr: 'Kaydedildi — annen baban onaylayacak.',
                        es: 'Apuntado — tu madre o tu padre lo confirmarán.' },
  tree_nice_check:    { en: 'Nice! I’ll check this with your parent 🌱', tr: 'Harika! Bunu annenle babanla konuşacağım 🌱',
                        es: '¡Genial! Lo hablaré con tu madre o tu padre 🌱' },
  tree_approved:      { en: 'Approved',      tr: 'Onaylandı', es: 'Aprobado' },
  tree_pending:       { en: 'Pending',       tr: 'Bekliyor',  es: 'Pendiente' },
  tree_waiting:       { en: 'Waiting',       tr: 'Bekliyor',  es: 'Esperando' },

  // ── GemsScreen ──────────────────────────────────────────────────────────────
  // The list is everything the child did, not only what it paid — a session that hit the
  // day's limit is a line here too. "History" named a gem ledger; this names the days.
  gems_history:       { en: 'What I did',    tr: 'Neler yaptım', es: 'Lo que he hecho' },
  // Same words the maths and reading end screens use when the limit is reached, so the
  // history repeats what the child was already told rather than introducing a new idea.
  gems_capped:        { en: 'All done today', tr: 'Bugünlük tamam', es: 'Por hoy ya está' },
  gems_none_title:    { en: 'No gems yet!',  tr: 'Henüz gem yok!', es: '¡Todavía no hay gems!' },
  gems_none_body:     { en: 'Complete a task to earn your first gems! ⭐', tr: 'İlk gem’lerini kazanmak için bir görev tamamla! ⭐',
                        es: '¡Completa una tarea para ganar tus primeras gems! ⭐' },
  gems_today:         { en: 'Today',         tr: 'Bugün', es: 'Hoy' },
  gems_yesterday:     { en: 'Yesterday',     tr: 'Dün',   es: 'Ayer' },

  // ── MathScreen: the frame around the questions ──────────────────────────────
  math_mode_title:    { en: 'How do you want to work? 🤔', tr: 'Nasıl çalışmak istersin? 🤔', es: '¿Cómo quieres trabajar? 🤔' },
  math_on_paper:      { en: 'On Paper',      tr: 'Kâğıtta',  es: 'En papel' },
  math_on_screen:     { en: 'On Screen',     tr: 'Ekranda',  es: 'En la pantalla' },
  math_paper_desc:    { en: 'We love pen and paper! Your brain grows every time you write! 🧠',
                        tr: 'Gerçek uzmanlar kalem ve kâğıt kullanır, ekran amatörlerin işi! 🧠',
                        es: '¡Nos encanta el papel y el lápiz! Tu cerebro crece cada vez que escribes 🧠' },
  math_screen_desc:   { en: 'Type your answers right here, one by one.',
                        tr: 'Cevaplarını burada tek tek yaz.',
                        es: 'Escribe aquí tus respuestas, una a una.' },
  math_up_to_gems:    { en: 'Up to',         tr: 'En fazla', es: 'Hasta' },
  math_gems_word:     { en: 'Gems',          tr: 'Gem',      es: 'Gems' },
  math_lets_go:       { en: "Let's go! →",   tr: 'Haydi başlayalım! →', es: '¡Vamos! →' },
  math_correct:       { en: 'correct',       tr: 'doğru',    es: 'bien' },
  math_back_home:     { en: 'Back home',     tr: 'Ana sayfaya dön', es: 'Volver al inicio' },
  // Score messages: three bands × three ages. Kept whole rather than assembled from pieces —
  // an encouragement stitched together from fragments reads like one.
  score_hi_young:     { en: "WOW! You're a math superstar! 🌟 I'm so proud of you!", tr: 'VAY! Sen bir matematik yıldızısın! 🌟 Seninle gurur duyuyorum!',
                        es: '¡GUAU! ¡Eres una estrella de las mates! 🌟 ¡Estoy muy orgulloso de ti!' },
  score_hi_mid:       { en: "Excellent work! You crushed it! 🔥 Keep those math skills sharp!", tr: 'Mükemmel! Hepsini götürdün! 🔥 Böyle devam!',
                        es: '¡Excelente! ¡Te las has comido! 🔥 ¡Sigue así con las mates!' },
  score_hi_older:     { en: "Outstanding! 🌟 Your math skills are seriously impressive!", tr: 'Muhteşem! 🌟 Matematiğin cidden çok iyi!',
                        es: '¡Impresionante! 🌟 Se te dan de verdad bien las mates.' },
  score_mid_young:    { en: "Great job! You did really well! ⭐ Let's keep practicing!", tr: 'Aferin! Gerçekten iyi yaptın! ⭐ Haydi çalışmaya devam!',
                        es: '¡Muy bien! ¡Lo has hecho genial! ⭐ ¡Vamos a seguir practicando!' },
  score_mid_mid:      { en: "Nice work! You're getting stronger every session! 💪", tr: 'Güzel iş! Her seferinde daha da güçleniyorsun! 💪',
                        es: '¡Buen trabajo! Cada sesión estás más fuerte 💪' },
  score_mid_older:    { en: "Good effort! You're making solid progress! 💡", tr: 'İyi uğraştın! Sağlam ilerliyorsun! 💡',
                        es: '¡Buen esfuerzo! Estás avanzando muy bien 💡' },
  score_low_young:    { en: "You're trying so hard and that makes me happy! 🤗 Let's practice more!", tr: 'Çok uğraşıyorsun, bu beni mutlu ediyor! 🤗 Biraz daha çalışalım!',
                        es: '¡Te estás esforzando mucho y eso me alegra! 🤗 ¡Vamos a practicar un poco más!' },
  score_low_mid:      { en: "You gave it your best! 💪 Every practice makes you better!", tr: 'Daha da iyi olacağız! 💪',
                        es: '¡Lo has dado todo! 💪 Con cada rato de práctica mejoras.' },
  score_low_older:    { en: "Keep pushing! Every challenge helps you grow! 💪", tr: 'Devam et! Her zorluk seni büyütüyor! 💪',
                        es: '¡Sigue! Cada reto te hace crecer 💪' },
  score_vlow_young:   { en: "It's okay! Math takes practice and you're doing amazing! 🤗", tr: 'Önemli değil! Matematik çalışmak ister, sen harika gidiyorsun! 🤗',
                        es: '¡No pasa nada! Las mates necesitan práctica y lo estás haciendo genial 🤗' },
  score_vlow_mid:     { en: "These were tough! You'll get there with practice! 💪", tr: 'Zor sorulardı! Çalıştıkça daha da iyi olacağız! 💪',
                        es: '¡Estas eran difíciles! Con práctica lo vas a conseguir 💪' },
  score_vlow_older:   { en: "Challenging problems! Persistence is the key to mastery! 🔑", tr: 'Zorlu sorulardı! Ustalığın anahtarı pes etmemek! 🔑',
                        es: '¡Problemas exigentes! La clave para dominarlos es no rendirse 🔑' },
  // Paper mode — its own screen, never translated at all.
  math_paper_title:   { en: 'My Math 🔢',  tr: 'Matematiğim 🔢', es: 'Mis Mates 🔢' },
  math_paper_now:     { en: 'Now solve these on paper! ✏️', tr: 'Şimdi bunları kâğıtta çöz! ✏️',
                        es: '¡Ahora resuélvelos en papel! ✏️' },
  math_paper_ready:   { en: "I'm ready, Tuto! 📸", tr: 'Hazırım Tuto! 📸', es: '¡Estoy listo, Tuto! 📸' },
  math_paper_hint:    { en: 'Hint', tr: 'İpucu', es: 'Pista' },

  // Per-question feedback and the result screen.
  math_yes:           { en: 'Yes! ⭐',      tr: 'Doğru! ⭐', es: '¡Sí! ⭐' },
  math_almost:        { en: 'Almost! The answer was', tr: 'Hmm, bu değil! Doğrusu', es: '¡Uy, esta no! La respuesta era' },
  math_your_answers:  { en: 'Your answers:', tr: 'Senin cevapların:', es: 'Tus respuestas:' },
  math_your_answer:   { en: 'Your answer:',  tr: 'Senin cevabın:', es: 'Tu respuesta:' },
  math_answer_was:    { en: 'The answer was', tr: 'Doğrusu', es: 'La respuesta era' },
  math_new_level:     { en: 'You unlocked a new level! 🎉', tr: 'Yeni bir seviye açtın! 🎉', es: '¡Has desbloqueado un nivel nuevo! 🎉' },
  math_done:          { en: 'Done',          tr: 'Bitti', es: 'Hechas' },
  math_score:         { en: 'Score',         tr: 'Puan', es: 'Puntos' },
  math_earned:        { en: 'Earned',        tr: 'Kazandın', es: 'Has ganado' },

  // Leaving mid-session — the answers so far are lost, so it asks first.
  math_leave_title:   { en: 'Leave this session?', tr: 'Buradan çıkalım mı?', es: '¿Salimos de esta sesión?' },
  math_leave_body:    { en: 'Your answers so far will not be saved.', tr: 'Şimdiye kadarki cevapların kaydedilmeyecek.',
                        es: 'Las respuestas que llevas no se guardarán.' },
  math_leave_stay:    { en: 'Keep going', tr: 'Devam edeyim', es: 'Seguir' },
  math_leave_go:      { en: 'Leave',      tr: 'Çık',          es: 'Salir' },

  math_adventure:     { en: 'Math Adventure', tr: 'Matematik Macerası', es: 'Aventura de Mates' },
  math_preparing:     { en: 'Preparing your puzzles…', tr: 'Sorularını hazırlıyorum…', es: 'Preparando tus retos…' },
  math_checking:      { en: 'Checking your work…',     tr: 'Yaptıklarına bakıyorum…', es: 'Revisando lo que has hecho…' },
  math_save_failed:   { en: "Couldn't save — try again later", tr: 'Kaydedemedim — birazdan tekrar dene',
                        es: 'No he podido guardarlo — inténtalo más tarde' },
  math_build_failed:  { en: "I couldn't get your questions ready. Try again in a moment!",
                        tr: 'Sorularını hazırlayamadım. Birazdan tekrar dener misin?',
                        es: 'No he podido preparar tus preguntas. ¿Lo intentas dentro de un momento?' },
  math_capped:        { en: 'All done today', tr: 'Bugünlük tamam', es: 'Por hoy ya está' },
  math_come_back:     { en: 'Come back tomorrow for more gems', tr: 'Yarın yine gel, gemler seni bekliyor',
                        es: 'Vuelve mañana a por más gems' },
  math_welcome_young: { en: "Let's go on a number adventure! 🚀\nI'll show you some fun puzzles — just do your best!",
                        tr: 'Haydi sayı macerasına çıkalım! 🚀\nSana eğlenceli sorular göstereceğim!',
                        es: '¡Vamos a una aventura de números! 🚀\nTe voy a enseñar unos retos divertidos.' },
  math_welcome_mid:   { en: "Time to level up your math powers! ⚡\nShow me what you've got!",
                        tr: 'Matematik gücünü artırma zamanı! ⚡\nHaydi göster kendini!',
                        es: '¡Hora de subir de nivel con las mates! ⚡\n¡Enséñame lo que sabes!' },
  math_welcome_older: { en: "Ready for a challenge? 🔥\nLet's see those math skills!",
                        tr: 'Zorlu bir şeye hazır mısın? 🔥\nBakalım matematiğin nasıl!', es: '¿Listo para un reto? 🔥 ¡A ver esas mates!' },

  // ── Puzzles: the child's screen (everything with the same meaning uses the math_* words) ──
  puzzle_welcome:     { en: "Shape and pattern puzzles! 🧩\nLook closely — every one has a clue.",
                        tr: 'Şekil ve örüntü bulmacaları! 🧩\nDikkatli bak — her birinde bir ipucu var.',
                        es: '¡Acertijos de formas y patrones! 🧩\nMira bien: cada uno tiene una pista.' },
  puzzle_preparing:   { en: 'Getting your puzzles ready…', tr: 'Bulmacalarını hazırlıyorum…',
                        es: 'Preparando tus acertijos…' },
  puzzle_no_gems:     { en: 'Your gems are done for today — you can still play!',
                        tr: 'Bugünün gemleri tamam — yine de çözebilirsin!',
                        es: 'Ya tienes todas las gems de hoy, ¡pero puedes seguir jugando!' },
  puzzle_enc_perfect: { en: 'You found every one! 🦅',
                        tr: 'Hepsini buldun! Gözünden hiçbir şey kaçmıyor 🦅',
                        es: '¡Los has encontrado todos! 🦅' },
  puzzle_enc_high:    { en: 'You read those shapes really carefully! 🌟',
                        tr: 'Çok iyiydi! Neredeyse hepsini buldun 🌟',
                        es: '¡Muy bien! Casi todos 🌟' },
  puzzle_enc_mid:     { en: 'Nice work! You spot more every time 💪',
                        tr: 'İyi gidiyorsun! Kaçırdıklarına aşağıdan bir bak 🔍',
                        es: '¡Vas bien! Mira abajo los que se te escaparon 🔍' },
  puzzle_enc_low:     { en: 'Those were tricky ones — keep at it, they get easier 🌱',
                        tr: 'Bugünküler zordu! Doğrularına bak, sonrakinde daha kolay gelecek 🌱',
                        es: 'Hoy eran difíciles. Mira las respuestas: la próxima vez será más fácil 🌱' },
  puzzle_you:         { en: 'You', tr: 'Sen',
                        es: 'Tú' },
  puzzle_send:        { en: 'Send ✓', tr: 'Gönder ✓',
                        es: 'Enviar ✓' },
  puzzle_failed:      { en: 'Something went wrong. Try again in a moment!',
                        tr: 'Bir şeyler ters gitti. Birazdan tekrar dener misin?',
                        es: 'Algo ha fallado. ¡Inténtalo otra vez en un momento!' },
  puzzle_retry:       { en: 'Try again',        tr: 'Tekrar dene',
                        es: 'Inténtalo otra vez' },

  // ── Puzzles: one stem per question type ─────────────────────────────────────
  // The six stems are the whole text of the module — the figures carry everything else, which
  // is the point of a non-verbal test. They live here rather than with the generator so the
  // generator stays free of language entirely: it returns a stem_key, the screen reads it.
  puzzle_stem_odd:    { en: 'Which one is different?',        tr: 'Hangisi farklı?',
                        es: '¿Cuál es diferente?' },
  puzzle_stem_same:   { en: 'Which one is the same as this?', tr: 'Hangisi bunun aynısı?',
                        es: '¿Cuál es igual que este?' },
  puzzle_stem_next:   { en: 'Which one comes next?',          tr: 'Sırada hangisi gelir?',
                        es: '¿Cuál va después?' },
  puzzle_stem_belongs:{ en: 'Which one belongs with these?',  tr: 'Hangisi bunların yanına gelir?',
                        es: '¿Cuál va con estos?' },
  puzzle_stem_pattern:{ en: 'Which one completes the pattern?', tr: 'Örüntüyü hangisi tamamlar?',
                        es: '¿Cuál completa el patrón?' },
  puzzle_stem_analogy:{ en: 'Which one finishes it the same way?', tr: 'Hangisi aynı şekilde tamamlar?',
                        es: '¿Cuál lo completa de la misma manera?' },
  puzzle_stem_mirror: { en: 'Which one is it in the mirror?',  tr: 'Aynadaki hâli hangisi?',
                        es: '¿Cómo se ve en el espejo?' },
  puzzle_stem_code:   { en: 'Which code goes with the last picture?', tr: 'Son resmin kodu hangisi?',
                        es: '¿Qué código va con el último dibujo?' },
  puzzle_stem_symmetry: { en: 'Which one has a line of symmetry?', tr: 'Hangisinin simetri ekseni var?',
                        es: '¿Cuál tiene un eje de simetría?' },
  puzzle_stem_symmetry_none: { en: 'Which one has no line of symmetry?', tr: 'Hangisinin simetri ekseni yok?',
                        es: '¿Cuál no tiene eje de simetría?' },
}

// ── Adding a language ────────────────────────────────────────────────────────
// One entry here, then a field on each string above. Nothing else in the app hardcodes a
// language: the pickers, the date locale and the fallback all read this list. `npm run
// i18n:check` will then print exactly which keys the new language is still missing.
//
// `name` is the language's English name, and it is not decoration: every prompt sent to the
// model names the language it must write in, and eight of them used to do it with their own
// `language === 'tr' ? 'Turkish' : 'English'`. A third language turns each of those into a
// silent English fallback, so they read this instead. See langName().
export const LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧', locale: 'en-GB', name: 'English' },
  { code: 'tr', label: 'Türkçe',  flag: '🇹🇷', locale: 'tr-TR', name: 'Turkish' },
  { code: 'es', label: 'Español', flag: '🇪🇸', locale: 'es-ES', name: 'Spanish' },
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

// The language's English name, for prompts: "Write every question in ${langName(lang)}".
export function langName(lang) {
  return (LANGS.find(l => l.code === lang) ?? LANGS[0]).name
}

// For text that is BUILT rather than looked up — a sentence with a number in the middle of it,
// where a dictionary key would need a placeholder for every part. The screens and the maths
// templates both have plenty of those, and each had grown its own `language === 'tr' ? … : …`,
// which silently becomes an English fallback the moment a third language exists. Anything
// missing still falls back to English, but visibly and in one place.
export function say(lang, en, tr, es) {
  if (lang === 'tr') return tr ?? en
  if (lang === 'es') return es ?? en
  return en
}

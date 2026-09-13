// The words the PARENT reads — the screens, not the messages.
//
// Separate from src/lib/i18n.js on purpose, and it is the same separation the rest of the app
// already makes: `children.language` is what a child is taught in, `parents.prefs.language` is
// what Tuto writes to their parent in, and in plenty of families those are two different
// languages. Two dictionaries keep that honest; one would invite a screen to reach for the
// wrong audience's word for "gems".
//
// Where the language lives, and why it is not simply prefs.language: the first screen a parent
// sees is the splash, before they have logged in, so there is no account to read a preference
// from yet. It is a device choice held in localStorage, and the account is layered on top:
//
//   Opening / Login / Signup   → localStorage only (no account yet)
//   signing up                 → the device choice is written into the new parent's prefs
//   logging in / the dashboard → prefs wins and is copied back down to the device
//   the dashboard's picker     → writes both
//
// So the picker on the first screen is real from the first tap, and a parent who picked
// Spanish on their phone still gets Spanish on the tablet they log into next.
import { useSyncExternalStore } from 'react'
import { LANGS, DEFAULT_LANG } from './i18n'

const KEY = 'tuto_ui_lang'
const KNOWN = new Set(LANGS.map(l => l.code))

const listeners = new Set()
let current = null

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return KNOWN.has(v) ? v : DEFAULT_LANG
  } catch {
    // Private mode, or storage blocked. English rather than a crash on the splash screen.
    return DEFAULT_LANG
  }
}

export function uiLang() {
  if (current === null) current = read()
  return current
}

export function setUiLang(code) {
  if (!KNOWN.has(code) || code === uiLang()) return
  current = code
  try { localStorage.setItem(KEY, code) } catch { /* nothing to do; the session still works */ }
  for (const fn of listeners) fn()
}

// Called after the account is known: the stored preference is the truth, the device copy is a
// cache of it. Quiet when they already agree, so a dashboard load does not re-render the world.
export function adoptAccountLang(code) {
  if (KNOWN.has(code)) setUiLang(code)
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// useSyncExternalStore rather than context: the language is read by screens that are not under
// a common provider (the splash sits outside the authed tree), and a context would have to wrap
// the router to reach them.
export function useUiLang() {
  return useSyncExternalStore(subscribe, uiLang, () => DEFAULT_LANG)
}

// `%name%` placeholders, filled from the second argument: s('n_children', { n: 3 }).
function fill(text, vars) {
  if (!vars) return text
  return String(text).replace(/%(\w+)%/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

export function pt(key, lang, vars) {
  const entry = P[key]
  if (!entry) return key
  return fill(entry[lang] ?? entry[DEFAULT_LANG] ?? key, vars)
}

// The hook every parent screen uses: `const s = useT()`, then `s('save')`.
export function useT() {
  const lang = useUiLang()
  return (key, vars) => pt(key, lang, vars)
}

// One flat dictionary, grouped by screen in comments only — the same shape as the child's, for
// the same reason: a missing translation is obvious in a list and invisible in a tree.
const P = {
  // ── Opening ─────────────────────────────────────────────────────────────────
  op_tagline:        { en: 'Learn, earn, have fun!', tr: 'Öğren, kazan, eğlen!', es: '¡Aprende, gana, diviértete!' },
  op_tagline2:       { en: 'Every task brings you closer to a reward.',
                       tr: 'Her görev seni bir ödüle yaklaştırır.',
                       es: 'Cada tarea te acerca a un premio.' },
  op_parent:         { en: 'Parent Login', tr: 'Ebeveyn Girişi', es: 'Entrar como madre o padre' },
  op_parent_sub:     { en: 'Manage & approve tasks', tr: 'Görevleri yönet ve onayla', es: 'Gestiona y aprueba las tareas' },
  op_child:          { en: 'Child Login', tr: 'Çocuk Girişi', es: 'Entrar como niño' },
  op_child_sub:      { en: 'Complete tasks, earn Gems!', tr: 'Görevleri yap, Gem kazan!', es: '¡Haz tareas y gana Gems!' },
  op_lang:           { en: 'Language', tr: 'Dil', es: 'Idioma' },

  // ── ParentLogin / ParentSignup ──────────────────────────────────────────────
  li_welcome:        { en: 'Welcome back 👋', tr: 'Tekrar hoş geldin 👋', es: 'Bienvenido de nuevo 👋' },
  li_sub:            { en: 'Sign in to your account', tr: 'Hesabına giriş yap', es: 'Entra en tu cuenta' },
  li_email:          { en: 'Email', tr: 'E-posta', es: 'Correo' },
  li_password:       { en: 'Password', tr: 'Şifre', es: 'Contraseña' },
  li_signin:         { en: 'Sign in', tr: 'Giriş yap', es: 'Entrar' },
  li_signing_in:     { en: 'Signing in…', tr: 'Giriş yapılıyor…', es: 'Entrando…' },
  li_or:             { en: 'or', tr: 'ya da', es: 'o' },
  li_google:         { en: 'Continue with Google', tr: 'Google ile devam et', es: 'Continuar con Google' },
  li_no_account:     { en: 'No account?', tr: 'Hesabın yok mu?', es: '¿No tienes cuenta?' },
  li_signup_free:    { en: 'Sign up free', tr: 'Ücretsiz kaydol', es: 'Regístrate gratis' },

  su_title:          { en: 'Create your account 🌱', tr: 'Hesabını oluştur 🌱', es: 'Crea tu cuenta 🌱' },
  su_sub:            { en: 'Sign up for free, get started now', tr: 'Ücretsiz kaydol, hemen başla', es: 'Regístrate gratis y empieza ahora' },
  su_name:           { en: 'Full name', tr: 'Ad soyad', es: 'Nombre y apellidos' },
  su_name_ph:        { en: 'Your Name', tr: 'Adın', es: 'Tu nombre' },
  su_create:         { en: 'Create account', tr: 'Hesap oluştur', es: 'Crear cuenta' },
  su_creating:       { en: 'Creating account…', tr: 'Hesap oluşturuluyor…', es: 'Creando la cuenta…' },
  su_have_account:   { en: 'Already have an account?', tr: 'Zaten hesabın var mı?', es: '¿Ya tienes cuenta?' },

  // ── ChildPin / FamilySetup ──────────────────────────────────────────────────
  // The child reads these, but nothing here knows WHICH child yet — the PIN is what
  // identifies them — so children.language is not available. The device language, which
  // the parent set when they linked this device, is the only honest source.
  cp_hi:             { en: "Hi! I'm Tuto 👋", tr: 'Merhaba! Ben Tuto 👋', es: '¡Hola! Soy Tuto 👋' },
  cp_enter_pin:      { en: 'Enter your PIN to start!', tr: 'Başlamak için PIN’ini gir!', es: '¡Escribe tu PIN para empezar!' },
  cp_too_many:       { en: 'Too many tries! Ask a grown-up — try again in %n% minutes ⏳',
                       tr: 'Çok fazla denedin! Bir büyüğüne söyle — %n% dakika sonra tekrar dene ⏳',
                       es: '¡Demasiados intentos! Díselo a una persona mayor: vuelve a probar en %n% minutos ⏳' },
  cp_wrong_left:     { en: "Hmm, that's not right! %n% more tries 🤔",
                       tr: 'Hmm, bu doğru değil! %n% hakkın kaldı 🤔',
                       es: 'Mmm, no es ese. Te quedan %n% intentos 🤔' },
  cp_wrong_left_one: { en: "Hmm, that's not right! 1 more try 🤔",
                       tr: 'Hmm, bu doğru değil! 1 hakkın kaldı 🤔',
                       es: 'Mmm, no es ese. Te queda 1 intento 🤔' },
  cp_wrong:          { en: "Hmm, that's not right! Try again 🤔", tr: 'Hmm, bu doğru değil! Tekrar dene 🤔',
                       es: 'Mmm, no es ese. Inténtalo otra vez 🤔' },
  cp_went_wrong:     { en: 'Something went wrong. Try again! 🤔', tr: 'Bir şeyler ters gitti. Tekrar dene! 🤔',
                       es: 'Algo ha ido mal. ¡Inténtalo otra vez! 🤔' },
  cp_unreachable:    { en: "I can't reach Tuto right now — check the internet and try again 📡",
                       tr: "Tuto'ya şu an ulaşamıyorum — interneti kontrol edip tekrar dene 📡",
                       es: 'Ahora mismo no puedo conectar con Tuto: comprueba internet e inténtalo otra vez 📡' },
  cp_try_again:      { en: 'Try again', tr: 'Tekrar dene', es: 'Intentar otra vez' },
  cp_not_setup:      { en: 'This device isn’t set up yet. Ask your grown-up to add you first! 📱',
                       tr: 'Bu cihaz henüz ayarlanmamış. Önce bir büyüğünden seni eklemesini iste! 📱',
                       es: 'Este dispositivo todavía no está configurado. ¡Pide a una persona mayor que te añada! 📱' },
  cp_scan_first:     { en: 'Ask your parent to scan the setup QR code first! 📱',
                       tr: 'Önce annenden ya da babandan kurulum karekodunu okutmasını iste! 📱',
                       es: '¡Pide a tu madre o a tu padre que escanee primero el código QR! 📱' },
  cp_setup_device:   { en: 'Set up this device →', tr: 'Bu cihazı ayarla →', es: 'Configurar este dispositivo →' },

  fs_title:          { en: 'Family Setup', tr: 'Aile Kurulumu', es: 'Configuración familiar' },
  fs_sub:            { en: "Scan the QR code from your parent's dashboard",
                       tr: 'Ebeveyn panosundaki karekodu okut',
                       es: 'Escanea el código QR del panel de tu madre o tu padre' },
  fs_connected:      { en: 'Connected! ✅', tr: 'Bağlandı! ✅', es: '¡Conectado! ✅' },
  fs_now_pin:        { en: 'Now enter your PIN', tr: 'Şimdi PIN’ini gir', es: 'Ahora escribe tu PIN' },
  fs_no_camera:      { en: 'Camera not available. Check permissions and try again.',
                       tr: 'Kameraya erişilemiyor. İzinleri kontrol edip tekrar dene.',
                       es: 'No se puede usar la cámara. Comprueba los permisos e inténtalo otra vez.' },
  fs_scan:           { en: '📷 Scan QR Code', tr: '📷 Karekodu okut', es: '📷 Escanear código QR' },
  fs_manual:         { en: 'Or enter code manually', tr: 'Ya da kodu elle gir', es: 'O escribe el código a mano' },
  fs_connect:        { en: 'Connect →', tr: 'Bağlan →', es: 'Conectar →' },
  fs_not_found:      { en: 'Code not found. Try again.', tr: 'Kod bulunamadı. Tekrar dene.', es: 'Código no encontrado. Inténtalo otra vez.' },
  fs_conn_error:     { en: 'Connection error. Try again.', tr: 'Bağlantı hatası. Tekrar dene.', es: 'Error de conexión. Inténtalo otra vez.' },
  fs_back:           { en: '← Back', tr: '← Geri', es: '← Atrás' },

  // ── Task settings (shared by onboarding step 3 and TaskSettings) ────────────
  // The tile NAMES are deliberately not here. A parent screen calls the child dictionary for
  // those (t('task_reading', uiLang)) because they are the same words the child reads on the
  // tile — that is the point of showing them, so the two can talk about the same thing — and
  // a second copy here would drift away from the first.
  gem_hint_upto:     { en: 'Up to %n% gems', tr: 'En fazla %n% gem', es: 'Hasta %n% gems' },
  gem_hint_flat:     { en: '%n% gems', tr: '%n% gem', es: '%n% gems' },
  cap_note_reading:  { en: 'Extra reading still counts, it just stops earning gems.',
                       tr: 'Fazladan okuma yine sayılır, sadece gem kazandırmaz.',
                       es: 'Lo que lea de más sigue contando, solo que ya no gana gems.' },
  cap_note_math:     { en: 'Extra sessions still count, they just stop earning gems.',
                       tr: 'Fazladan seanslar yine sayılır, sadece gem kazandırmaz.',
                       es: 'Las sesiones de más siguen contando, solo que ya no ganan gems.' },
  cap_note_writing:  { en: 'Extra stories are still saved, just without gems.',
                       tr: 'Fazladan hikâyeler yine kaydedilir, sadece gemsiz.',
                       es: 'Los cuentos de más se guardan igual, solo que sin gems.' },
  cap_note_homework: { en: 'Extra homework is still saved, just without gems.',
                       tr: 'Fazladan ödev yine kaydedilir, sadece gemsiz.',
                       es: 'Los deberes de más se guardan igual, solo que sin gems.' },
  cap_note_drawing:  { en: 'Extra drawings are still saved, just without gems.',
                       tr: 'Fazladan çizimler yine kaydedilir, sadece gemsiz.',
                       es: 'Los dibujos de más se guardan igual, solo que sin gems.' },
  cap_note_puzzle:   { en: 'Extra puzzles still count, they just stop earning gems.',
                       tr: 'Fazladan bulmacalar yine sayılır, sadece gem kazandırmaz.',
                       es: 'Los acertijos de más cuentan igual, solo que ya no dan gems.' },
  cap_note_other:    { en: 'Anything past this is still saved, just without gems.',
                       tr: 'Bunun ötesindeki her şey yine kaydedilir, sadece gemsiz.',
                       es: 'Todo lo que pase de aquí se guarda igual, solo que sin gems.' },

  // ── TaskSettings ────────────────────────────────────────────────────────────
  ts_title:          { en: 'Task settings', tr: 'Görev ayarları', es: 'Ajustes de tareas' },
  ts_lang_for:       { en: 'Language for %name%', tr: '%name% için dil', es: 'Idioma de %name%' },
  ts_lang:           { en: 'Language', tr: 'Dil', es: 'Idioma' },
  ts_lang_sub:       { en: "The language %name% sees — questions, hints and Tuto's replies.",
                       tr: "%name% için görünen dil — sorular, ipuçları ve Tuto'nun cevapları.",
                       es: 'El idioma que ve %name%: preguntas, pistas y las respuestas de Tuto.' },
  ts_your_child:     { en: 'your child', tr: 'çocuğun', es: 'tu hijo' },
  ts_intro:          { en: 'Toggle tasks on/off, adjust gem rewards, and set how many a day earn gems.',
                       tr: 'Görevleri aç/kapat, gem ödüllerini ayarla ve günde kaç tanesinin gem kazandıracağını belirle.',
                       es: 'Activa o desactiva tareas, ajusta las gems y decide cuántas al día dan gems.' },
  ts_per_session:    { en: '+%n% gems per session', tr: 'seans başına +%n% gem', es: '+%n% gems por sesión' },
  ts_disabled:       { en: 'Disabled', tr: 'Kapalı', es: 'Desactivada' },
  ts_per_day:        { en: 'Rewarded per day', tr: 'Günde ödüllendirilen', es: 'Con premio al día' },

  // ── ParentDashboard ─────────────────────────────────────────────────────────
  // The crop step (components/PhotoCrop.jsx), shared with the child screens. The same six
  // keys are in i18n.js: one component, two dictionaries, so each side reads its own.
  crop_title:        { en: 'Drag the corners to frame it', tr: 'Köşelerden çekip çerçeveye al',
                       es: 'Arrastra las esquinas para encuadrarlo' },
  crop_retake:       { en: 'Retake', tr: 'Yeniden çek', es: 'Repetir' },
  crop_use:          { en: 'Use this', tr: 'Bunu kullan', es: 'Usar esto' },
  crop_use_all:      { en: 'Use the photo', tr: 'Fotoğrafı kullan', es: 'Usar la foto' },
  crop_working:      { en: 'One moment…', tr: 'Bir saniye…', es: 'Un momento…' },
  crop_cancel:       { en: 'Cancel', tr: 'Vazgeç', es: 'Cancelar' },

  db_welcome:        { en: 'Welcome back 👋', tr: 'Tekrar hoş geldin 👋', es: 'Bienvenido de nuevo 👋' },
  db_parent:         { en: 'Parent', tr: 'Ebeveyn', es: 'Madre o padre' },
  db_signout:        { en: 'Sign out', tr: 'Çıkış yap', es: 'Cerrar sesión' },
  db_children:       { en: 'Children', tr: 'Çocuklar', es: 'Hijos' },
  db_child_reg:      { en: 'child registered', tr: 'çocuk kayıtlı', es: 'hijo registrado' },
  db_children_reg:   { en: 'children registered', tr: 'çocuk kayıtlı', es: 'hijos registrados' },
  db_my_children:    { en: 'My children', tr: 'Çocuklarım', es: 'Mis hijos' },
  db_add:            { en: 'Add', tr: 'Ekle', es: 'Añadir' },
  db_no_children:    { en: 'No children yet', tr: 'Henüz çocuk yok', es: 'Todavía no hay hijos' },
  db_no_children_b:  { en: 'Add your child to start the learning journey.',
                       tr: 'Öğrenme yolculuğuna başlamak için çocuğunu ekle.',
                       es: 'Añade a tu hijo para empezar el camino de aprendizaje.' },
  db_setup_device:   { en: 'Set up a device', tr: 'Cihaz ayarla', es: 'Configurar un dispositivo' },
  db_child_device:   { en: 'Child device', tr: 'Çocuk cihazı', es: 'Dispositivo del niño' },
  db_scan_qr:        { en: 'Scan a QR code to connect it', tr: 'Bağlamak için bir karekod okut',
                       es: 'Escanea un código QR para conectarlo' },
  db_hide:           { en: 'Hide', tr: 'Gizle', es: 'Ocultar' },
  db_show_qr:        { en: 'Show QR', tr: 'Karekodu göster', es: 'Ver el QR' },
  db_manual_code:    { en: 'manual code', tr: 'elle giriş kodu', es: 'código manual' },

  db_notifications:  { en: 'Notifications', tr: 'Bildirimler', es: 'Notificaciones' },
  db_primary_note:   { en: "Your primary channel is where %who% updates arrive. You can message Tuto on either one at any time — questions are always answered where you asked them.",
                       tr: '%who% haberleri ana kanalına gelir. İstediğin zaman ikisinden de Tuto’ya yazabilirsin — sorular her zaman sorduğun yerden yanıtlanır.',
                       es: 'Las novedades de %who% llegan a tu canal principal. Puedes escribir a Tuto por cualquiera de los dos cuando quieras: las preguntas se responden siempre donde las hiciste.' },
  db_who_your_child: { en: "your child's", tr: 'çocuğunun', es: 'tu hijo' },
  db_who_children:   { en: "your children's", tr: 'çocuklarının', es: 'tus hijos' },
  db_who_named:      { en: "%name%'s", tr: '%name% için', es: '%name%' },
  db_connected:      { en: 'Connected', tr: 'Bağlı', es: 'Conectado' },
  db_not_connected:  { en: 'Not connected', tr: 'Bağlı değil', es: 'Sin conectar' },
  db_connect:        { en: 'Connect', tr: 'Bağlan', es: 'Conectar' },
  db_primary:        { en: '★ Primary', tr: '★ Ana kanal', es: '★ Principal' },
  db_set_primary:    { en: 'Set primary', tr: 'Ana kanal yap', es: 'Hacer principal' },
  db_tg_steps_a:     { en: 'Message', tr: 'Şuraya yaz:', es: 'Escribe a' },
  db_tg_steps_b:     { en: ', send', tr: ', gönder:', es: ', envía' },
  db_tg_steps_c:     { en: ', then paste your code:', tr: ', sonra kodunu yapıştır:',
                       es: ' y luego pega tu código:' },
  db_copied:         { en: '✅ Copied!', tr: '✅ Kopyalandı!', es: '✅ ¡Copiado!' },
  db_copy:           { en: '📋 Copy', tr: '📋 Kopyala', es: '📋 Copiar' },
  db_wa_steps:       { en: 'Tap below to open WhatsApp with a pre-filled message, then hit send.',
                       tr: 'Aşağıya dokunup hazır mesajla WhatsApp’ı aç, sonra gönder.',
                       es: 'Toca abajo para abrir WhatsApp con el mensaje ya escrito y dale a enviar.' },
  db_wa_open:        { en: 'Open WhatsApp 📲', tr: 'WhatsApp’ı aç 📲', es: 'Abrir WhatsApp 📲' },
  db_wa_waiting:     { en: 'Waiting for your message…', tr: 'Mesajın bekleniyor…', es: 'Esperando tu mensaje…' },

  db_how_much:       { en: 'How much I write', tr: 'Ne kadar yazıyorum', es: 'Cuánto te escribo' },
  db_lang_title:     { en: 'The language I write to you in', tr: 'Sana yazdığım dil', es: 'El idioma en el que te escribo' },
  db_lang_sub:       { en: "Just for these messages. Your child's app stays in the language you chose for them.",
                       tr: 'Yalnızca bu mesajlar için. Çocuğunun uygulaması senin seçtiğin dilde kalır.',
                       es: 'Solo para estos mensajes. La aplicación de tu hijo se queda en el idioma que elegiste para él.' },
  db_busy:           { en: "I'm busy for a while", tr: 'Bir süre meşgulüm', es: 'Voy a estar ocupado un rato' },
  db_busy_sub:       { en: "I'll approve homework, drawings and jobs myself and stay quiet until you're back. Reward claims and new goals still wait for you, and anything that worries me still comes through.",
                       tr: 'Ödevleri, çizimleri ve ev işlerini ben onaylarım ve sen dönene kadar sessiz kalırım. Ödül talepleri ve yeni hedefler yine seni bekler, beni endişelendiren her şey yine sana ulaşır.',
                       es: 'Aprobaré yo los deberes, los dibujos y las tareas de casa, y me quedaré en silencio hasta que vuelvas. Los premios y las metas nuevas te siguen esperando, y lo que me preocupe te llegará igual.' },
  db_on_until:       { en: 'On until %time%.', tr: '%time% saatine kadar açık.', es: 'Activo hasta las %time%.' },
  db_will_tell:      { en: "I'll tell you what I handled when it ends.",
                       tr: 'Bittiğinde neleri hallettiğimi sana anlatacağım.',
                       es: 'Cuando termine te contaré de qué me he ocupado.' },
  db_im_back:        { en: "I'm back", tr: 'Döndüm', es: 'Ya he vuelto' },
  db_hour_1:         { en: '1 hour', tr: '1 saat', es: '1 hora' },
  db_hour_2:         { en: '2 hours', tr: '2 saat', es: '2 horas' },
  db_hour_4:         { en: '4 hours', tr: '4 saat', es: '4 horas' },

  db_lvl_quiet:      { en: 'Only if something worries me', tr: 'Sadece bir şey beni endişelendirirse',
                       es: 'Solo si algo me preocupa' },
  db_lvl_quiet_b:    { en: 'Nothing else. You look in the app when you want to.',
                       tr: 'Başka bir şey yok. Uygulamaya istediğinde bakarsın.',
                       es: 'Nada más. Miras la aplicación cuando quieras.' },
  db_lvl_req:        { en: 'And when I need you', tr: 'Bir de sana ihtiyacım olduğunda', es: 'Y cuando te necesite' },
  db_lvl_req_b:      { en: 'Plus anything that is waiting on your approval.',
                       tr: 'Bir de onayını bekleyen her şey.',
                       es: 'Y también todo lo que espera tu aprobación.' },
  db_lvl_all:        { en: 'Everything', tr: 'Her şey', es: 'Todo' },
  db_lvl_all_b:      { en: 'Plus each activity as it is finished.',
                       tr: 'Bir de biten her aktivite.',
                       es: 'Y además cada actividad en cuanto termina.' },
  db_every_session:  { en: 'Every session', tr: 'Her seans', es: 'Cada sesión' },
  db_every_session_b:{ en: "Turn this off and I'll tell you about the first one each day, not all three.",
                       tr: 'Bunu kapatırsan üçünü değil, günün sadece ilkini yazarım.',
                       es: 'Si lo desactivas te contaré solo la primera de cada día, no las tres.' },
  db_quiet_warn:     { en: "I won't tell you when something needs approving — and until you open the app, the gems wait too. If you'd rather I just handled some of them, turn them off below.",
                       tr: 'Bir şey onay beklediğinde sana yazmayacağım — ve sen uygulamayı açana kadar gemler de bekler. Bazılarını benim halletmemi istersen aşağıdan kapat.',
                       es: 'No te avisaré cuando algo necesite aprobación, y hasta que abras la aplicación las gems también esperan. Si prefieres que me ocupe yo de algunas, desactívalas abajo.' },
  db_quiet_hours:    { en: 'Quiet hours', tr: 'Sessiz saatler', es: 'Horas de silencio' },
  db_quiet_hours_b:  { en: "I won't write between these hours. Anything that worries me still comes through.",
                       tr: 'Bu saatler arasında yazmam. Beni endişelendiren bir şey yine de ulaşır.',
                       es: 'No te escribiré entre estas horas. Lo que me preocupe te llegará igual.' },
  db_to:             { en: 'to', tr: '—', es: 'a' },
  db_ask_first:      { en: 'Ask me first', tr: 'Önce bana sor', es: 'Pregúntame primero' },
  db_ask_first_b:    { en: "Turn one off and I'll approve it myself and add the gems. You'll still see it — I just won't stop and ask.",
                       tr: 'Birini kapatırsan onu ben onaylar ve gemleri eklerim. Yine görürsün — sadece durup sormam.',
                       es: 'Si desactivas uno, lo aprobaré yo y añadiré las gems. Lo seguirás viendo: simplemente no me pararé a preguntar.' },
  db_ap_homework:    { en: 'Homework', tr: 'Ödev', es: 'Deberes' },
  db_ap_homework_b:  { en: 'Photos of finished homework', tr: 'Biten ödevin fotoğrafları', es: 'Fotos de los deberes terminados' },
  db_ap_drawings:    { en: 'Drawings', tr: 'Çizimler', es: 'Dibujos' },
  db_ap_drawings_b:  { en: 'Photos of finished drawings', tr: 'Biten çizimlerin fotoğrafları', es: 'Fotos de los dibujos terminados' },
  db_ap_helping:     { en: 'Helping out', tr: 'Ev işlerine yardım', es: 'Ayudar en casa' },
  db_ap_helping_b:   { en: 'Jobs done around the house', tr: 'Evde yapılan işler', es: 'Tareas hechas por casa' },
  db_tell_me:        { en: 'You can change any of this by just telling me, too.',
                       tr: 'Bunların hepsini bana söyleyerek de değiştirebilirsin.',
                       es: 'También puedes cambiar todo esto simplemente diciéndomelo.' },

  db_add_child:      { en: 'Add a child 🧒', tr: 'Çocuk ekle 🧒', es: 'Añadir un hijo 🧒' },
  db_child_name:     { en: "Child's name", tr: 'Çocuğun adı', es: 'Nombre del niño' },
  db_child_name_ph:  { en: 'e.g. Emma', tr: 'örn. Ada', es: 'p. ej. Lucía' },
  db_age:            { en: 'Age', tr: 'Yaş', es: 'Edad' },
  db_pin:            { en: '4-digit PIN', tr: '4 haneli PIN', es: 'PIN de 4 cifras' },
  db_err_name:       { en: 'Name is required.', tr: 'İsim gerekli.', es: 'Hace falta el nombre.' },
  db_err_age:        { en: 'Enter a valid age (1–18).', tr: 'Geçerli bir yaş gir (1–18).', es: 'Escribe una edad válida (1–18).' },
  db_err_pin:        { en: 'PIN must be 4 digits.', tr: 'PIN 4 haneli olmalı.', es: 'El PIN debe tener 4 cifras.' },
  db_err_pin_dupe:   { en: 'This PIN is already used by another child. Choose a different one.',
                       tr: 'Bu PIN başka bir çocukta kullanılıyor. Farklı bir tane seç.',
                       es: 'Otro niño ya usa este PIN. Elige uno distinto.' },

  // ── ParentOnboarding ────────────────────────────────────────────────────────
  ob_step_of:        { en: 'STEP %n% OF %total%', tr: 'ADIM %n% / %total%', es: 'PASO %n% DE %total%' },
  ob_per_day:        { en: 'Per day', tr: 'Günde', es: 'Al día' },
  ob_welcome:        { en: 'Welcome to Tuto! 🎉', tr: "Tuto'ya hoş geldin! 🎉", es: '¡Bienvenido a Tuto! 🎉' },
  ob_welcome_b:      { en: "Let's set things up for your child.", tr: 'Haydi çocuğun için her şeyi ayarlayalım.',
                       es: 'Vamos a dejarlo todo listo para tu hijo.' },
  ob_welcome_c:      { en: 'Takes about 2 minutes.', tr: 'Yaklaşık 2 dakika sürer.', es: 'Se tarda unos 2 minutos.' },
  ob_get_started:    { en: 'Get Started →', tr: 'Başlayalım →', es: 'Empezar →' },
  ob_next:           { en: 'Next →', tr: 'Devam →', es: 'Siguiente →' },
  ob_about_child:    { en: 'Tell me about your child! 👶', tr: 'Bana çocuğundan bahset! 👶',
                       es: '¡Cuéntame algo de tu hijo! 👶' },
  ob_child_name_ph:  { en: 'e.g. Zeynep', tr: 'örn. Zeynep', es: 'p. ej. Lucía' },
  ob_child_lang_q:   { en: 'Which language should I speak to them in?', tr: 'Onunla hangi dilde konuşayım?',
                       es: '¿En qué idioma le hablo?' },
  ob_child_lang_b:   { en: "Questions, hints and Tuto's replies to %name% will be in this language.",
                       tr: "%name% için sorular, ipuçları ve Tuto'nun cevapları bu dilde olacak.",
                       es: 'Las preguntas, las pistas y las respuestas de Tuto para %name% estarán en este idioma.' },
  ob_where_grow:     { en: 'Where will %name% grow? 🌱', tr: '%name% nerede gelişsin? 🌱',
                       es: '¿Dónde va a crecer %name%? 🌱' },
  ob_where_grow_b:   { en: 'Choose the activities that earn Gems, and how many a day count. You can change these anytime.',
                       tr: 'Gem kazandıracak aktiviteleri ve günde kaçının sayılacağını seç. Bunları istediğin zaman değiştirebilirsin.',
                       es: 'Elige las actividades que dan Gems y cuántas cuentan al día. Puedes cambiarlo cuando quieras.' },
  ob_tree:           { en: 'My Tree 🌳', tr: 'Ağacım 🌳', es: 'Mi Árbol 🌳' },
  ob_tree_b:         { en: 'Every kind thing they do grows a leaf — no gems, so kindness stays its own reward.',
                       tr: 'Yaptığı her iyilik bir yaprak büyütür — gem yok, iyilik kendi ödülü kalsın.',
                       es: 'Cada gesto bonito hace crecer una hoja: sin gems, para que la amabilidad siga siendo su propio premio.' },
  ob_always_on:      { en: 'Always on', tr: 'Her zaman açık', es: 'Siempre activo' },
  ob_rewards:        { en: "Set up %name%'s rewards! 🎁", tr: '%name% için ödülleri ayarla! 🎁',
                       es: '¡Configura los premios de %name%! 🎁' },
  ob_rewards_b:      { en: 'Adjust the Gems needed for each reward.', tr: 'Her ödül için gereken Gem sayısını ayarla.',
                       es: 'Ajusta las Gems que cuesta cada premio.' },
  ob_earn_q:         { en: '❓ How much can %name% earn per day?', tr: '❓ %name% günde ne kadar kazanabilir?',
                       es: '❓ ¿Cuánto puede ganar %name% al día?' },
  ob_earn_ex:        { en: "If %name% %a% and %b% in a day, that's %upto%%total% gems — use that to gauge what each reward should cost.",
                       tr: '%name% bir günde %a% ve %b%, bu %upto%%total% gem eder — her ödülün kaça mal olacağını buna göre ayarla.',
                       es: 'Si %name% %a% y %b% en un día, son %upto%%total% gems: úsalo para calcular cuánto debería costar cada premio.' },
  ob_upto:           { en: 'up to ', tr: 'en fazla ', es: 'hasta ' },
  ob_ex_reading:     { en: 'reads a few pages of a book', tr: 'birkaç sayfa kitap okursa', es: 'lee unas páginas de un libro' },
  ob_ex_math:        { en: 'does 1 math practice', tr: '1 matematik çalışması yaparsa', es: 'hace 1 sesión de mates' },
  ob_ex_writing:     { en: 'writes a story', tr: 'bir hikâye yazarsa', es: 'escribe un cuento' },
  ob_ex_homework:    { en: 'finishes homework', tr: 'ödevini bitirirse', es: 'termina los deberes' },
  ob_ex_drawing:     { en: 'draws a picture', tr: 'bir resim çizerse', es: 'hace un dibujo' },
  ob_tap_to_name:    { en: 'Tap to name…', tr: 'Ad vermek için dokun…', es: 'Toca para ponerle nombre…' },
  ob_name_ph:        { en: 'e.g. Lego set, new game...', tr: 'örn. Lego seti, yeni oyun…', es: 'p. ej. Lego, un juego nuevo…' },
  ob_add_reward:     { en: '+ Add reward', tr: '+ Ödül ekle', es: '+ Añadir premio' },
  ob_rw_game:        { en: 'Video Game 30min', tr: 'Video oyunu 30 dk', es: 'Videojuego 30 min' },
  ob_rw_game_h:      { en: '💡 30 mins of playtime', tr: '💡 30 dakika oyun', es: '💡 30 minutos de juego' },
  ob_rw_tv:          { en: 'TV 1 hour', tr: 'TV 1 saat', es: 'Tele 1 hora' },
  ob_rw_tv_h:        { en: '💡 1 hour of screen time', tr: '💡 1 saat ekran süresi', es: '💡 1 hora de pantalla' },
  ob_rw_toy:         { en: 'New toy', tr: 'Yeni oyuncak', es: 'Un juguete nuevo' },
  ob_rw_toy_h:       { en: '💡 Something special to save up for!', tr: '💡 Biriktirip alınacak özel bir şey!',
                       es: '💡 ¡Algo especial para ir ahorrando!' },
  ob_chat:           { en: 'Chat with Tuto, anytime 💬', tr: "İstediğin zaman Tuto'yla konuş 💬",
                       es: 'Habla con Tuto cuando quieras 💬' },
  ob_chat_b:         { en: 'No need to dig through an app — just message Tuto like you would a friend who knows %name%, day or night.',
                       tr: 'Uygulamayı karıştırmana gerek yok — %name% tanıyan bir arkadaşına yazar gibi, gece gündüz Tuto’ya yaz.',
                       es: 'No hace falta rebuscar en una aplicación: escríbele a Tuto como a un amigo que conoce a %name%, de día o de noche.' },
  ob_tg_1:           { en: 'Open Telegram and message', tr: "Telegram'ı aç ve şuraya yaz:", es: 'Abre Telegram y escribe a' },
  ob_tg_2:           { en: 'Send', tr: 'Gönder:', es: 'Envía' },
  ob_tg_3:           { en: ', then enter your family code:', tr: ', sonra aile kodunu gir:',
                       es: ' y luego escribe tu código de familia:' },
  ob_loading_code:   { en: 'Loading code…', tr: 'Kod yükleniyor…', es: 'Cargando el código…' },
  ob_tg_done:        { en: "I've connected Telegram ✅", tr: "Telegram'ı bağladım ✅", es: 'Ya he conectado Telegram ✅' },
  ob_wa_connected:   { en: "Connected! You'll get updates here from now on.",
                       tr: 'Bağlandı! Bundan sonra haberleri buradan alacaksın.',
                       es: '¡Conectado! A partir de ahora recibirás las novedades aquí.' },
  ob_continue:       { en: 'Continue →', tr: 'Devam →', es: 'Continuar →' },
  ob_settings_later: { en: 'You can tell me how often to write, and the hours to leave you alone, whenever you like — from settings, or just by saying so.',
                       tr: 'Ne sıklıkta yazacağımı ve seni rahat bırakacağım saatleri istediğin zaman söyleyebilirsin — ayarlardan ya da bana söyleyerek.',
                       es: 'Puedes decirme cuándo escribirte y a qué horas dejarte tranquilo cuando quieras: desde los ajustes o simplemente diciéndomelo.' },
  ob_skip:           { en: 'Skip for now', tr: 'Şimdilik geç', es: 'Saltar por ahora' },
  ob_pin_create:     { en: 'Create a PIN for your child 🔐', tr: 'Çocuğun için bir PIN oluştur 🔐',
                       es: 'Crea un PIN para tu hijo 🔐' },
  ob_pin_confirm:    { en: 'Confirm the PIN 🔁', tr: "PIN'i onayla 🔁", es: 'Confirma el PIN 🔁' },
  ob_pin_create_b:   { en: 'Your child will enter this to log in.', tr: 'Çocuğun giriş yapmak için bunu girecek.',
                       es: 'Tu hijo escribirá esto para entrar.' },
  ob_pin_confirm_b:  { en: 'Enter the same 4 digits again.', tr: 'Aynı 4 rakamı tekrar gir.',
                       es: 'Escribe otra vez las mismas 4 cifras.' },
  ob_pin_mismatch:   { en: "The two PINs don't match. Try again.", tr: 'İki PIN aynı değil. Tekrar dene.',
                       es: 'Los dos PIN no coinciden. Inténtalo otra vez.' },
  ob_device_q:       { en: 'How will %name% use Tuto? 📱', tr: '%name% Tuto’yu nasıl kullanacak? 📱',
                       es: '¿Cómo va a usar Tuto %name%? 📱' },
  ob_dev_separate:   { en: 'Separate device', tr: 'Ayrı cihaz', es: 'Otro dispositivo' },
  ob_dev_separate_b: { en: "I'll scan a QR code to connect %name%'s device",
                       tr: '%name% için cihazı bağlamak üzere bir karekod okutacağım',
                       es: 'Escanearé un código QR para conectar el dispositivo de %name%' },
  ob_dev_same:       { en: 'Same device', tr: 'Aynı cihaz', es: 'El mismo dispositivo' },
  ob_dev_same_b:     { en: '%name% will switch to their profile from here', tr: '%name% buradan kendi profiline geçecek',
                       es: '%name% cambiará a su perfil desde aquí' },
  ob_game_q:         { en: 'Want me to open the game automatically?', tr: 'Oyunu otomatik açmamı ister misin?',
                       es: '¿Quieres que abra el juego automáticamente?' },
  ob_game_b:         { en: "I'll add screen time when your child earns enough Gems.",
                       tr: 'Çocuğun yeterince Gem kazandığında ekran süresi eklerim.',
                       es: 'Añadiré tiempo de pantalla cuando tu hijo gane suficientes Gems.' },
  ob_how_works:      { en: 'How it works', tr: 'Nasıl çalışır', es: 'Cómo funciona' },
  ob_how_works_b:    { en: 'When your child spends Gems on "%reward%", Tuto will automatically launch the game and start a countdown timer.',
                       tr: 'Çocuğun "%reward%" için Gem harcadığında Tuto oyunu otomatik açar ve geri sayımı başlatır.',
                       es: 'Cuando tu hijo gaste Gems en «%reward%», Tuto abrirá el juego automáticamente y empezará una cuenta atrás.' },
  ob_yes_connect:    { en: 'Yes, connect', tr: 'Evet, bağla', es: 'Sí, conectar' },
  ob_coming_soon:    { en: 'Coming soon', tr: 'Yakında', es: 'Muy pronto' },
  ob_all_set:        { en: 'All set! 🎉', tr: 'Her şey hazır! 🎉', es: '¡Todo listo! 🎉' },
  ob_ready:          { en: '%name% is ready to start earning Gems!', tr: '%name% Gem kazanmaya hazır!',
                       es: '¡%name% ya puede empezar a ganar Gems!' },
  ob_your_child:     { en: 'Your child', tr: 'Çocuğun', es: 'Tu hijo' },
  ob_lets_go:        { en: "Let's Go! 🚀", tr: 'Haydi başlayalım! 🚀', es: '¡Vamos allá! 🚀' },
  ob_connect_dev:    { en: "Connect %name%'s device 📲", tr: '%name% için cihazı bağla 📲',
                       es: 'Conecta el dispositivo de %name% 📲' },
  ob_connect_dev_b:  { en: "Scan this on %name%'s device to connect it",
                       tr: 'Bağlamak için %name% cihazında bunu okut',
                       es: 'Escanea esto en el dispositivo de %name% para conectarlo' },
  ob_go_dashboard:   { en: 'Go to Dashboard →', tr: 'Panoya git →', es: 'Ir al panel →' },
  ob_add_reward_t:   { en: 'Add a reward 🎁', tr: 'Ödül ekle 🎁', es: 'Añadir un premio 🎁' },
  ob_reward_name:    { en: 'Reward name', tr: 'Ödülün adı', es: 'Nombre del premio' },
  ob_gems_required:  { en: 'Gems required 💎', tr: 'Gereken Gem 💎', es: 'Gems necesarias 💎' },
  ob_add:            { en: 'Add reward', tr: 'Ödülü ekle', es: 'Añadir premio' },
  ob_not_logged_in:  { en: 'Not logged in. Please sign in and try again.',
                       tr: 'Giriş yapılmamış. Lütfen giriş yapıp tekrar dene.',
                       es: 'No has iniciado sesión. Entra y vuelve a intentarlo.' },
  ob_went_wrong:     { en: 'Something went wrong. Please try again.', tr: 'Bir şeyler ters gitti. Lütfen tekrar dene.',
                       es: 'Algo ha ido mal. Inténtalo otra vez.' },
  ob_server_error:   { en: 'Server error', tr: 'Sunucu hatası', es: 'Error del servidor' },
  // Step 3 tile blurbs. The tile NAMES come from the child dictionary.
  ob_t_reading:      { en: 'Builds a daily reading habit.', tr: 'Günlük okuma alışkanlığı kazandırır.',
                       es: 'Crea el hábito de leer cada día.' },
  ob_t_math:         { en: 'Keeps number skills sharp.', tr: 'Sayı becerilerini diri tutar.',
                       es: 'Mantiene en forma el cálculo.' },
  ob_t_writing:      { en: 'Grows writing & imagination.', tr: 'Yazmayı ve hayal gücünü büyütür.',
                       es: 'Hace crecer la escritura y la imaginación.' },
  ob_t_homework:     { en: 'Makes homework a routine.', tr: 'Ödevi rutine dönüştürür.',
                       es: 'Convierte los deberes en rutina.' },
  ob_t_drawing:      { en: 'Encourages creativity every day.', tr: 'Her gün yaratıcılığı teşvik eder.',
                       es: 'Anima a crear algo cada día.' },

  // ── ParentChildDetail ───────────────────────────────────────────────────────
  cd_approve:        { en: '✓ Approve', tr: '✓ Onayla', es: '✓ Aprobar' },
  cd_reject:         { en: '✕ Reject', tr: '✕ Reddet', es: '✕ Rechazar' },
  cd_pages_tap:      { en: '%n% pages · tap to enlarge', tr: '%n% sayfa · büyütmek için dokun',
                       es: '%n% páginas · toca para ampliar' },
  cd_drawings_of:    { en: "🎨 %name%'s drawings", tr: '🎨 %name% çizimleri', es: '🎨 Dibujos de %name%' },
  cd_awaiting:       { en: ' — %n% awaiting approval', tr: ' — %n% onay bekliyor', es: ' — %n% esperando aprobación' },
  cd_own_idea:       { en: 'Their own idea', tr: 'Kendi çizimi', es: 'Idea suya' },
  cd_rejected:       { en: 'Rejected', tr: 'Reddedildi', es: 'Rechazado' },
  cd_approved:       { en: 'Approved', tr: 'Onaylandı', es: 'Aprobado' },
  cd_tree_of:        { en: "🌳 %name%'s tree", tr: '🌳 %name% ağacı', es: '🌳 El árbol de %name%' },
  cd_tree_full:      { en: "Today's tree is complete 🎉", tr: 'Bugünün ağacı tamamlandı 🎉',
                       es: '¡El árbol de hoy está completo! 🎉' },
  cd_tree_today:     { en: 'Today %n%/%total% leaves', tr: 'Bugün %n%/%total% yaprak', es: 'Hoy %n%/%total% hojas' },
  cd_tree_month:     { en: 'A tree grew on %trees% of %days% days this month',
                       tr: 'Bu ay %days% günün %trees% gününde ağaç yetişti',
                       es: 'Árbol completo en %trees% de %days% días este mes' },
  cd_leaves_month:   { en: '%n% leaves this month', tr: '%n% yaprak bu ay', es: '%n% hojas este mes' },
  cd_prev:           { en: 'Previous', tr: 'Önceki', es: 'Anterior' },
  cd_today:          { en: 'Today', tr: 'Bugün', es: 'Hoy' },
  cd_pin_updated:    { en: 'PIN updated! ✅', tr: 'PIN güncellendi! ✅', es: '¡PIN actualizado! ✅' },
  cd_pin_new:        { en: 'Enter new PIN 🔐', tr: 'Yeni PIN gir 🔐', es: 'Escribe el PIN nuevo 🔐' },
  cd_pin_confirm:    { en: 'Confirm PIN 🔁', tr: "PIN'i onayla 🔁", es: 'Confirma el PIN 🔁' },
  cd_pin_new_b:      { en: 'Choose a 4-digit PIN', tr: '4 haneli bir PIN seç', es: 'Elige un PIN de 4 cifras' },
  cd_pin_again:      { en: 'Enter the same PIN again', tr: 'Aynı PIN’i tekrar gir', es: 'Escribe otra vez el mismo PIN' },
  cd_pin_mismatch:   { en: "PINs don't match. Try again.", tr: 'PIN’ler aynı değil. Tekrar dene.',
                       es: 'Los PIN no coinciden. Inténtalo otra vez.' },
  cd_edit_child:     { en: 'Edit child ✏️', tr: 'Çocuğu düzenle ✏️', es: 'Editar al niño ✏️' },
  cd_name:           { en: 'Name', tr: 'Ad', es: 'Nombre' },
  cd_save_changes:   { en: 'Save changes', tr: 'Değişiklikleri kaydet', es: 'Guardar cambios' },
  cd_session_expired:{ en: 'Session expired — please sign in again.', tr: 'Oturum doldu — lütfen tekrar giriş yap.',
                       es: 'La sesión ha caducado: vuelve a entrar.' },
  cd_sign_in_again:  { en: 'Please sign in again.', tr: 'Lütfen tekrar giriş yap.', es: 'Vuelve a entrar, por favor.' },
  cd_gift:           { en: 'Gift gems 🎁', tr: 'Gem hediye et 🎁', es: 'Regalar gems 🎁' },
  cd_gift_b:         { en: 'No task attached — %name% sees it right away as a bonus gift.',
                       tr: 'Bir göreve bağlı değil — %name% bunu hemen sürpriz hediye olarak görür.',
                       es: 'Sin tarea asociada: %name% lo verá enseguida como un regalo sorpresa.' },
  cd_amount:         { en: 'Amount — ⭐ %n% gems', tr: 'Miktar — ⭐ %n% gem', es: 'Cantidad — ⭐ %n% gems' },
  cd_amount_avail:   { en: 'Amount — ⭐ %n% gems (%have% available)', tr: 'Miktar — ⭐ %n% gem (%have% mevcut)',
                       es: 'Cantidad — ⭐ %n% gems (%have% disponibles)' },
  cd_reason:         { en: 'Reason (optional)', tr: 'Sebep (isteğe bağlı)', es: 'Motivo (opcional)' },
  cd_reason_gift_ph: { en: 'e.g. Birthday', tr: 'örn. Doğum günü', es: 'p. ej. Cumpleaños' },
  cd_reason_ded_ph:  { en: 'e.g. Toy purchase', tr: 'örn. Oyuncak alındı', es: 'p. ej. Compra de un juguete' },
  cd_sending:        { en: 'Sending…', tr: 'Gönderiliyor…', es: 'Enviando…' },
  cd_send_n:         { en: 'Send %n% gems', tr: '%n% gem gönder', es: 'Enviar %n% gems' },
  cd_deduct:         { en: 'Deduct gems ⚖️', tr: 'Gem düş ⚖️', es: 'Quitar gems ⚖️' },
  cd_deduct_b:       { en: 'No task or claim attached — for when you already handled the reward yourself.',
                       tr: 'Bir göreve ya da talebe bağlı değil — ödülü kendin hallettiysen.',
                       es: 'Sin tarea ni petición asociada: para cuando ya te has ocupado tú del premio.' },
  cd_removing:       { en: 'Removing…', tr: 'Kaldırılıyor…', es: 'Quitando…' },
  cd_remove_n:       { en: 'Remove %n% gems', tr: '%n% gem düş', es: 'Quitar %n% gems' },
  cd_gems_sent:      { en: 'Gems sent!', tr: 'Gemler gönderildi!', es: '¡Gems enviadas!' },
  cd_gems_removed:   { en: 'Gems removed', tr: 'Gemler düşüldü', es: 'Gems quitadas' },
  cd_gems_added_to:  { en: "%n% gems were added to %name%'s balance.", tr: '%name% bakiyesine %n% gem eklendi.',
                       es: 'Se han añadido %n% gems al saldo de %name%.' },
  cd_gems_taken:     { en: "%n% gems were removed from %name%'s balance.", tr: '%name% bakiyesinden %n% gem düşüldü.',
                       es: 'Se han quitado %n% gems del saldo de %name%.' },
  cd_ok:             { en: 'OK', tr: 'Tamam', es: 'Vale' },
  cd_goal_name_req:  { en: 'Give this goal a name.', tr: 'Bu hedefe bir ad ver.', es: 'Ponle un nombre a esta meta.' },
  cd_goal_min:       { en: 'A goal needs to cost at least 10 gems.', tr: 'Bir hedef en az 10 gem olmalı.',
                       es: 'Una meta tiene que costar al menos 10 gems.' },
  cd_goal_exists:    { en: 'There is already a goal called "%name%".', tr: '"%name%" adında bir hedef zaten var.',
                       es: 'Ya hay una meta que se llama «%name%».' },
  cd_goal_failed:    { en: 'Could not add this goal.', tr: 'Bu hedef eklenemedi.', es: 'No se ha podido añadir esta meta.' },
  cd_set_price:      { en: 'Set the price 🙋', tr: 'Fiyatı belirle 🙋', es: 'Ponle precio 🙋' },
  cd_edit_goal:      { en: 'Edit goal 🏆', tr: 'Hedefi düzenle 🏆', es: 'Editar la meta 🏆' },
  cd_add_goal:       { en: 'Add goal 🏆', tr: 'Hedef ekle 🏆', es: 'Añadir meta 🏆' },
  cd_asked_guessed:  { en: 'They asked for this and guessed ⭐ %n% gems. What it really costs is up to you.',
                       tr: 'Bunu istedi ve ⭐ %n% gem tahmin etti. Gerçekte kaça mal olacağına sen karar veriyorsun.',
                       es: 'Lo ha pedido y ha calculado ⭐ %n% gems. Lo que cuesta de verdad lo decides tú.' },
  cd_asked:          { en: 'They asked for this. What it costs is up to you.',
                       tr: 'Bunu istedi. Kaça mal olacağına sen karar veriyorsun.',
                       es: 'Lo ha pedido. Lo que cuesta lo decides tú.' },
  cd_icon:           { en: 'Icon', tr: 'Simge', es: 'Icono' },
  cd_goal_name:      { en: 'Goal name', tr: 'Hedefin adı', es: 'Nombre de la meta' },
  cd_goal_name_ph:   { en: 'e.g. Video game time, Ice cream…', tr: 'örn. Oyun süresi, Dondurma…',
                       es: 'p. ej. Rato de videojuegos, Un helado…' },
  cd_gem_cost:       { en: 'Gem cost', tr: 'Gem bedeli', es: 'Coste en gems' },
  cd_how_often:      { en: 'How often', tr: 'Ne sıklıkta', es: 'Cada cuánto' },
  cd_again:          { en: 'Again and again', tr: 'Tekrar tekrar', es: 'Una y otra vez' },
  cd_again_b:        { en: 'Screen time, an outing — they can earn it repeatedly',
                       tr: 'Ekran süresi, bir gezi — tekrar tekrar kazanabilir',
                       es: 'Tiempo de pantalla, una salida: puede ganarlo muchas veces' },
  cd_once:           { en: 'Just once', tr: 'Sadece bir kez', es: 'Solo una vez' },
  cd_once_b:         { en: 'A toy, a book — it disappears once you approve it',
                       tr: 'Bir oyuncak, bir kitap — onayladığında listeden kalkar',
                       es: 'Un juguete, un libro: desaparece en cuanto lo apruebas' },
  cd_add_this_goal:  { en: 'Add this goal', tr: 'Bu hedefi ekle', es: 'Añadir esta meta' },
  cd_remove_q:       { en: 'Remove %name%?', tr: '%name% kaldırılsın mı?', es: '¿Quitar a %name%?' },
  cd_remove_b:       { en: "This will permanently delete %name%'s profile, gems, and all activity. This cannot be undone.",
                       tr: '%name% için profil, gemler ve tüm etkinlik kalıcı olarak silinir. Bu geri alınamaz.',
                       es: 'Esto borrará para siempre el perfil de %name%, sus gems y toda su actividad. No se puede deshacer.' },
  cd_remove_yes:     { en: 'Yes, remove %name%', tr: 'Evet, %name% kaldır', es: 'Sí, quitar a %name%' },
  cd_gems_pill:      { en: '%n% gems', tr: '%n% gem', es: '%n% gems' },
  cd_gift_btn:       { en: '🎁 Gift gems', tr: '🎁 Gem hediye et', es: '🎁 Regalar gems' },
  cd_deduct_btn:     { en: '⚖️ Deduct', tr: '⚖️ Düş', es: '⚖️ Quitar' },
  cd_pending:        { en: '⏳ Pending', tr: '⏳ Bekleyenler', es: '⏳ Pendientes' },
  cd_cap_notice:     { en: "Today's limit of %n% was already used up, so this one was approved without gems.",
                       tr: 'Bugünkü %n% sınırı dolmuştu, bu yüzden bu gemsiz onaylandı.',
                       es: 'El límite de hoy (%n%) ya estaba agotado, así que esto se aprobó sin gems.' },
  cd_raise_limit:    { en: 'You can raise the limit in Task settings.', tr: 'Sınırı Görev ayarlarından artırabilirsin.',
                       es: 'Puedes subir el límite en los Ajustes de tareas.' },
  cd_all_caught_up:  { en: 'All caught up! ✅', tr: 'Hepsi tamam! ✅', es: '¡Todo al día! ✅' },
  cd_contributions:  { en: '🌱 Helping at home', tr: '🌱 Ev katkıları', es: '🌱 Ayuda en casa' },
  cd_no_pending_c:   { en: 'Nothing waiting.', tr: 'Bekleyen katkı yok.', es: 'Nada pendiente.' },
  cd_completed:      { en: '✅ Completed today', tr: '✅ Bugün tamamlananlar', es: '✅ Completado hoy' },
  cd_nothing_today:  { en: 'Nothing completed yet today.', tr: 'Bugün henüz bir şey tamamlanmadı.',
                       es: 'Hoy todavía no se ha completado nada.' },
  cd_n_correct:      { en: '%n%/%total% correct', tr: '%total% soruda %n% doğru', es: '%n%/%total% correctas' },
  cd_past_limit:     { en: "Past today's limit — done and saved, no gems",
                       tr: 'Bugünkü sınır aşıldı — yapıldı ve kaydedildi, gem yok',
                       es: 'Pasa del límite de hoy: hecho y guardado, sin gems' },
  cd_no_questions:   { en: 'No questions recorded.', tr: 'Kayıtlı soru yok.', es: 'No hay preguntas guardadas.' },
  cd_answer:         { en: 'Answer:', tr: 'Doğrusu:', es: 'Respuesta:' },
  cd_goal_requests:  { en: '🙋 Goal requests (%n%)', tr: '🙋 Hedef istekleri (%n%)', es: '🙋 Metas pedidas (%n%)' },
  cd_thinks:         { en: '%name% thinks ⭐ %n% — you decide', tr: '%name% ⭐ %n% diyor — kararı sen ver',
                       es: '%name% cree que ⭐ %n% — tú decides' },
  cd_asked_for:      { en: '%name% asked for this', tr: '%name% bunu istedi', es: '%name% ha pedido esto' },
  cd_claims:         { en: '🎁 Reward claims (%n%)', tr: '🎁 Ödül talepleri (%n%)', es: '🎁 Premios pedidos (%n%)' },
  cd_reward_goals:   { en: '🏆 Reward goals', tr: '🏆 Ödül hedefleri', es: '🏆 Metas de premio' },
  cd_no_goals:       { en: 'No reward goals set yet.', tr: 'Henüz ödül hedefi yok.', es: 'Todavía no hay metas de premio.' },
  cd_gems_needed:    { en: '⭐ %n% gems needed', tr: '⭐ %n% gem gerekiyor', es: '⭐ Hacen falta %n% gems' },
  cd_just_once:      { en: 'just once', tr: 'tek seferlik', es: 'solo una vez' },
  cd_claimed:        { en: 'Claimed — see above ⬆️', tr: 'Talep edildi — yukarı bak ⬆️', es: 'Pedido: mira arriba ⬆️' },
  cd_ready:          { en: 'Ready to claim! 🎉', tr: 'Talep edilebilir! 🎉', es: '¡Ya se puede pedir! 🎉' },
  cd_more_to_go:     { en: '%n% more gems to go', tr: '%n% gem kaldı', es: 'Faltan %n% gems' },
  cd_settings:       { en: 'Settings', tr: 'Ayarlar', es: 'Ajustes' },
  cd_task_settings:  { en: 'Task settings', tr: 'Görev ayarları', es: 'Ajustes de tareas' },
  cd_task_settings_b:{ en: 'Gem amounts and daily limits', tr: 'Gem miktarları ve günlük sınırlar',
                       es: 'Cantidades de gems y límites diarios' },
  cd_edit_child_b:   { en: 'Change name, age or avatar', tr: 'Ad, yaş ya da avatarı değiştir',
                       es: 'Cambiar nombre, edad o avatar' },
  cd_change_pin:     { en: 'Change PIN', tr: "PIN'i değiştir", es: 'Cambiar el PIN' },
  cd_change_pin_b:   { en: 'Set a new 4-digit PIN', tr: 'Yeni bir 4 haneli PIN belirle', es: 'Poner un PIN nuevo de 4 cifras' },
  cd_remove_child:   { en: 'Remove child', tr: 'Çocuğu kaldır', es: 'Quitar al niño' },
  cd_task:           { en: 'Task', tr: 'Görev', es: 'Tarea' },
  cd_bonus:          { en: 'Bonus Gift', tr: 'Sürpriz Hediye', es: 'Regalo sorpresa' },

  // ── shared ──────────────────────────────────────────────────────────────────
  a_back:            { en: 'Back', tr: 'Geri', es: 'Atrás' },
  a_close:           { en: 'Close', tr: 'Kapat', es: 'Cerrar' },
  a_next:            { en: 'Next', tr: 'Sonraki', es: 'Siguiente' },
  cancel:            { en: 'Cancel', tr: 'Vazgeç', es: 'Cancelar' },
  save:              { en: 'Save', tr: 'Kaydet', es: 'Guardar' },
  saving:            { en: 'Saving…', tr: 'Kaydediliyor…', es: 'Guardando…' },
  loading:           { en: 'Loading…', tr: 'Yükleniyor…', es: 'Cargando…' },
  years_old:         { en: '%n% years old', tr: '%n% yaşında', es: '%n% años' },
}

export { P as PARENT_STRINGS }

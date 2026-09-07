# CLAUDE.md — Tuto

Bu dosya her Claude Code oturumunda otomatik okunur. Tuto'nun bağlamını, mimari
kurallarını, çalışma tarzını ve güvenlik refleksini taşır. Kod yazarken bunlara uy.

## Ürün

Tuto, çocuklar için bir eğitim PWA'sı. Çocuklar eğitim görevlerini (matematik, okuma,
ev görevleri) tamamlayıp **Gem** kazanır; Gem'ler Roblox ekran süresine çevrilebilir.
Ürünün kalbi: ebeveynin **çocuğunu tanıyan gerçek biriyle** konuştuğunu hissettiği
Telegram tabanlı ebeveyn iletişim katmanı. Birincil test kullanıcısı 7 yaşındaki Ada.
(Geçmiş: ürün BrainToken adıyla başladı, Tuto'ya evrildi.)

## Stack

- **Frontend:** React + Vite, PWA, Vercel'de.
- **Backend:** Express, Railway'de.
- **DB:** Supabase (realtime ile submission dinleme dahil).
- **LLM:** Gemini 2.5 Flash (ana agent), Gemini 2.0 Flash (worker/otomasyon).
- **Mesajlaşma:** yalnızca Telegram.

## Mimari — çekirdek model

Detaylı mimari `design_handoff_parent_reskin/`'in dışında, ayrı bir mimari dokümanda
yaşıyor (Ebeveyn İletişim Mimarisi). Özet kurallar:

- **İki kapı, tek beyin.** Ortada düşünen tek beyin (Gemini), iki yanında kural uygulayan
  iki kapı: giriş kapısı (mesaj sayacı) ve çıkış kapısı (sendGate). "Öyle bir ebeveyn
  gelir ki..." senaryoları ya `prefs`'te bir alandır ya bir kapıda bir kontrol — beyne
  dokunmaz.
- **Altın kural: LLM yorumlar ve yazar, deterministik kod uygular.** Bir kuralın
  uygulanmasını asla modelin insafına bırakma (limit/saat kontrolü kodda, modelde değil).
- **Mesaj işleme üç kategori:** veri okuyan (araç gerekmez, bağlam yeter), veri yazan
  (`update_preferences` + `approve/reject_submission`), uzun kuyruk (`remember()`).
- **Üç katmanlı hafıza:** transkript (son 48 saat / min 10 mesaj) + `family_notes` +
  yuvarlanan `conversation_summary`.
- **Uygulama sırası:** typing/insanileştirme → iki kapı (prefs + sendGate) →
  function calling → hafıza → proaktif cron'lar. Bu sırayı koru.

## Çalışma tarzı

- Altyapı ve DB işlemlerini kullanıcı kendisi yapar. SQL migration verirken çalıştırılabilir
  tam SQL ver; kullanıcı Supabase SQL Editor'de çalıştırır.
- Mevcut dosya yapısına (`server/`, `frontend/` veya `tuto-app/`) göre yaz.
- Kullanıcı teknik olarak hands-on; temel kavramları açıklama, kararın ve gerekçesinin özüne gir.
- Kısa ve net ol. Gereksiz girizgah/özet/dolgu yok.
- Bir mimari karar verirken trade-off'u söyle, sadece "şunu yap" deme.
- **Yarım yapı kurma:** bir parça başka bir parçaya bağlıysa (örn. persona, prefs şemasına
  bağlı), önce bağımlılığı kur, sonra parçayı.

## Güvenlik refleksi (daha önce tespit edilen açıklar — tekrar düşürme)

- Gemini key frontend bundle'ında olmasın → Gemini çağrılarını **backend'e proxy'le**.
- API'de auth eksikliği → endpoint'lere auth koy.
- Gem/submission yazan endpoint'ler **sunucu tarafı doğrulama** yapmadan yazmasın.
- `.env` ve auth dosyaları repoya girmesin; sırları repoya sokma.

## Sabit kararlar (tekrar önerme)

- **Baileys / WhatsApp bırakıldı.** Test yalnızca Telegram, WhatsApp Business erişimi
  alınana kadar. Tekrar Baileys önerme.
- Persona parametreleri (`bot_name`, `tone`) typing promptuna değil, `prefs` şemasına bağlı.
- **İki ayrı dil ekseni var, birleştirme.** `children.language` çocuğun okuduğu dil (uygulama
  metinleri, sorular, ipuçları); `parents.prefs.language` ebeveyne yazdığın mesajların dili.
  Aynı ailede farklı olabilirler ve bir kez bunlar karıştırıldığı için Türkçe okuyan bir
  ebeveyne İngilizce ödül mesajı gitti.
- **Dil seçmek `lang === 'x' ? a : b` ile yapılmaz.** İkili ternary üçüncü dilde sessizce
  İngilizceye düşer. Frontend'de `say(lang, en, tr, es)` (`src/lib/i18n.js`), sunucuda aynısı
  (`server/lang.js`); dil listesi tek yerde (`LANGS` / `PARENT_LANGS`).

## Açık işler / yol haritası

- [x] Üçüncü dil: İspanyolca (2026-09-07). Çocuk tarafı: 301 i18n anahtarının hepsinde `es`,
      matematik şablonlarının 107 cümlesi + kelime bankaları, `numerals.js`'e İspanyolca sayı
      sözcükleri (16-29 tek kelime, `y` bağlacı yalnız onluktan sonra bağlar, binlik ayıracı
      nokta), `timeWords.js`'e saat okunuşu ("las 3 y cuarto", 1 için "la una"), yardım paneli
      ve saat rehberi tablo hâline geldi. Ebeveyn tarafı: sunucudaki 46 mesaj `say()`'e geçti,
      `parentLang()` tek kaynak, ve **ebeveyn artık kendi dilini seçebiliyor** — dashboard'da
      ayar kartının başında ve mesajla (`update_preferences.language`). Bunu eklemek zorunluydu:
      `prefs.language` sütun varsayılanıyla 'tr' geliyordu ve değiştirmenin hiçbir yolu yoktu,
      yani İspanyolca yazılan mesajlar hiçbir zaman tetiklenmezdi.
      **Dil seçimi İspanya (es-ES):** para birimi euro/céntimo, tarih `es-ES`. LatAm'a
      dönülürse değişecek yerler: `LANGS`'taki locale, `gemini.js`'teki `currency`, ondalık
      ipucundaki "1 € son 100 céntimos". Dilbilgisi için iki bilinçli karar: matematik
      kelime bankaları (nesneler, kaplar) **tamamı dişil** seçildi ki "¿Cuántas…?" her zaman
      uyumlu olsun; piktogram setleri sabit beş emoji olduğu için gerekli olan yerde tekil
      biçim (`one`) ve soru sözcüğü (`many`) ayrı alan olarak taşınıyor.
      Font tarafında iş yok: Baloo 2, Fredoka, Fredoka One, Lexend, Nunito ve Plus Jakarta
      Sans'ın hepsi ñ Ñ á é í ó ú ü ¿ ¡ karakterlerini taşıyor (woff2 cmap'lerinden fontTools
      ile ölçüldü), `npm run font:check` değişmeden geçiyor. `npm run i18n:check` artık
      `say()` çağrılarının içini "çevrilmiş" sayıyor — yoksa bir cümleyi düzgün çevirmek
      raporu üç bulgu kötüleştiriyordu.
      Yan düzeltme: `tree_this_month` iki kez tanımlıydı, ikincisi kazanıyordu ve orman
      arşivinin başlığı "THIS MONTH 🌳" diye çıkıyordu; başlık artık `tree_month_label`.
- [x] Sınıra takılan seanslar artık gem history'de görünüyor (2026-09-04). Cap'e takılan her
      seans `amount = 0, capped = true` ile tek bir `bt_ledger` satırı yazıyor; beş yazma yeri
      (math, reading, story, drawing onayı, ödev onayı) tek `recordGems()` yardımcısından
      geçiyor. `capped` ayrı bir sütun çünkü sıfır dürüstçe de gelebiliyor: ebeveyn bir ödevi
      bilerek 0 gem'le onaylayabiliyor, o satır "sınıra takıldın" diye okunmamalı. Migration:
      `server/migrations/2026-09-04_ledger_capped.sql` — sütun yokken capped satırı yazılmıyor
      (yalın "+0" boşluktan kötü), ödenen satır yazılmaya devam ediyor. Ekran tarafında liste
      artık "Geçmiş" değil "Neler yaptım"; capped satır tutar değil durum gösteriyor (🌙
      "Bugünlük tamam" — seans bitiş ekranının kullandığı sözlerin aynısı). Bakiyeyi etkilemiyor
      (0 toplama girmiyor) ve cap sayaçları `amount > 0` filtrelediği için sayılmıyor.
      Ebeveyn tarafında da aynısı: dashboard'daki "Completed today" capped seansı 🌙 + "Past
      today's limit" satırıyla gösteriyor, Telegram context'indeki `gemHistory` satırı kendi
      açıklamasını taşıyor (yoksa model "0 gem kazandı" diye okuyor). Ledger okuyan iki select
      `*` kullanıyor: eksik `capped` sütununu isimle istemek isteği komple düşürürdü ve o
      istek gem bakiyesini taşıyor. (2026-09-01'de Ada'nın 4. matematiğiyle görülmüştü.)
      Sınıra takılan seans artık ebeveyne de bildiriliyor (math + reading kendi mesajı,
      story'nin paylaşım mesajına tek cümle). `activity` olarak gidiyor — yani quiet/required
      seviyesindeki ebeveyn görmüyor, "günün sadece ilki" diyen de görmüyor (capped seans hiçbir
      zaman günün ilki değil). **Mesaj gem teklif etmiyor**: sınırı ebeveyn koydu, her akşam
      delmeyi önermek sınırı anlamsızlaştırır. Ebeveyn kendisi isterse promptta kural var:
      tek seferlik mi (`gift_gems`) yoksa kalıcı mı (`update_task_reward` + `daily_cap`) diye
      bir kez sorulur, mevcut sınır söylenerek. Sınırı artırmak geçmişe işlemez — ikisi birden
      isteniyorsa iki ayrı çağrı.
- [x] Matematik şablonlarında pedagojik denetim düzeltmeleri (2026-09-05). 5.600 soruluk taramada
      (7 yaş × 2 dil × 40 seans) çıkan dört madde: (1) sayarak toplama/çıkarma ipucu ve sayı
      merdiveni diziyi cevaba kadar yazıyordu — artık bir adım erken kesiliyor ve "?" ile
      bitiyor, son sayıyı çocuk söylüyor; (2) ondalık ipucu "…, 0.25 diye yazılır" diyerek cevabı
      veriyordu, artık parada duruyor ve İngilizcesi £/p yerine $ kullanıyor (promptun kendi
      para kuralıyla aynı); (3) bir seansta aynı cümle iki kez sorulabiliyordu — `generateProblem`
      artık operand anahtarının yanında SORU METNİNİ de dışlıyor (`avoidText`), buildSession
      seans boyunca metinleri biriktiriyor; (4) Year 1'e beşgen/altıgen/sekizgen çıkıyordu,
      artık o yıl yalnızca üçgen/kare/dikdörtgen (`shapePoolForLevel`), Year 3+ hepsi.
      Ölçüm: cevabı veren ipucu 912 → 312 (kalanların hepsi cevabın bir operanda eşit düştüğü
      tesadüfler: "1/4 of 16 → 4"), seans içi tekrar 65 → 0. Şablonların cevap doğruluğu
      3.617/3.617 doğru, dil sızıntısı 0, okuma sınırı ihlali 0.
      **Açık kalan:** Year 1'e (5-6 yaş) 1/3 çıkıyor — o yılın müfredatı yarım ve çeyrek diyor
      (`mathTemplates.js:569`, band ≤2 için [2,3,4]); kesir sorularının %36'sı. Düzeltmesi band
      1 → [2,4]. Kullanıcı kararı bekliyor.
- [x] Türkçe font denetimi (2026-09-05). Fredoka ve Fredoka One'da **ğ Ğ ş Ş ve İ** yok —
      ölçüm gözle/genişlikle değil, Google'ın servis ettiği woff2 dosyalarının cmap'inden
      (fontTools). `TrRound` bu yüzden var ama unicode-range'i yalnızca ğĞşŞ'yi kapsıyordu;
      **İ atlanmıştı** (ilk denetim tarayıcıda genişlik karşılaştırmasıyla yapılmış ve o yöntem
      İ'yi göremez — noktalı büyük I, fallback'in I'sıyla aynı genişlikte ölçülüyor). Sonuç:
      İ, TrRound'un arkasındaki Baloo 2'den geliyordu — kelimenin ortasında başka bir yazı
      karakteri, tam da TrRound'un önlemek için var olduğu şey. Range'e U+0130 eklendi.
      İkinci bulgu: 10 yerde (MathScreen SVG yardımcıları ×9, TutoMascot ×1) stack yalnızca
      `Fredoka, sans-serif`'ti — orada beş harf sistem fontuna düşüyordu. Bugün o düğümlerde
      sadece rakam ve "?" çiziliyor, yani ekranda kırık bir şey yoktu; ama Türkçe bir etiket
      eklendiği an sessizce bozulurdu. Hepsi FRED stack'ine çevrildi.
      Tekrarını engellemek için `npm run font:check` (`scripts/font-check.mjs`): index.css'teki
      unicode-range'i ve src'deki her font stack'ini tarıyor, Fredoka/Fredoka One içerip de
      TrRound/Baloo 2/Nunito gibi tam kapsamlı bir aile içermeyen stack'i bulursa non-zero
      dönüyor. Üç kırılma senaryosuyla (bare Fredoka, eksik rescue, range'den İ'nin düşmesi)
      doğrulandı. Kapsam tablosu: Baloo 2 / Nunito / Lexend / Plus Jakarta Sans Türkçenin
      tamamını taşıyor; Georgia ve monospace sistem fontu.
- [ ] Parent dashboard keşfedilebilirliği: ayar kartı sayfanın en sonunda, Notifications'ın
      altında, başlığı "How much I write" — hiçbir yerde "Settings" yazmıyor ve telefonda dört
      ekran aşağıda. Kullanıcı kendi ürününde bulamadı; cache değil (SW hiç olmamış, HTML
      must-revalidate, canlıda tarayıcı testi bölümü buluyor). Seçenekler: karta "Settings"
      başlığı verip Notifications'ın üstüne almak, ya da üst özet şeridine atlama satırı.
      Karar ertelendi (2026-09-01).
- [ ] Drawings, Eylül 2026 partilerinden kalan tek şey: `cizims_sep2026/drawings/robot`
      yayınlanmadı — çizim Optimus Prime, omzunda Autobot arması ve elinde silahla. Marka
      korumalı bir karakter; jenerik bir robot çizdirip aynı boru hattından geçirmek gerek.
      (Easy boşluğu ikinci partiyle kapandı: kelebek/uzaylı/roket/güneş ★☆☆, koala ★★☆;
      "Soon" kilitli kartları da artık gerçek çizim, `LOCKED` boş.)
- [ ] Galata'nın ilk adımı panonun sağ kenarında küçücük duruyor: kaynak panellerde çizim
      adım adım sağa kayıyor, hizalama son paneli sabit aldığı için erken adımlar oraya
      taşınıyor. Kalıcı çözüm hizalamayı çalışma anında değil, görsele **pişirmek**
      (panelleri kaydırıp ortak kırpmak) — o zaman `drawingAlign` da kimliğe düşer.
      Aynı desen daha hafif hâliyle big-ben ve alien'da da var.
- [x] Drawings dil boşluğu kapandı: kart adı artık `name_<lang>`, hazırlık ekranı ve
      ekrandaki bütün butonlar i18n'den geliyor; ebeveynin İngilizce bildirimi de artık
      `name_en` okuyor. Çocuk ekranında İngilizce metin kalmadı.
- [ ] Bulmaca (NVR) çocuğa açılışı: motor ve cevap doğruluğu düzeltmeleri main'de (2026-09-16);
      `/puzzle-lab` canlıda public ama hiçbir menüden linkli değil, lazy yükleniyor, yazma yok.
      PR #1 Codex incelemesi için açık bırakıldı — çıkan bulgular main'e ayrı düzeltme olarak gelir.
      Emoji artık font değil, Noto'nun SVG çizimleri (`puzzleArt.generated.js`); ikonlar ligature değil
      kod noktasıyla — ikisi de iOS/WebKit'te boş çıkıyordu (2026-09-16). Pictorial bir şey
      değişince `npm run puzzle:webkit`.
      Kör test turu (2026-09-18, 5-6 → 10-11, her bant cevap anahtarı görmeden çözüldü): "farklı
      resim" artık "çocuğun ayırt edebileceği resim" demek — `tooAlike` (≥35° dönüş ve ≥7px kayma);
      simetriye birkaç piksel kalan şekil simetri sorusuna girmez. Bilinçli bırakılanlar: `belongs` /
      `odd-one-out` dönüşü kural yapmaz (farklı şekiller arasında "aynı yön" okunmuyor), `strings`
      sorulmaz (5 seçenekte hep davul + 3 üflemeliyle çıkıyor, davul da tek kalıyor).
      **Çocuk ekranı yayında (2026-09-18):** "Bulmacalarım" kartı, tüm bantlar (yaştan), 10 soruluk sitting,
      Gem (30 × skor ölçeği, günde 3). Soruyu sunucu üretir, cevabı tarayıcıya hiç göndermez, her
      dokunuşu seed'den yeniden üretip kontrol eder (`puzzle_sessions` / `puzzle_attempts`).
      Ekran matematikle aynı tasarım ve dilde (Tuto karşılama, flash, sonuç kartı; "Aferin" yok, turkuaz).
      Sohbet `puzzleSessions` + `puzzleSkills` okuyor (matematik kuralı: son 12, 5'in altında rakam yok);
      "Bugün" şeridinde de var. 2026-09-18/19 gece kararları: 7-8'de resimli dizi yok (düz tekrar "çok
      kolay"), 8-9+ tek ikonlu dolgu dizisi yok, 7-8+ kategori sorusu komşu gruptan (meyve/bitki,
      memeli/böcek), 7-8 kaynak dengesi geometrik 4 / ikon 2 / emoji 4, belongs'ta cevap örneklerin
      ortak her özelliğini taşır. 2026-09-19: 7-8 geometrik dizisi döngü değil ilerleyen dizi (nokta 0→5 / 5→0, ok ya da yarım
      daire 45° adım) — döngüde cevap 3. figürün kopyasıydı, "çok kolay". Oturumda her ilişki/özellik/grup çifti bir kez
      (deve→çöl sonra kuş→ağaç tekrarı). Telefonda 5 şık zar dizilimi. Kör test (taze seed): 5-6 39/39, 7-8 43/45, 8-9 41/41, 9-10 43/43,
      10-11 42/43 — kaçırmalar düzeltildi. Kalan: iPad'de kart en altta (kaydırmadan görünmüyor). **İsim ve ikon kararı verildi (2026-09-16):** çocuk kartı
      "Bulmacalarım 🧩" / "My Puzzles 🧩" (kod zaten `puzzle` diyor; "Zekâ Oyunları" serbest oyun
      beklentisi kurar, "Şekil Bulmacaları" emoji/ikon sorularında yanlış olur), ebeveyn tarafı
      "Şekil ve örüntü bulmacaları (NVR)". İkon `src/assets/puzzle-tile-icon.svg` (2×2 ızgara + ?,
      turkuaz kart — pembe denendi, beğenilmedi, 2026-09-18); çocuk ekranı gelmeden ana ekrana kart koyma — boş sayfaya gider.
- [ ] Stories çeşitlilik: 11+ üretimi tek kalıba (AI-duygu-kontrolü / kapalı-dome) çöküyor;
      üretim promptuna premise çeşitliliği + alt-tema rotasyonu, ya da embedding ile
      semantik dedup. (Güvenlik değil, kalite.)
- [ ] Telegram "iki kapı": **çıkış kapısı bitti**, giriş kapısı (mesaj sayacı) kaldı.
      Biten: `prefs` şeması (2026-08-31 migration'ı), `sendGate` (notify_level + quiet_hours,
      `attention` her ikisini de deler), `approval_required` (kapalıysa "sorma" demektir —
      sunucu kendisi onaylar ve gem'i yatırır), parent dashboard'da ayar bölümü ve
      `update_preferences` sohbet aracı. **Otomatik pilot da bitti**: `prefs.autopilot`
      (`{ started_at, until }`) aynı iki noktayı kullanıyor — `needsParentApproval`
      ödev/çizim/katkıyı sormadan onaylıyor, `sendGate` güvenlik uyarısı dışında her şeyi
      tutuyor, dakikada bir dönen süpürme süresi dolan pencereyi kapatıp ne yaptığını
      özetliyor (`set_autopilot` aracı, en fazla 8 saat). Ödül talebi ve hedef isteği
      otomatik pilotta da ebeveyne sorulur. Kalan: giriş kapısı (mesaj sayacı).
- [ ] Problem 3: ebeveyn mesajla story konusu ekler — function calling aracı
      (add_story_ideas), Telegram katmanı gelince.
- [x] Güvenlik: VITE_GEMINI_API_KEY açığı kapandı — Gemini `/api/gemini/generate`'e proxy'lendi,
      ölü env değişkeni silindi, proxy'ye child-id + rate limit kapısı kondu. Kalan: çocuğun
      Supabase session'ı yok, o yüzden kapı "gerçek child UUID + kota" seviyesinde; tam auth
      çocuk session'ı ister.
- [x] Günlük gem sınırı artık her aktivitede ve her üç yerde ayarlanabiliyor: onboarding step 3
      (tile başına dial), Task settings (her kart) ve Telegram'da `update_task_reward` (`gems` ve
      `daily_cap` ayrı ayrı, ikisi de opsiyonel). Sunucuda tek kaynak `TASK_DEFAULT_CAPS`
      (reading/math/writing/homework 3, drawing 2). Sınırı olmayan tek iş ödevdi; artık onay
      anında capli — özellikle otomatik pilotta önemliydi, orada onayı sunucu veriyor. Bunun için
      ödev onay/red dashboard'dan sunucuya taşındı (`/api/submissions/:id/approve|reject`,
      ebeveyn JWT'si + sahiplik): tarayıcı artık `bt_ledger`'a kendi seçtiği tutarı yazmıyor.
      (2026-09-03)
- [ ] Stories generator otomasyonu: job hazır (jobs/generateStoryIdeas.js) ama henüz
      zamanlanmadı. Şimdilik elle `node jobs/generateStoryIdeas.js`. Otomatikleştirince
      ya Railway ayrı cron servisi ya da in-process node-cron (job'ı exit etmeyen
      importable fonksiyona çevirip cron.schedule ile).

## design_handoff_parent_reskin/ hakkında

Repodaki bu klasör bir **görsel re-skin referansıdır**, production kodu değil. Parent
ekranlarını "Tuto Care" görünümüne (teal/peach, Plus Jakarta Sans) çevirmek için
kullanılır. Kurallar `design_handoff_parent_reskin/README.md`'de. **Saf görsel re-skin:**
mevcut hook/handler/Supabase wiring'e dokunma, veri olmayan yere veri uydurma. Değişiklikler
`src/screens/`'e gider, bundle'a değil.

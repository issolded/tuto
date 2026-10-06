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

- **Kitap okuma alanı** (2026-10-04): okuyucu telefon sütununa sabitlenmez; portal ile
  tam ekran açılır, masaüstünde 680px sayfa ve 18px metin kullanır. Telefonlarda genişliğe
  uyarlanır; sayfa taşarsa metin kaydırılır, sayfa değişince kaydırma sıfırlanır.
  Arşiv sırtları raf genişliğinin 1/20'si; koltuk kapağı oda ile orantılı ölçeklenir.


- **Kitap arşivi** (2026-10-04, kullanıcı kararı): devam eden okumalar ve taslaklar ana
  Library'de kompakt kartlar; tamamlanan kitap/hikâyeler ayrı oda görünümünde. Oda yalnızca
  gerçek tamamlanan kayıtlarla dolar, örnek kayıt yok. 36 kitap/sayfa, sabit sarı olmayan
  sırt renkleri ve küçük altın başlık; seçilen kitap koltukta. Arama, tür/yıl filtresi,
  kapak görünümü. Eski kayıtta bitirme tarihi yoksa yıl uydurulmaz. DB migration gerekmez.
  Prototipteki günlük/puanlama/ilham etkileşimleri bu yayının kapsamında değil.


- **Hikâye yazma düğmeleri** (2026-10-04, kullanıcı kararı): Şimdi kaydet + Kaydet ve çık
  yazı alanının altında yan yana; Hikâyemi bitirdim onların altında tam genişlikte.
  Başlık etiketinde isteğe bağlı açıklaması yok; başlık zorunlu değil.


- **Hikâye kitaplığı kompakt kapaklar** (2026-10-03, kullanıcı kararı): kapaklar en fazla 190px,
  dar ekranda otomatik satırlanır. Görselsiz hikâyeler kitap sırtı/sayfa kenarı, büyük harfli başlık
  ve by + çocuk adıyla görünür; uzun başlık kırpılır, tam adı erişilebilir etikette kalır.


- **PIN kilidi 1 dakika** (2026-10-02, kullanıcı kararı). Aile başına 5 yanlış PIN sonrası 60 saniye; ebeveyn bildirimleri EN/TR/ES aynı süreyi söyler.

- **Baileys / WhatsApp bırakıldı.** Test yalnızca Telegram, WhatsApp Business erişimi
  alınana kadar. Tekrar Baileys önerme.
- Persona parametreleri (`bot_name`, `tone`) typing promptuna değil, `prefs` şemasına bağlı.
- **İki ayrı dil ekseni var, birleştirme.** `children.language` çocuğun okuduğu dil (uygulama
  metinleri, sorular, ipuçları); `parents.prefs.language` hem ebeveyne yazdığın mesajların
  hem de ebeveyn ekranlarının dili. Aynı ailede farklı olabilirler ve bir kez bunlar
  karıştırıldığı için Türkçe okuyan bir ebeveyne İngilizce ödül mesajı gitti.
- **İki sözlük var.** Çocuğun okuduğu `src/lib/i18n.js`, ebeveynin okuduğu
  `src/lib/parentI18n.js`. Ebeveyn ekranında `const s = useT()`, sonra `s('key')`.
  Ekranda hem çocuğun hem ebeveynin gördüğü tek şey **görev/tile adları** — onlar tek
  kopya, çocuk sözlüğünden okunuyor (`childT('task_math', lang)`), ki ikisi aynı şeyden
  aynı kelimeyle bahsedebilsin.
- **Ebeveyn arayüzünün dili localStorage'da (`tuto_ui_lang`), hesap onun üstüne biniyor.**
  Splash ekranında henüz hesap yok; kayıt olurken cihazın seçimi `prefs.language`'a yazılıyor,
  giriş yapınca `prefs` cihazı eziyor (`adoptAccountLang`), dashboard'daki seçici ikisini de
  yazıyor. Yani seçim ilk dokunuşta gerçek ve sonraki cihaza da taşınıyor.
- **Dil seçmek `lang === 'x' ? a : b` ile yapılmaz.** İkili ternary üçüncü dilde sessizce
  İngilizceye düşer. Frontend'de `say(lang, en, tr, es)` (`src/lib/i18n.js`), sunucuda aynısı
  (`server/lang.js`); dil listesi tek yerde (`LANGS` / `PARENT_LANGS`).
- **Mantık UI metnine bakmaz.** Onboarding'de oyun ödülü `label.includes('video game')` ile
  bulunuyordu; etiket çevrilir çevrilmez o adım sessizce atlanırdı. Artık `kind: 'game'`.

## Android teslimat kararı — 2026-10-06

Kullanıcı dummy/çevrimdışı Android önizlemesini istemiyor; tek, gerçek backend'e bağlı,
uçtan uca çalışan Android native uygulama istiyor. iOS bu işin dışında. Gerçek native kaynak
`claude/practical-franklin-xigneu` (`6468f58`); eski `mobile/native-tablet-preview` canlı
özelliklerin kaynağı değildir. `codex/android-complete` dalına main `11869e7` birleştirildi.
Bu birleştirme web ekranlarının native taşındığı anlamına gelmez. Eksikler `mobile/README.md`.
6 Ekim 21:11 Dubai kullanıcı güncellemesi: canlı doğrulama sürerken testleri geçen gerçek
native APK'yı kendi tabletinde denemek için açıkça istedi. 0.5.0 (kaynak 7c9cb3a,
20 JVM + 11 tablet testi) teslim edildi; bu canlı E2E kabulü değildir. Eski dummy
önizleme geri getirilmez. Eski otomatik
preview release adımı bu geliştirme dalında kaldırıldı. 6 Ekim 2026: değişiklikler uzak dalda; eski android-preview yayını ve APK gerçekten silindi (CI 37477802302); etiket/kaynak geçmişi tutuldu.

Android takip (2026-10-06): 34 web rotası / 30 ekran dosyası envanteri
`mobile/WEB_PARITY_AUDIT_2026-10-06.md`. Kullanıcının tercihi **alt menü**, sol menü değil;
Home/Goals/Settings native alt gezinmeye geçirildi. PIN unutma, hedef hataları ve sunucudan
bakiye yenileme; bulmaca ipucu/skip/pekiştirme başlat-bitir-ertele eklendi. Native bulmaca
JVM testleri 4/4; izole backend matrisi 8 yaş × EN/TR/ES geçti. Bunlar cihaz veya gerçek
WhatsApp teslim testi değildir. Eksik native modüller dosyada ayrı; CI/yayın izni beklemek
bunların tamamlandığı anlamına gelmez.

## Açık işler / yol haritası

- [x] Astra'nın İngilizce/NVR/PIN incelemesi (2026-10-04, Claude; `e15821e` üzerinde). Düzeltilenler: **NVR'a "Bilmiyorum"** (sıfır gem, cevap + açıklama; İngilizcedeki gibi, yalnız hiçbir şık seçili değilken);
      **NVR ipucu 2'de çizilen şıkkın sebebi** (`reasonFor`: şıkın `why`'ı + türün anlamı — "farklı olan"da şık özelliği paylaşır, "ait olan"da paylaşmaz; glyph/icon aileleri için tür bazlı sebep);
      glyph-odd 3. basamak "ne işe yarar/nerede yaşar" kalktı (meyve/bitki sorusunu yanlış eksene götürüyordu); TR "farklı bak" dilbilgisi; kelime merdiveni "↓ 1 letter" etiketi çevrildi;
      İngilizce 2. ve 3. basamak aynı yanlış şıkkı tekrarlıyordu → örnek artık İKİNCİ yanlış şık; TR "Yalnızca bu kelimeyle kafiyeli", ES "No forman dos palabras reales", "tú solo" → "sin ayuda",
      ES ebeveyn mesajında "solos/puzzles" → "sin ayuda/acertijos", "+1 gems" → "+1 gem" (matematik dahil); pekiştirme teklif kartı kesin üst sınırı gösteriyor ("En fazla +3 gem", ya da "Bu sefer gem yok",
      `review.max_gems`). Odak sırasında nadir bir nitelik çifti ("inner+size") bulunamazsa aynı türden soru araya girer. Astra'nın önerisi uygulanmadı: ipucunu geciktirme (sabır ölçer, takılan çocuğu cezalandırır) — kabul.
      Açık: gerçek iPad WebKit çizimi doğrulanmadı; ES ebeveyn mesajında "gems" kelimesi uygulamanın geri kalanıyla tutarlı olsun diye bırakıldı.
- [x] Çocuk PIN'ini unutursa (2026-10-04, Claude). **Çocuk kendi kendine sıfırlayamaz** (PIN çocukları ayırır ve gem/ekran süresini kardeşten korur); ebeveyn yeni PIN verir ve çocuğa
      KENDİ söyler. Akış: PIN ekranında "PIN'imi unuttum" → `POST /api/family/:code/forgot-pin` ebeveyne `attention` mesajı (10 dk'da bir, aile kodu yoksa da aynı cevap, hiçbir şey
      değişmez) → ebeveyn sohbette "Ada'nın PIN'ini sıfırla" / "Ada'nın PIN'i 4821 olsun" → `reset_child_pin` aracı (`resetChildPinTool`: kendi seçtiği ya da sunucunun ürettiği 4 hane,
      kardeşte olanı ve 0000/1234 gibileri reddeder, ailenin kilidini açar, PIN'i bir kez döner, yalnız hash saklanır). Panelde de: çocuk sayfası → PIN'i değiştir → "🎲 Benim için oluştur".
      **Eski PIN gösterilmez** (hash). Sohbet modeli "unuttu" deyince önce "yapamıyorum, ayarlara git" diyordu: sistem istemine ve araç açıklamasına açık kural eklendi, `chat-probe` ile
      TR/ES/EN'de 2'şer koşuda doğrulandı (sorar, evet deyince çağırır; yazma duvarı açıkken gerçek PIN değişmedi). Test: `server/scripts/pin-flow.mjs`. **Açık:** PIN ekranındaki düğme
      küçük telefonlarda tuş takımının altında kalıyor (kaydırınca görünür); yeni PIN sohbet geçmişinde kalır (4 haneli çocuk PIN'i için kabul edildi).
- [x] İngilizce yardımda resimli üçüncü basamak (2026-10-04, Claude; kullanıcı fikri). Yapıya dair sorularda metin yerine çizim: alfabe şeridi
      (`alpha-order` ilk harfler, `letter-analogy` kaydırma okları + sayı kısmı), anahtar tablosu (`letter-code` ilk harf çözülü gerisi "?", `letter-sum`),
      iki kelime alt alta değişen harf yanık (`change-pattern`), kelime merdiveni (`word-ladder`; `?` ortada, uçlarda farklı harfler yanık), mantık tablosu
      (`logic-grid`, yalnız cevap bildirilince). Veri sunucuda (`visualFor` in `englishHelp.js`, cevap açıkken `?`, kapanınca dolu `explain_visual`), çizim
      `src/components/EnglishHelpVisual.jsx`. Denetim: açık resim cevabı taşımıyor, dolu resim cevabı yazıyor (`english-help-audit`). Tarayıcıda 390px.
      **Sıradaki fikir (kullanıcı):** kapalı küme "ölçek kartı" (north→south için dört yön, "?" karşıda; günler, mevsimler, aylar, büyüklük/sıcaklık
      ölçekleri) — elle yazılmış küçük bir tablo ister (antonimlerin çoğu kapalı küme değil), kapsam tahminen %5-15.
- [ ] Uygulamada hikâye yazma (2026-10-02, Codex): yerel geliştirme hazır. Otomatik kayıt,
      cihazda kurtarma kopyası, birden fazla taslak, kütüphaneden devam, sürüm çakışması koruması.
      Değerlendirme sunucuda; taslakta Gem yok, ilk tamamlamada mevcut ödül akışı.
      **Önce migration:** server/migrations/2026-10-02_story_drafts.sql. Sonra backend/frontend yayın.
      Gerçek Supabase/Gemini testi ve fiziksel iPad doğrulaması bekliyor. Ayrıntı: handoff/STORY-WRITER.md.


- [x] Astra notları: denklem sistemi, saat sayacı, geçme dili, gem açıklaması (2026-10-03, Claude). **(1)** 13 yaş denklem sistemi yardımı artık gerçek eleme
      zinciri (`simultSteps`, `mathTemplates.js`): sorulmayan harf elenir, çarpanlar söylenir, çarpılan sayılar tek tek yazdırılır, topla/çıkar, böl;
      negatifler `stpS` ile (eksi tuşu yok). "O harfi" → "bu değişkeni". math:check (13 yaş × 3 dil × 400) temiz. **(2)** Saat "N saatte kaç dakika" yardımında
      sayaç: "🔄 2 tam tur = 120 dakika (+24)" (`DraggableClock turnCounter`, yalnız `ask: 'span'`), tarayıcıda 2,4 tur çevrilerek denendi. **(3)** "Bunu geç":
      "Bu soruyu geçtin. Doğru cevap:", 1,3 sn (eskiden 0,9 sn ve "Hmm, bu değil!"). **(4)** Sonuç ekranında gem altında küçük satır: "6 yardımsız doğru · 3 ipucuyla
      doğru · 1 geliştirilecek" (matematik, İngilizce, NVR; hepsi yardımsız ve hatasızsa görünmez). Gerçek MathScreen oturumunda uçtan uca oynanmadı.
- [ ] NVR (şekil ve örüntü bulmacaları): ipucu, yardım ve pekiştirme (2026-10-03, Claude). İngilizcenin aynı yapısı, aynı sunucu çekirdeği
      (`server/englishPlay.js`: bir deneme sonra yardım, soru başı pay; `mathReview.js`'in seçimi). **Migration önce:**
      `server/migrations/2026-10-03_puzzle_help_and_review.sql` (`puzzle_attempts.wrong_tries/hints_used`, `puzzle_reviews`); yokken eski davranış
      (kayıt yok, gem doğruluk ölçeğiyle, teklif yok, mesaj hemen). İpucu 3 basamak, sunucudan istenince (`src/lib/puzzleHelp.js`, 23 tür EN/TR/ES):
      (1) bu tür bulmacaya nasıl bakılır, (2) yanlış bir resim soluklaşır, (3) neye bakılacağı (kuralın niteliği adıyla, cevap değil);
      cevap bildirilince mevcut `explainQuestion` cümlesi. Pekiştirme: aynı TÜR + aynı nitelikten ("sequence|dots") taze bulmaca, sunucu işaretler;
      ebeveyn mesajı pekiştirme bitene kadar bekler (`puzzleSessionNotice`); kalan türler sonraki oturumun başına (`generateSession` `focus`).
      Doğrulama: harness'te yaş 5-12 × EN/TR/ES (`server/scripts/puzzle-matrix.mjs`), uç durumlar (`puzzle-edge.mjs`), migration yokken
      (`puzzle-premigration.mjs`), ekranda 390px; `npm run english:check` artık `puzzle-help-audit`'i de çalıştırıyor. **Açık:** canlıda
      denenmedi (migration bekliyor); ipuçlarının çocuğa öğrettiği ölçülmedi; görsel bulmacalarda (matris, küp açınımı) üçüncü basamak
      genel kalıyor; TR/ES metinleri anadili konuşan biri okumadı.
- [ ] İngilizce: ipucu, yardım ve pekiştirme (2026-10-02, Claude; `claude/math-hint-quality`). Matematiğin yapısı İngilizceye
      taşındı. **Migration önce:** `server/migrations/2026-10-03_english_help_and_review.sql` (`english_attempts.wrong_tries/hints_used`,
      `english_reviews`). Tablo yokken sunucu eski davranışa düşer: tur/ipucu kaydı yok, gem doğruluk ölçeğiyle, pekiştirme teklifi yok,
      ebeveyne mesaj hemen gider. **Akış (7+ yaş = tüm İngilizce bantları, "bir deneme sonra yardım"):** ilk yanlışta soru geri gelir
      (yanlış şık soluklaşır, tek cevaplıda; 💡 titrer, hiçbir şey açıklanmaz); ipucuna bakıp yanlış ya da ikinci yanlış → doğru kelimeler
      + adım adım açıklama. Gem soru başı: yardımsız doğru 1, ipucu/ilk yanlış denemeden sonra doğru 0,5, yanlış/"bilmiyorum" 0
      (`server/englishPlay.js`, test `english-play.test.mjs`). **İpucu 3 basamak, sunucudan istenince** (cevap anahtarı tarayıcıya hiç
      gitmez): (1) o soru türüne nasıl bakılır, (2) yanlış bir şık çizilir + sebebi (`why`), (3) cevaptan bir adım önce biten zincir.
      Cevap bildirilince aynı zincir cevabıyla tam gösterilir. 49 türün tamamı EN/TR/ES, `src/lib/englishHelp.js` (motorla birlikte
      `server/english`'e senkronlanır); kapı: `scripts/english-help-audit.mjs` (`english:check` içinde: cevap ipucunda sızıyor mu,
      eksik dil, "undefined", cevap açıklamada adı geçiyor mu, 2. basamak doğru şıkkı çiziyor mu). **Pekiştirme:** mathReview.js'in seçimi
      ve payları aynen (tür = matematikteki konu): yanlış/geçilen + ipucu görülenlerden en çok 5; soruları sunucu aynı türden, çocuğun
      görmediği taze üretir (`server/englishReview.js`), cevapları sunucu işaretler (matematikte istemciye güvenilir, burada değil);
      ilk turda hiç gem almayanlar 0,5 pay geri kazandırır, ipucu görülenler yalnız pratik; ebeveyn mesajı tek ve pekiştirme bitene
      kadar bekler (`englishSessionNotice`); "Şimdi değil"/30 dk sonra kalan türler bir sonraki oturumun başına (7 gün, bir kez,
      `generateSession` `focus`). Gem geçmişi `english_review` satırı (✓ ya da +n), oturumu açar. Doğrulama: gerçek `server/index.js`
      bellek içi sahte Supabase'le (`server/scripts/english-harness.mjs`) uçtan uca, ve gerçek ekranda 390px'te oynandı (yanlış→nudge→
      ipucu 3 basamak→açıklama, pekiştirme teklifi/oynama/gem). **Açık:** gerçek Supabase/Railway ile denenmedi (migration bekliyor);
      ipuçlarının çocuğa gerçekten öğrettiği ölçülmedi (audit sızıntıyı ve tutarlılığı ölçer, pedagojiyi değil), TR/ES metinler anadili
      konuşan biri tarafından okunmadı; ipucu "ayrı çizilmiş yanlış örnek" adımı (join-letter, hidden-word, front-letter…) açıklamada da
      çıkıyor; pekiştirme teklifi sonuç ekranı yenilenince geri gelmez (30 dk içinde ebeveyne "yapılmadı" gider); sohbet bağlamı
      (`englishSessions`) yardım sayısını henüz taşımıyor; iPad/Ada'nın cihazında denenmedi.
- [x] Sohbet bağlamına son İngilizce oturumun soruları (2026-10-02, Claude). Ebeveyn "neyi yanlış yapmış?" diye sorunca model yalnızca
      beceri yüzdelerini görüyordu, "birebir detayları göremiyorum" deyip tahmin yürütüyordu. `recentEnglishQuestions`: son bitmiş
      oturumun yanlış/geçilen soruları (ne soruldu, çocuk ne seçti, doğru neydi) bağlamda; not: bunun ötesinde tahmin yok, bu
      listeden yüzde söyleme. Matematikte `recentMathQuestions` zaten vardı. Gerçek `handleMessage` ile (chat-probe) tekrar
      oynatıldı: iki koşuda da dört yanlış soru doğru listelendi.
- [x] Karalama defteri (2026-10-02, Claude). `src/components/Scratchpad.jsx`: soru ekranının sağ altında ✏️, açılınca parmakla/kalemle/fareyle
      sorunun ve şıkların üstüne yazılır; mürekkep 3 renk, silgi, hepsini sil. Kalem seçilince ekranın tüm çalışma alanını kaplayan yarı saydam, düz (çizgisiz) "aydınger" kâğıt gelir (telefonda şıkların yanında
      yazacak yer yoktu): soru ve şıklar altında görünür, kalem bırakılınca kâğıt kalkar ama mürekkep soru bitene kadar ekranda kalır
      (not okunarak cevap verilir). Kâğıt `position: fixed`, sütunun ekrandaki dikdörtgeni kadar (`selector` ile bulunur; ResizeObserver);
      mürekkep sütunla birlikte KAYMAZ (kaydırma kalemle zaten kapalı). Kapalıyken dokunuşları geçirir (ekran aynen
      eskisi); açıkken sayfa parmak altında kaymaz (bilinçli ödünleşme). Yeni soruda defter boşalır ve kalem bırakılır; hiçbir
      şey kaydedilmez/gönderilmez. Matematik (`.math-qscroll`) ve İngilizce (`.pz-scroll`) soru ekranlarında; bulmaca ekranı henüz yok.
      Tarayıcıda matematik ekranında denendi (çizim, silgi, temizleme, yeni soruda boşalma); İngilizce ekranı derlemede doğrulandı,
      uçtan uca oynanmadı; iPad/Apple Pencil gerçek cihazda denenmedi (avuç içi reddi pointerType'a göre eklenebilir).
- [x] Kâğıtta matematik %20 fazla gem verir (2026-10-02, Claude; kullanıcı kararı). Mod seçim ekranında kâğıt kartı "En fazla 54 Gem
      🎁 %20 bonus" (45 × 1,2 yuvarlanmış), istemci `mode` gönderir, sunucu `sessionGems` (`server/mathGems.js`, `PAPER_BONUS`)
      ile çarpar; günlük sınır ve gem tavanı aynı. Ebeveyn mesajına "Kâğıtta çalıştığı için %20 bonus" eklenir. Kâğıtta
      pekiştirme turu yok (soru başı kayıt/şablon yok) ve fotoğraf okumasına güveniyor: okuma hatası bonusu da götürür.
- [x] Ebeveyn geri bildirimi + 6-8 yıldızları (2026-10-02, Claude). Ebeveyn sohbette uygulamadan
      memnuniyetsizlik/öneri/hata söylerse `submit_feedback` aracı `parent_feedback`'e yazar (migration
      `2026-10-02_parent_feedback.sql`): ebeveynin kendi sözü + modelin İngilizce özeti, aynı ebeveyn/alan/tür
      günde tek satır (`repeats`), günde en çok 5. Model "kaydettim" demeyi yalnız success:true'dan sonra,
      söz (düzeltilecek/güncellemede) vermeden yapabilir; kaydedilemediyse "kaydedemedim" der (probe ile
      doğrulandı). Satırlar şimdilik Supabase'de okunur. Tetik: WhatsApp'ta model "ekibe iletiyorum" demişti, aracı yoktu.
      Ana sayfa göstergesi her yaşta BUGÜNÜN seansı / günlük gem sınırı (`dailyFor`): 6-8'de noktalar ●●○ (en çok 5,
      sınır 10 ise ölçekli, dolunca ✓, "bugün"), 9-11'de halka "2/3 bugün" (artık seviye değil), 12+'da "bugün 2/3" ve
      günlük dolgu. Yıldız değil nokta: ⭐ uygulamada gem'in simgesi. Eskiden `weekByType` idi ve ebeveyn seviye diye
      okudu; sohbet modeli de bunu "günlük kota" diye yanlış açıklamıştı.
- [ ] Pekiştirme turu (2026-10-02, Claude; `claude/math-hint-quality`). **Migration önce:**
      `server/migrations/2026-10-02_math_reviews.sql` (`math_reviews`). Tablo yokken sunucu eski
      davranışa düşer: teklif yok, ebeveyne mesaj hemen gider (güvenli). Ekran oturumu bitince hatalı/
      geçilen ya da iki yanlış denemeden sonra bulunan sorulardan (tek yanlış deneme dahil değil) en çok 5
      soruluk tur teklif edilir (`server/mathReview.js`, test `scripts/tests/math-review.test.mjs`):
      önce hatalı/geçilenler, beceri başına bir soru, sonra kalanlar; yalnız şablon soruları (LLM sorusu
      yeniden üretilemez); soruları sunucu seçer, **metni istemci aynı şablondan üretir** (`startReview`).
      Sonuç ekranında Done yerine "Pekiştirelim (n)" + "Şimdi değil"; hepsi doğruysa Done aynen kalır.
      **Gem (Astra incelemesi sonrası, 2026-10-02):** yalnız ilk turda HİÇ gem almamış (yanlış/geçilen) sorular
      0,5 soru payı kazandırır (pekiştirmede yardımla bulunursa 0,25) — tek yanlışla doğru bulanın aldığını geçmez;
      yardım ekranıyla bulunan sorular pekiştirmeye girer ama gem vermez (aksi hâlde iki yanlış, bir yanlıştan çok
      kazandırıyordu). Havuz: yanlış/geçilen + yardım ekranı gösterilmiş sorular (`help_shown`); pekiştirmede yeniden
      yardım ekranı açılırsa beceri taşınmaya devam eder. Yeni soru aynı BİÇİMDEN üretilir (`src/lib/reviewQuestions.js`: operandKey'in rakamsız
      bölümleri; başka biçime asla düşmez, çekilemezse o soru pekiştirmeden çıkar; soru metni yasağı yok, çünkü metni hiç
      değişmeyen biçimler yalnız resimle ayrışır; şablon konusu `templateTopicFor`'dan, `problem.topic`'ten değil).
      Pekiştirmede ipucu da kullanılmışsa beceri taşınmaya devam eder (bağımsız ilk geçiş sayılır).
      Biçim = anahtarın rakamsız bölümleri + anahtardaki işlem işaretleri + EKRANDAKİ işlem işaretleri (`operationSigns`):
      kesirlerde çarpma yerine bölme gelmesi ve (−6) − (−16) yerine (−2)² gelmesi (Astra bulgusu) kapandı. Kalıcı çözüm
      üreticinin açık bir `skillKey` vermesi (şu an biçim anahtar+metinden tahmin ediliyor). Adım adım yardımda aynı adımda iki yanlış → adım açıklanıp gösterilir.
      7 yaş çocuk gözüyle uçtan uca oynama (2026-10-02): ilk yanlışta artık söz de var ("Hmm, tam değil. 💡'ya dokunup ipucuna
      bak!", 7 sn, ipucu açılınca kalkar); iki basamaklı aralıkta (28 → 50) ipucu da yardım gibi yuvarlak sayılara sayarak
      gidiyor (telafi yöntemi yalnız 100'ün üstünde); çetelede satır önce bulunur sonra sayılır; 5-8 yaş sayı doğrusu ipucu yalın.
      8 yaş (TR) oynama: "bitirme/başlama saati" soruları (tafter/tbefore) artık adım adım dakika zincirli yardıma sahip (saat
      sınırını geçerse tam saate kadar, sonra kalan; cevap tam saatse zincir yok); bölme hikâyesi ipucu "hangi sayı × b = a" der
      (÷'yı yinelemek yöntem değildi); dizi ipucundaki "ikisinin arasındaki fark" belirsizliği düzeltildi.
      9-13 yaş oynama (2026-10-02; 9 EN, 10 TR, 11 EN, 12 TR, 13 EN, 50 soru): tek satırlık uzun bölme zinciri (216 ÷ 12,
      195 ÷ 15) onluk+birlik parçalarına açılır (`expandHardDivision`, `stepsHelp` içinde; tam bölünen, bölüm ≥ 10, bölen ≥ 11);
      "N'in 1/d'si" ipucu 12'ye kadar çarpım tablosuna bağlanır; Türkçe olasılık sorusu cümle başında küçük harfle ve
      bozuk ("mavi birini çekme") çıkıyordu; katı cisim "üstteki yüz = 4" çoğul; "7'nin çarpım tablosu" eki. 11-13 yaşta tek
      satırda karışık işlem (a + b × c) bilinçli bırakıldı.
      Eksik çarpan sorusu ("8 × ? = 80", çarpan ≥ 6): ipucu ve yardım "bildiğin bir işlemle başla (5 × 8 = 40), kalan kaç tane daha" zinciri
      (80 noktalı doldurma yardımı ve "10'la çarparken sıfır ekle" yok; ×10/×100 sorularında zaten "rakamlar sola kayar" dili var,
      ondalıkta çöken "sıfır ekle" kuralı kullanılmıyor). Sürahi ipucu: su ilk numaranın altındaysa "alttan 0'dan başla" (olmayan
      "hemen alttaki numaralı çizgi"ye yönlendirmiyor).
      "Çık" (yarım oturumdan çıkma) artık yarım oturum kaydını siler: sayfa açıklaması "cevapların kaydedilmeyecek" diyordu ama kayıt kalıyor ve matematiğe her girişte aynı soru geri geliyordu. Yenileme/kazara çıkış için kayıt hâlâ 2 saat saklanır. Ana oturum kaydı ağ koparsa yeniden gönderilemez (idempotency anahtarı yok, çift ödeme olur) — açık iş. Matematikte soruyu tarayıcı
      üretir, sunucu `correct` bayrağına güvenir (ana oturum da): bilinen sınır, pekiştirme payı günde ≤3×5×yarım pay.
      Eski kural: ilk turda ödenmeyenin yarısı geri kazanılır (hata 0,5 / iki-yanlış 0,25 soru payı;
      pekiştirmede yardımla bulmak yarıya iner), toplam asla 1'i geçmez, günlük sınır dolduysa 0; ledger
      sebebi `math_review` (günlük matematik sayacına girmez). Seviyeyi/ilk skoru etkilemez, pekiştirme
      cevapları `math_attempts`'e değil `math_reviews.result`'a yazılır (merdiven son oturumu yanlış okumasın).
      **Ebeveyn mesajı tek:** ilk tur mesajı teklif varsa bekler; pekiştirme bitince, "Şimdi değil"de ya da
      30 dk sonra (başlatıldıysa başlatmadan 30 dk; `expireMathReviews`, 2 dk'da bir) tek mesajla gider.
      Yapılmayan/yarıda kalan pekiştirmede kalan beceriler `carry_topics` olur ve bir sonraki oturumda
      `math-plan.review_topic_ids` ile planın başına ağırlık alır (bir kez, 7 gün).
      Doğrulama: sahte API ile gerçek MathScreen'de 9 yaş TR: kabul + 3/3 + gem payı, "Şimdi değil", hepsi
      doğru (teklif yok), yenileyince pekiştirmenin sürmesi, telefon ve geniş ekran. **Açık:** gerçek
      Supabase/Railway ile uçtan uca denenmedi (migration bekliyor); kağıt modunda yok; sonuç ekranı
      yenilenirse teklif 25 dk içinde geri gelir (`tuto_math_result_v1`; pekiştirme sonucu sunucuya ulaşmadıysa "Tekrar kaydet" de saklanır, sunucu pekiştirmeyi bir kez öder); konu adları ebeveyn mesajında İngilizce
      müfredat adı.
- [ ] Matematik yardımı 9-12 yaş, içerik hazır, ekrana bağlı değil (2026-09-30, Claude; `claude/math-hint-quality`).
      Yeni araç yok: ekranda hazır olan `stepsHelp` (çocuğun her satırdaki küçük işlemi yazdığı, üstünde
      "neden bu adım" cümlesi olan zincir) 9-12 yaşın sayısal ve seçmeli soru tiplerine yazıldı, EN/TR/ES.
      Audit "öğretici yardım" payı (`npm run math:check`): 9 yaş %38 → 97, 10 %67 → 99, 11 %57 → 99,
      12 %48 → 99 (grafik okuma, koordinat/öteleme, fonksiyon makinesi, karekök, olasılık, cebir şıkları,
      katı cisimler, Roma rakamı, dört nokta adı dahil); **13 yaş (Year 8) %3 → 97** (asal çarpanlar, EBOB/EKOK,
      negatiflerle işlem, kesir dört işlem, yüzde, denklem, açılım/çarpanlara ayırma, dizi/nth terim, doğrular,
      oran, Pisagor, daire, hacim/yüzey, istatistik/olasılık; negatif ara sonuçlar eksi tuşu olmadığı için
      büyüklük + işaret kodu olarak yazdırılıyor; panelde cevap sınırı 7 → 9 karakter). 7 ve 8 yaş da
      yükseldi (%78/70 → 89/84). Kalite kapısı: `scripts/math-help-audit.mjs` (sızıntı, yazılamayan cevap,
      dil karışması, tür uyuşmazlığı; math:check içinde) ve `scripts/tests/math-help-oracles.test.mjs`
      (etiketli adımlar soru metninden/görselden bağımsız yeniden türetiliyor). Gerçek MathScreen'de 9/10/11/12 yaş
      × TR/ES/EN × telefon/yatay oturumları sahte ağla uçtan uca oynandı.
      **Seçmeli sorular:** `stepsHelp(steps, picture, true)` ("pick"): zincir bir şey hesaplatır, son satır cevap
      değil, kapanış "cevabını seç". Panelde `MathChart` de çiziliyor (ızgara/grafik/pasta resmi).
      **Audit:** her adımın aritmetik satırı kendi cevabına eşit mi kontrol ediliyor (dile göre sayı yazımı:
      "2,144" İspanyolcada iki tam bir kaçtır). Bir belirsizlik yakaladı: kalanlı bölmede "292 ÷ 30 =" 9 istiyordu.
      **Yolda düzeltilenler:** ortanca sorularında %46 ortanca = mod (üreteç tekrarı üç kopya yapıyordu);
      pre-answer 💡 ipucu, cevabı söyleyen adımı atlayınca ortadan adım düşüp yetim cümle kalıyordu (17 + ? = 34).
      **Açık:** yardım 9+ için ekrana bağlı değil (panel yalnız ≤8 yaş, yanlıştan sonra); ölçülmedi: bu zincirlerin
      gerçekten öğrettiği, Ada/Batu'yla denenmedi. Zincirsiz kalan: yer değeri/karşılaştırma gibi birkaç
      küçük şekil ve 13 yaşın tamamı.
      **Bağlandı (aynı gün):** 7+ yaş artık "bir deneme, sonra yardım" (başta 9+ idi; 2026-10-02'de 7-8 de alındı, 5-6 eski): ilk yanlışta soruya dönülür, 💡 titrer,
      seçmelide yanlış kart soluklaşır, sebep gösterilmez; ipucuna bakıp yanlış ya da ikinci yanlış → yardım
      (`helpOpensNow`, `MathScreen.jsx`). ≤6 yaş aynı (hemen yardım). Yeniden deneme de ipucu gibi yarım pay
      (`helpUsedQs`). **Gem artık soru başı** (tam / yarım / yok; `server/mathGems.js`, test
      `scripts/tests/math-gem-share.test.mjs`): eski `0,33 + 0,67 × doğruluk` tabanı ve oturum düzeyi ×0,67 yalnız
      soru kaydı eksikse yedek. Kağıt modu da aynı formülden geçiyor (etkisi ölçülmedi). Sahte ağla gerçek
      MathScreen'de 9 yaş oturumu uçtan uca oynandı; Ada'nın iPad'inde teyit edilmedi. **Yardım kapatma ayarı
      bilerek yok** (kullanıcı kararı): ebeveyn "iyi mi kötü mü" sorusunun cevabı yardımsız/yardımlı/yanlış dökümü.
- [ ] İngilizce çocuk ekranı ve bütün bağlantıları (2026-09-26, Claude). **Migration önce:**
      `server/migrations/2026-09-26_english_sessions.sql` (`english_sessions`, `english_attempts`,
      `children.english_variety`) çalışmadan deploy edilirse kart herkese görünür ama oturum açılmaz,
      ve İngilizce varsayılan olarak Hezarfen'de olduğu için bonus hiç kazanılamaz.
      **Sözleşme bulmacanınki:** soruyu sunucu üretir (motorun birebir kopyası `server/english`,
      `npm run puzzle:sync` iki motoru da kopyalıyor, `english:check` senkronu da denetliyor),
      tarayıcıya yalnız istem + şık metni gider; `correct`, `why`, `rule` cevaptan sonra. Sheet baştan
      saklanıyor (bulmacada sonradan eklenmişti). "Hangi İKİSİ" soruları: cevap bir küme, tamamı
      doğruysa doğru. Yanlış cevapta seçilen şıkkın `why` anahtarı çocuğun dilinde cümleye dönüyor
      (`eng_why_*`, 59 anahtar × 3 dil; aynı sebepli iki şık tek satır).
      **Kararlar (kullanıcı):** herkese açık (ebeveyn kapatabilir); İngiliz/Amerikan çocuk başına,
      boşsa ailenin saat dilimi ABD ise Amerikan, değilse İngiliz — Görev Ayarları'nda ve sohbette
      (`update_task_reward` task_type english + `variety`); kart adı "English / İngilizce";
      Hezarfen'e dahil ama ebeveyn hangi etkinliklerin sayılacağını seçiyor (`task_settings.bonus.types`,
      en az iki; Görev Ayarları'nda çipler, sohbette `bonus_types`).
      **Bağlananlar:** ChildHome kartı + ikon (üç yaş görünümü), `/child/english`, gem geçmişinden ve
      ebeveyn çocuk sayfasından oturumu yeniden açma, Bugün özeti/haftalık grafik, ebeveyn panosu,
      ebeveyn bildirimi (sınıra takılan dahil), sohbet bağlamı (`englishSessions`, `englishSkills`,
      `englishVariety`), 30 gem / günde 3. Onboarding'e eklenmedi (bulmaca da orada yok).
      Doğrulama: build, english:check (senkron dahil), i18n:check değişmedi (41), font:check;
      gerçek motorla taklit API'ye karşı tarayıcıda 390px ve 1180px: 8-9 ve 7-8 oturumları uçtan uca,
      iki cevaplı soru, yanlış cevap açıklaması, sonuç listesi, ana ekran kartı, Görev Ayarları'nda
      UK/US ve Hezarfen çipleri (yazılan JSON doğrulandı). Gerçek Supabase/Railway ile denenmedi.
      **İçerik bulgusu (motor):** 8-9 `odd-two` "seafood, yogurt, pup, butter, lamb" — cevap
      pup+lamb ama lamb aynı zamanda yiyecek; kategori çakışması taraması `lamb`/`chicken` gibi
      hem hayvan hem yiyecek kelimeleri görmüyor.

- [x] "Count up from 198 to 604" ipuçları ve 8 yaş Carroll (2026-09-26, Claude; kullanıcı bulgusu).
      **İpucu:** eksik toplanan, eksik çıkan, "kaç kişi yemeksiz" ve çıkarma hikâyesi "198'den
      604'e say" diyordu — 406 tane birer birer saymak yöntem değil. Hint ile yardım paneli aynı
      `hint_steps`'i okuduğu için ikisi de böyleydi. Artık `gapSteps(from, to)` sayıdan seçiyor:
      yuvarlağa ≤3 yakınsa ve yuvarlaktan çıkarma onluk bozmuyorsa **yuvarla-düzelt** ("198,
      200'den 2 eksik; önce 604'ten 200 çıkar, sonra 2 geri ekle"), değilse **yuvarlak sayılara
      zıplama** ("198 → 200 → 600 → 604; zıplamaları topla" — duraklar var, zıplama büyüklüğü ve
      toplam yok), 100'ün altında 10'dan küçük farkta parmakla sayma. Para üstü ipucu ("verilen
      paraya kadar say") bırakıldı: hedef zaten yuvarlak.
      **Carroll/Venn:** 8 yaşa "81 3'ün katı mı?" soruluyordu (27 × 3, tabloda yok). Her sayı —
      yanlış şıklar dahil — etiketteki çarpım tablosunun içinde kalıyor (≤ 12 × k). Carroll'ın
      "Others" satır/sütunu kitaptaki gibi "Not even / Not multiples of 3" (TR "Çift olmayanlar",
      ES "No pares"); uzun etiket iki satıra bölünüyor, 3 dilde 358px'te sığıyor.
      Doğrulama: math:check 65/65 bulgu yok.

- [x] NVR kod sorusunda çizimle çelişen etiket + küpte kare/eşkenar dörtgen (2026-09-26, Claude).
      Kör çözümde (47/47) bulundu, iki denetimin de göremediği şeyler. **(1) Kod:** eksenlerin
      değerleri yalnız taban figürde görünür mü diye bakılıyordu; öbür eksen şekli üçgene
      çevirince yarım dolgu çizilmiyor (`HALF_SHAPES`'te üçgen yok), sayfa düz bir üçgene "Y"
      (yarısı siyah) diyordu. Aynı sınıf: üçgende iç şekil/esnetme, çemberde dolgu. Ölçüm,
      etiketi ÇİZİMDEN okuyarak: canlıdaki 9-10 kod sorularının 769/1500'ü, 10-11 ve 11-12'nin
      526/1500'ü çizimle çelişiyor ya da cevabın değeri hiç etiketlenmemiş → düzeltmeden sonra
      0/1500. Üreteç artık 3×3 kombinasyonun dokuzunu da çizip soruyor (kodlanan değer
      `normalizeSpec`'ten sağ çıkıyor mu, tek harf farklı her çift ayrı resim mi);
      `validateQuestion` çalışma anında aynısını reddediyor; `puzzle-audit` değerleri spec'ten
      değil çizimden okuyor (eski hâli bu yüzden geçiyordu). **(2) Küp:** izometrik yüzde
      kare eşkenar dörtgene, eşkenar dörtgen yassı dikdörtgene dönüşüyor — üst yüzdeki kare
      açınımda olmayan "siyah eşkenar dörtgen" okunuyordu. Küpte eşkenar dörtgen yok, yerine
      zar yüzü (dört nokta). Kural: küp sembolü izdüşümde kimliğini korumalı; 45° dönmüş hâli
      başka bir sembol olan şekil (kare/eşkenar dörtgen, +/×) aynı küpte olamaz.
      Not: soru seed'den yeniden üretildiği için yayın anında yarım kalan kod/küp oturumlarının
      cevap kontrolü yeni soruya göre yapılır.

- [x] NVR 6-7 ve 11-12 kaynak bantları (2026-09-26, Codex).
      Kullanıcının Schofield & Sims Rapid Tests 1 (6-7) ve Bond Assessment Papers
      11+-12+ Book 1/2 kaynaklarından 36 sayfa görsel örnekleme; tam kitap kapsamı iddiası yok.
      **Yeni:** `puzzleSpatial.js` — şekil içinde parça, üst üste birleştirme, çok parçalı
      dönme+dolguyu tersleme analojisi, çok parçalı ayna, 3×3 matris, küp açınımı
      (oluşabilir/oluşamaz; üç açınım, altı farklı yönsüz simge). 6-7 beş şık ve tek
      değişimli kurallar; 11-12 tamamen geometrik. Sunucu kopyası sync listesinde.
      **Yaşın tek kaynağı:** sunucu artık ortak `bandForAge`'i kullanır. Canlıdaki yaklaşım
      korunur: 5→5-6, 6→6-7, 7→7-8, 8→8-9, 9→9-10, 10→10-11, 11+→11-12.
      EN/TR/ES yönerge ve açıklama; aynı PuzzleView ile lab/çocuk ekranı. DB değişikliği yok.
      Bağımsız uzamsal cevap denetçisi; 6-7/11-12 motor taramaları, 1.200 yeni soru ve
      yanlış anahtar mutasyonları geçti. Çocuk ekranı taklit API ile WebKit telefon/iPad
      boyutlarında 3 dil × 6 tip, sonuç dahil; canlı DB'ye erişilmedi.
      Ek test: 30.000 taze soru + 120.000 yanlış anahtar mutasyonu, 1.000 tam ve
      tekrar üretilebilir oturum geçti. Görsel kör örnekleme 11/12; kaçırılan ayna
      sorusunda anahtar çizimden yeniden doğrulandı. 667×375 yatay WebKit'te yanlış
      cevap açıklamasının altı erişilemezdi; PuzzleScreen geri bildirim katmanı artık
      uzun içerikte kayar. 320×568/667×375 × 3 dil × 6 tür ve doğru cevap akışı geçti.
      Betikler: `scripts/puzzle-spatial-stress.mjs`, `scripts/puzzle-ui-check.mjs`.
      Kullanıcı 2026-09-26 tarihinde İngilizce düzeltmeleriyle birlikte main üzerinden
      Vercel/Railway yayınına onay verdi.
      **Claude incelemesi sonrası:** küpte ortak yanlış determinant varsayımı düzeltildi
      (-1); önceki yüksek test sayıları fiziksel kiralite kanıtı değildi. Sabit artı
      açınımda [0,2,3] geçerli, [0,3,2] geçersiz testi motoru ve oracle'ı kilitler.
      11-12, 10-11'in tüm dokuz tipini korur + beş yeni tip. 6-7'ye glyph-analogy
      eklendi; geometrik/ikon/emoji ağırlığı 4/2/4 (ürün tercihi, kitap sayımı değil).
      **Sınırlar ve kanıt:** `NVR_AGE_BANDS_2026-09-26.md`. Gizli kontur/serbest çizgi,
      yatay-eğik ayna, yönlü/tekrarlı küp yüzleri, küpten açınım seçme hâlâ yok;
      `BOOK_COVERAGE` bunları açıkça tutar. Mevcut diğer bantların ayarları değiştirilmedi.


- [x] Taslaktan tamamlanan hikâye (2026-09-25, Claude). "Hikâye yazıldı" ile "hikâye satırı
      oluştu" karıştırılıyordu. Ebeveyn bildirimi yalnız INSERT'te gidiyordu: yarım taslak
      kaydedilince ebeveyne yarım hikâye "yazdı!" diye gidiyor, taslak sonra tamamlanınca hiçbir
      şey gitmiyordu. Artık bildirim `firstCompletion`'da (gem'le aynı an), metin kaydedilen
      satırdan. Günlük etkinlikler hikâyeyi `created_at` ile sayıyordu (taslağın başladığı gün);
      artık `completed_at` (migration `2026-09-25_story_completed_at.sql`, sütun yoksa eski
      okumaya düşer). Ebeveynin "Bugün tamamlananlar"ı zaten ledger'dan geliyor, etkilenmedi.
- [x] 13 yaş: Year 8 kuruldu, merdivenin gerçek son basamağı (2026-09-25, Claude). Kaynak *Bond Maths
      Assessment Papers 12+-13+* (20 kâğıt × 50 soru baştan sona okundu; not dökümü scratchpad'de
      `NOTES-bond-1213.md`). Önceden 12 ve 13 yaş aynı Year 7 listesini alıyordu; artık 12 → Year 7
      (11+-12+ kitabı), 13+ → Year 8. **Seviye kadranı 15'te bitiyor** (sunucu 15'in üstüne çıkarmıyor)
      ve Year 7 zaten 13-14'te, o yüzden Year 8 15'e oturuyor ve **her konusu kendi şablonunda**
      (`powers-primes`, `negatives-decimals`, `fdp`, `algebra-8`, `sequences-graphs`, `ratio-8`,
      `geometry-8`, `stats-8`) — içeriği bant değil konu seçiyor.
      **Kitabın biçimleri:** asal çarpanlar üslü (şıkta "4 × 3 × 25" gibi asal olmayan gruplama),
      EBOB/EKOK büyük sayılarla, iç içe parantez; negatiflerle dört işlem (cevap negatifse şıklı),
      ondalık yuvarlama, 10/100/1000; `<`, `>`, `=` işareti; tam sayılı kesirlerle dört işlem (en sade),
      kesirli yüzde (%17½), indirim yüzdesi, ters yüzde, KOY sıralama, ondalıktan kesire; parantez açma
      ve sadeleştirme, çarpanlara ayırma ("tamamen" — eksik çarpan eşit değerli ama yanlış şık, açıklamasıyla),
      iki parantez çarpımı, iki taraflı denklem, iki bilinmeyenli denklem, yerine koyma, alanları eşit
      iki dikdörtgenden x; n. terim (her yanlış şık hangi terimde tutmadığını söylüyor), 100. terim,
      doğrusal olmayan diziler, değer tablosu, doğruyu denklemine eşleme, iki doğrunun kesişimi;
      3-4 parçalı oran, denk oran, ters orantı, mil↔km / cm²↔m² / zaman birimleri, ortalama hız,
      dişli çarklar, ölçek çarpanının alana etkisi; prizma hacmi/yüzey alanı/yükseklik, paralel doğrularda
      açılar (iç ters, yöndeş, karşı durumlu), π = 3,14 ile çevre/alan/yarıçap, Pisagor, düzgün çokgen
      iç/dış açısı, bahçe yolları, orijinden büyütme; ortanca/ortalama/açıklık, sıklık tablosundan
      ortalama, iki grubun birleşik ortalaması, iki zar (1/11 çeldiricisi), deste, torbadan çıkarma,
      gruplama, serpilme grafiğinde ilişki. **Yeni görseller:** dişli çark, ölçülü prizma, daire, dik
      üçgen, bahçe planı, serpilme, paralel doğrular, koordinat düzleminde doğrular, cebirsel dikdörtgenler.
      **Türkçe ek hatası kapandı:** sayıdan sonraki ek sabit yazılıyordu ("11'nin", "%20'ini");
      `trEk(sayı, hâl)` sayının okunuşunun son kelimesine bakıyor (11'in, %20'sini, 4'e, 60'tan, 17½'si)
      ve 11-12 ile 13 bloklarındaki bütün sayı ekleri ondan geçiyor. (Eski bloklarda aynı sabit ek
      kalıbı hâlâ var, taranmadı.)
      Bırakılanlar: grafik/pasta çizdirme, açıölçer ve cetvelle ölçme, yansıtma, karar ağacı, kerteriz
      (ölçme gerektiriyor), cümle yazdırma.
      Ölçüm (1500 oturum, 13 yaş): 58 farklı soru biçimi, görselli soru 3,1/oturum, 10 görsel türü.
      Doğrulama: math:check 10 yaş (5-14) × 3 dil × 2000 soru/konu bulgu yok (65/65 konu şablonlu),
      her yeni görsel için cevabı çizimden yeniden hesaplayan kontrol; build, font:check, i18n:check
      değişmedi (38); 18 görsel EN + 8 TR 390px'te; gerçek MathScreen'de 13 yaş oturumu uçtan uca.
- [x] 11-12 yaş görselleri — merdivenin son basamağı (2026-09-25, Claude). Kaynak *Bond 10 Minute
      Tests Maths 11+-12+* (30 test baştan sona okundu; not dökümü scratchpad'de `NOTES-bond-1112.md`).
      Year 7 zaten bu kitabın METNİNDEN yazılmıştı (karekök, oran sadeleştirme, iki taraflı denklem,
      hız-zaman); eksik olan kitabın resimli yarısıydı. **Yeni (band ≥6, yani 11 ve 12-13 yaş):**
      dört bölgeli koordinat (`plane`: dikdörtgen/kare/paralelkenarın 4. köşesi, noktaları birleştirip
      en doğru ad — şıklarda doğru cevabın üst sınıfı yok, kare hiç cevap değil; üçgeni öteleme, sorulan
      köşe bir ekseni geçiyor), noktalardan kural (`y = 2x − 1`; her yanlış kural çizilen bir noktada
      tutmuyor ve hangisinde olduğunu söylüyor), açı çizimleri (`angles`: dış açı, dış açıdan iç açı,
      eşit işaretli ikizkenar, ters açılar, doğru üstünde iki eşit açı — gerçek açılarla çizili),
      bileşik şekil (`compound`: L-şekli iki kenarı yazılmadan, köşesi kesilmiş taralı dikdörtgen; ölçü
      çizgileriyle), dörtyüzlü/sekizyüzlü/beşgen ve altıgen prizma (yüz/ayrıt/köşe + ad), fonksiyon
      makinesi çizimi ve boş kutu (iki giriş-iki çıkış: tek çiftle "× 3" ve "+ 14" ikisi de doğru olurdu),
      sayı haçı (`numcross`: önce sütundan b, sonra satırdan a), zar sonuç tablosu, üçgensel/kare sayı
      noktaları, sıfırın altına ve ondalığa uzanan sayı doğrusu (negatif cevap şıklı — klavyede eksi yok).
      Yansıma/dönme yok (NVR'da var), çizdiren/cümle yazdıran sorular yok.
      **Ölçüm (1500 oturum):** görselli soru/oturum 12 yaş 3,0 → 4,3, 11 yaş 3,7 → 4,4; görsel türü 5 → 13.
      `math:check`'e her yeni görsel için cevabı çizimden bağımsız yeniden hesaplayan kontrol eklendi
      (dörtgen noktalardan sınıflandırılıyor; yanlış şıkkın da doğru olması ayrıca aranıyor); kasıtlı
      bozulan dört cevapla kontrollerin yakaladığı doğrulandı. Doğrulama: math:check 3 dil × 2000
      soru/konu bulgu yok, build, font:check, i18n:check değişmedi (38); 24 görsel EN + TR/ES 390px'te,
      12 yaş gerçek MathScreen oturumu uçtan uca, sonuç ekranında görseller.
- [x] Pasta grafiği, açınım, Venn/Carroll ve sonuç ekranında görseller (2026-09-25, Claude).
      Kitaplarla görsel karşılaştırmasında açık kalan üçü: **pasta grafiği** (Year 6 müfredat satırı
      "pie charts" ile açılıyor ama 11 yaş istatistiği yalnız ortalama soruyordu; artık `averages`
      slotlarının ~%35'i, dilimler 1/2-1/8, 1/3, 1/6, 1/5 — kaç kişi / hangi kesir / kaç fazla),
      **açınım** (10-11 kitabında 13 kez; küp, dikdörtgenler prizması, üçgen prizma, kare piramit,
      silindir, koni; çeldiriciler önce yakın komşu: küp↔prizma, piramit↔prizma, silindir↔koni;
      8-9 yaş geometrisi + 10+ geometrinin %15'i), **Venn/Carroll** (7-9 yaş veri: "boyalı bölgeye
      hangi sayı girer?", her yanlış şık hangi etikete uymadığını söyler; sınır sayı "50'den büyük"
      için 50 cevap olmaz, ipucu onu yazıyor). Sonuç ekranı ("Cevapların") artık her sorunun
      görselini gösteriyor — grafik sorusu sonda grafiksiz okunamıyordu. Doğrulama: math:check 3 dil
      × 2000 soru/konu bulgu yok, 12 yeni görsel TR/EN tarayıcıda, gerçek MathScreen'de 9 yaş
      oturumu uçtan uca çözülüp sonuç ekranı görselleriyle görüldü.
      **Hâlâ yok:** yansıma/öteleme, harita ölçeği, çarkla olasılık, 4 bölgeli koordinat, dönüşüm
      grafiği; çizim/işaretleme gerektiren sorular.
      **Aynı gün ikinci tur, kolay görseller:** harita üstünde ızgara referansı + pusula (8 yaş),
      kasabalar arası yol haritası (7-8 yaş toplama/çıkarma; etiketler zikzağın cebinde, her yol
      farklı uzunlukta — eşit yollarda seçim döngüsü sonsuzdu), çarkla olasılık (11+ olasılık
      sorularının yarısı), harita ölçeği (oran slotunun %20'si), öteleme (10+ geometri, şıklar
      ızgara içinde), yarım sembollü piktogram (band ≥3, sembol 2/4/5/10). **Yansıma ve dönme
      bilerek yok** — NVR bulmacaları onları zaten soruyor (kullanıcı kararı). Doğrulama: math:check
      (1500 soru/konu) bulgu yok, build, 7 görsel TR/EN/ES 390px'te tarayıcıda.
      **Hâlâ yok:** 4 bölgeli koordinat, dönüşüm grafiği, açıölçer, takvim; çizim/işaretleme.

- [x] 7-9 yaş Bond biçimine geçti, görsellerle (2026-09-24 gece, Claude). Kaynak *Bond Assessment
      Papers Maths 7-8* (22 kâğıt) ve *Bond 10 Minute Tests Maths 8-9* (28 test), ikisi de baştan
      sona okundu; not dökümü oturumun scratchpad'inde (`NOTES-bond-young.md`), kitaplar repoda yok.
      **Ölçüm önce:** Year 2-4'te toplama, çıkarma ve bölme konu başına TEK biçimdi (`68 + 25 = ?`),
      çarpma üç (aynı cümle, isim değişiyor); oturum başına ~2,2 çıplak işlem, 7 yaşta 0 şıklı soru.
      Kitapların sorduğu biçimlerin çoğu hiç yoktu: eksik sayı/işaret, iki adımlı hikâye, kalanı
      yuvarlama (7-8 kitabı Paper 15), ölçek okuma, taralı kesir, koordinat (Year 4 müfredatında
      yazılı ama sorusu yoktu), simetri, dik açı, 3B cisim, çetele, fiyat listesi, süre/tarife.
      **Yeni:** `components/MathFigure.jsx` — cetvel (kalem sıfırdan), ölçü kabı, termometre, tartı,
      sayı doğrusu (yalnız uçlar etiketli), taralı şekil (şerit/ızgara/daire), koordinat ızgarası,
      3B cisimler (gizli ayrıtlar kesikli), çetele, çokgenler (ipucunda simetri eksenleri/dik açı
      işaretleri, 3 denemeden sonra), fiyat etiketleri, dijital saat. Şablonlarda bir "young"
      bölümü: her konu düz biçimini bir pay olarak tutuyor, gerisi kitabın biçimleri — işaret
      sorusunun cevabı konunun kendi işareti (çıkarma slotunda cevap ÷ çıkmıyor). Kâğıt modu
      eskiden hiç görsel basmıyordu (saat, grafik, ızgara soruları kâğıtta resimsizdi) — artık
      `QuestionPicture` basıyor; yardım paneli de soruyu değiştirdiği için görseli kendisi çiziyor.
      **Yan düzeltmeler:** grafik soruları ay etiketini gün gibi okuyordu ("Eki günü Ara gününden"),
      İspanyolca "¿Cuántos personas", Türkçe cümle başı küçük harf; "4'şer" dağıtma eki (`trDist`);
      8 yaşa "Bir elma 418 kuruş" çıkaran para üstü şekli ölçüden alındı (dükkân listesi geçti).
      **Sonra:** çıplak işlem 2,2 → 0,67/oturum; şıklı soru 7 yaşta 0 → 1,4; biçim sayısı konu
      başına 1-3 → 7-30 (bölme 7 yaşta 2). `math:check` üç yeni kontrol: resimden söz eden soru
      görselsiz olamaz (cismin adı sorusu bir gün resimsiz çıkmıştı), ölçek okuması = cevap, taralı
      parça sayısı = cevap. Doğrulama: math:check 3 dil × 2000 soru/konu bulgu yok, Vite build,
      font:check, i18n:check değişmedi (38); 17 görsel × 3 dil 390px'te tarayıcıda, yardım paneli
      görselle; 7/8/9 yaş × 4 oturum EN + 2 oturum TR elle okundu.
      **Kapsam dışı kalanlar:** Venn/Carroll diyagramı, yarım sembollü piktogram, çizim/işaretleme
      gerektiren sorular ("saate akrebi çiz", "C noktasını işaretle", "şeklin 6/9'unu boya"),
      Roma rakamı 100'ün üstü. Gerçek MathScreen oturumu (Supabase'li) tarayıcıda görülmedi — lab'da
      ve derlemede doğrulandı.

- [x] 10-11 yaş dört işlem Bond biçimine geçti (2026-09-24, Claude). Kaynak *Bond Maths 10 Minute
      Tests 10-11* (yaklaşık 200 soru okundu; taramada 18, 22, 23. testler eksik). Kitapta çıplak
      "a + b = ?" **hiç yok**; toplama/çıkarma hep bağlam içinde ve çoğu iki adımlı, büyük sayı
      doğal olarak büyük olan şeyde ("52 kişilik otobüs × 12", "2800 taraftar, 53 koltuk"), bölmenin
      yarısı kalanı yorumlatıyor. Bizde ise 10 yaş oturumunda ~1,3 çıplak `8.412 + 5.400` vardı,
      çıkarma hiç yoktu; "93 sepet × 8 düğme" gibi sorular çıkıyordu, bölmede kalan yoktu.
      **Değişenler:** `y5_addition` → yeni `add-sub-word` (anket kalanı, otobüs iniş-biniş, kalan
      MB, yemek yetmedi, yıllar arası, para kalanı; eklenen/çıkarılan sayı ekranda en fazla iki
      sıfırdan farklı basamak, kağıtta serbest). `multiplication-word`/`division-word` band ≥5'te
      bağlam kendi sayı aralığını taşıyor (Y5 iki basamak × bir, Y6 iki × iki); bölmede dört mod:
      tam, yukarı yuvarla (kaç otobüs gerekir), aşağı yuvarla (kaç tam parça), kalan. Year 5
      istatistiğe iki yönlü tablo (`MathChart` `shape: 'table'`, bir hücre "?"), chart sorularının
      ~%35'i. **Ondalık virgülü:** TR/ES'de `num()` binlikte nokta kullanırken ondalık da noktayla
      basılıyordu (aynı oturumda `8.412` sekiz bin, `8.312` sekiz virgül); `dnum()` okunan metni
      virgülle basıyor, şık değerleri ve cevaplar noktalı kalıyor, ekran çizerken yerelleştiriyor,
      klavye tuşu TR/ES'de "," gösteriyor ama "." yazıyor. `math:check` iki yeni kontrol: dile uymayan
      ondalık işareti ve tablo görseli ile cevap anahtarının tutarlılığı.
      Ölçüm (2000 oturum): 10 yaş çıplak 4 basamaklı toplama 1,3 → 0; kalanlı bölme ~1,0/oturum;
      tablo ~0,4/oturum. Doğrulama: math:check (1000 soru/konu, bulgu yok), Vite build, font:check,
      i18n:check değişmedi; tablo TR/EN/ES'de 390px ve 1024px tarayıcıda, TR ondalık şıklar.
      **Açık:** gerçek MathScreen oturumunda (Supabase'li) klavye tuşu görülmedi, yalnız lab.

- [x] My Drawings görsel yükleme performansı (2026-09-23, Codex; yerelde).
      6-8 kataloğu 40 kart için toplam 18,4 MB tam boy son-adım görseline bakıyordu;
      `loading="lazy"` yalnız ekran dışındakileri erteliyor, görünür ilk sıra yine yüzlerce KB
      ile birkaç MB arasındaki dosyaları indiriyordu. Üstelik 257 yerel `.webp` dosyasının
      68'i gerçekte PNG baytı; en büyüğü 2,9 MB ve canlı Storage başlıkları `no-cache`.
      Katalog artık Supabase'in 320×320 gerçek WebP türevini, çizim adımları 1024×1024
      türevini kullanıyor. Ölçülen ağır örnek: katalogda 2,9 MB → 35 KB, adımda
      2,9 MB → 237 KB. Hazırlık ekranı ilk iki adımı da önceden ısıtıyor; ağır `Master`
      setinde Hazırım → adım 1 ve adım 1 → 2 geçişleri tarayıcıda boş çerçevesiz açıldı.
      Vite build geçti. Kaynak dosyaları gerçek WebP'ye dönüştürüp Storage'a tekrar yüklemek
      hâlâ iyi bir temizlik işi, fakat ekranın performansı artık onu beklemiyor.

- [x] 8 yaş ve altı yanlış şık yardımı (2026-09-23, Codex; yerelde).
      Sayı yazılan sorular yanlışta öğretici yardım ve yeniden deneme açarken çoktan seçmeli
      sorular ilk yanlışta doğru cevabı gösterip ilerliyordu. Şıklı sorular da artık aynı yaş
      kuralına uyuyor: seçilen şıkkın neden yanlış olduğu ilk ipucu, ardından sorunun kademeli
      ipuçları geliyor; çocuk yeniden deneyebiliyor veya yardımdan sonra soruyu yanlış olarak
      geçebiliyor. Yardım kullanımı Gem indirimine dahil. 9 yaş ve üstündeki tek deneme akışı
      değişmedi. Doğrulama: math:check 57/57, Vite build; tarayıcıda `1/6` yanlış seçildi,
      şık özelindeki açıklama gösterildi, yeniden denemede `1/3` doğru kabul edildi.

- [x] Izgara çevresi sorusu ve yaş değişimi güvenliği (2026-09-23, Codex; yerelde).
      Dolambaçlı “How far is it all the way round…” metni, çocuğa eylemi de söyleyen
      “Count the 1 cm sides around the outside… What is its perimeter?” oldu (TR/ES de
      aynı açıklıkta). Ekran modu cevap anahtarını artık render edilen aynı dolu karelerden
      yeniden hesaplıyor; görsel/anahtar ayrışamaz. `math:check` de her area-grid sorusunda
      alanı/çevreyi görsel hücrelerden bağımsız yeniden ölçüyor. Aynı çocuğun yaşı değişirse
      eski okul yılına ait sessionStorage oturumu artık geri yüklenmiyor; snapshot yaş taşır.
      Doğrulama: 9 yaş × 3 dil × 400 soru/konu tam motor denetimi (57/57), Vite build ve
      tarayıcıda iki çevre metni ile ızgara çizimi.

- [x] 10 yaş ondalık/yüzde sorularını motora taşıma (2026-09-23, Codex; yerelde).
      `y5_decimals` → `decimals-percentages`: yüzde↔ondalık, kesir↔ondalık (eksik pay),
      üç basamağa kadar ondalık toplama/çıkarma, karşılaştırma ve yuvarlama; EN/TR/ES.
      Hesaplar tam sayı birimlerinde yapılır. Cevap formatı `decimal`, ekranın nokta
      tuşunu açar. Year 5 artık 8/8 şablon: yeni 10 yaş seanslarının soru üretiminde
      LLM çağrısı yok. Kağıt fotoğrafını okuyan değerlendirme LLM'i değişmedi.
      Doğrulama: `node --test scripts/tests/decimal-templates.test.mjs` (seed 230923,
      7.200 soru ve 200 seans planı), math:check, Vite build; lab'da 3.4+1.1=4.5 kabul edildi.

- [x] Matematik geometri çizimleri (2026-09-23, Codex; yerelde, push yok).
      `MathGeometry` SVG bileşeni ekran modu ve math-lab'da motorun `visual` verisini çizer;
      soru metninden şekil tahmini yapmaz. Doğru/tam tur/üçgen/dörtgen açıları, dikdörtgen
      alan-çevre-bilinmeyen kenar, üçgen alanı; üst bantta ters açı/düzgün çokgen/paralelkenar.
      Bilinmeyen etiket `?`; bilinmeyen kenarın uzunluğu görsel verisine konmaz. Çizimler
      şematik, üç dilde ölçekli olmadıkları belirtilir. Çevre ipucunda karşı kenarlar
      etiketlenir ve sınır vurgulanır; alan yardımında iç yüzey vurgulanır.
      Kapsam: yeni üretilen soruların ekran modu; eski kayıtlar ve kağıt modu değişmedi.
      Doğrulama: 6.000 soruda görsel verisi/cevap tutarlılığı, math:check, Vite build,
      font:check; tarayıcıda üçgen alanı, dörtgen açıları, bilinmeyen kenar, çevre yardımı
      ve doğru açısı görsel kontrolü.

- [x] Matematik sayı yazımı (2026-09-23, Codex): `num()` binlik ayırıcıyı 1.000’den
      itibaren kullanır; `11,711 + 5000` artık `11,711 + 5,000`. EN virgül, TR/ES nokta;
      ara işlem ipuçları da aynı biçimde. Toplama/çıkarma yardımındaki "yalnız o basamak
      değişir" genellemesi kaldırıldı: elde/ödünç almada üst basamaklar da değişebilir.
      Doğrulama: math:check ve Vite build.

- [x] Ekran kontrolü web denemesi (2026-09-20, Codex). Ebeveyn Ayarlar sayfasının EN ALTINDA,
      çocukta Ayarlar → Ekran Kontrolü. Mevcut Tuto Care / yaşa göre çocuk stili korunur.
      Kurallar çocuk bazında `parents.prefs.screen_control_web[childId]` içinde; mevcut Supabase
      ebeveyn oturumu ve RLS ile kaydedilir, migration gerekmez. JSON prefs kaydı güncel değeri
      okuyup compare-and-swap yapar; dashboard da aynı yardımcıyı kullanır.
      **Deneme sınırı:** cihaz uygulaması tespit/engelleme yok; 100 örnek Gem, gerçek bt_ledger'a
      yazma yok. Çocuk talepleri ve ebeveyn onayı yalnız AYNI TARAYICIDAKİ localStorage denemesinde
      paylaşılır; cihazlar arası senkronizasyon değildir. Kurallar hesapta saklanır, o cihazdaki
      çocuk denemesi ebeveyn ekranı yüklenince/kaydedilince önbelleğe alınır. Native öncesi bu
      veriyi gerçek kullanım/koruma diye sunma. Çocuk ekranında ebeveyn kontrolleri bulunmaz.
      Hafta içi/sonu bütçesi, günlük tavan, Gem oranı/ek süre tavanı, uyku/okul saati, örnek uygulama
      izinleri; görünür denemede sayaç ve hızlandırılmış dakika. Eğitim uygulaması bütçe tüketmez.
      Ekran/sekme kapanınca simülasyon saati ilerlemez. Gece yarısı günlük bütçe yenilenir.
      Doğrulama: `node --test src/lib/__tests__/screenControl.test.js`, Vite build, font:check;
      i18n:check mevcut 37 bulguda, yeni bulgu yok. Native Android uygulaması ayrı sonraki iş.

- [x] Fotoğraf yüklenen her yere kırpma adımı (2026-09-13). Simply Draw'daki "Edit image"
      ekranından geldi. Sekiz ekrandaki **on iki fotoğraf girişinin hepsi** artık
      `components/PhotoCrop.jsx`'ten geçiyor (`usePhotoCrop` ile üç satırda bağlanıyor).
      **Neden sadece süs değil:** üç yol fotoğrafı saklamıyor, **modele okutuyor** — matematik
      kağıt modu, okuma (kapak `identifyCover` + sayfalar), hikâye (el yazısı sayfaları).
      Gemini görseli içeride 768px'lik karoya indiriyor, yani masanın/kolun/karşı sayfanın
      kapladığı her piksel el yazısından çalınmış piksel. İki yol da zaten kırpılıyordu ama
      kırpmayı **CSS yapıyordu**: avatar 52px'lik karede `object-fit: cover` (çocuğun yüzü
      ortada değilse kesiliyordu), hikâye kapağı kitabın sabit panelinde aynısı. Bu ikisi
      `ratio` ile şekle kilitli (avatar 1:1, kapak 0.72 — panelin yüksekliği başlık kaç satır
      olduğuna göre oynadığı için birebir değil yakın).
      **Kararlar:** çerçeve fotoğrafın TAMAMI olarak açılıyor (kenardan kırpan varsayılan,
      sıkı çerçevelenmiş bir sayfanın son satırını sessizce keser); `cropToBlob` küçültmüyor ve
      0.95'te kodluyor, çünkü çıkışta zaten `downscale()` var ve iki kayıplı geçiş çocuğun el
      yazısına yapılacak şey değil; kırpılmamış çerçeve orijinali aynen döndürüyor; RETAKE
      aynı tıklamanın içinde açılıyor (iOS dosya seçiciyi yalnız gerçek kullanıcı jestinde
      açar, `setTimeout` o jesti öldürür); ödevde **tek fotoğrafta** kırpma var, çoklu seçimde
      yok (yedi yaşındaki birine on beş fotoğrafı arka arkaya çerçeveletmek hiç sormamaktan
      kötü). Etiketler `translate` propundan: bir bileşen, iki sözlük.
      **Yanında iki eksik kapandı:** avatar ve `uploadStoryCover` `downscale()`'i atlıyordu —
      biri 52px'lik resim için kameranın tam karesini Storage'a, diğeri ham dosyayı base64'le
      (%33 şişerek) POST'a gönderiyordu.
      **Tarayıcıda bulunan üç hata** (hepsi düzeltildi): `<img>`'e `max-height:100%` vermek,
      yüksekliği auto olan sarmalayıcıya karşı hiçbir şeye çözülüyor — yatay iPad'de çerçeve
      ekrandan taşan bir resmin üstündeydi ve her köşe başka yeri kırpıyordu (kutu artık
      ResizeObserver + doğal boyutla ölçülüyor); tutamaklar içeri alınınca köşeye basmak
      "taşı" oluyordu ve tam çerçevede taşımak hiçbir şey yapmıyor (karartma tek box-shadow
      halkası değil dört bant, kutu kırpmıyor); telefonda sağdaki iki tutamak ekran kenarında
      kesiliyordu (fotoğraf artık tutamak payı bırakıyor).
      Doğrulama: 12 serbest kırpma + 9 kilitli oran + çizim akışı uçtan uca (kırpılan çeyrek
      1200×1600 olarak gidiyor) + ödev/ağaç bağlantısı = 26 tarayıcı testi, gerçek pointer
      sürüklemesiyle, yatay iPad ve telefonda.
      **Açık:** kırpmanın Gemini transkripsiyon doğruluğuna etkisi ÖLÇÜLMEDİ — elimde gerçek
      el yazısı fotoğrafı yok. Ada'nın birkaç sayfasıyla kırpılmış/kırpılmamış karşılaştırması
      yapılmalı.

- [x] iPad'de çizim ekranında aşağı kaydıramama (2026-09-13). İki ayrı sebep vardı.
      **(1) Resmin üstünde parmak kaydırmıyor.** iPadOS, bir görselin üstünde başlayıp hareket
      eden dokunuşu kaydırma değil **görseli sürükleme** (sistem drag-and-drop) sayıyor; sayfa
      yerinde kalıyor. Çizim ekranlarında ekranın neredeyse tamamı görsel (adım paneli, çekilen
      fotoğraf, kütüphane küçük resimleri), yani çocuk baktığı yere dokunduğunda hiç
      kaydıramıyor — kenardan hızlı savuran bir yetişkin ise kaydırabiliyor, bu yüzden hata
      "bazen" görünüyor. Düzeltme tek yerde, `src/index.css`'te bir `img` kuralı
      (`-webkit-user-drag: none` + `user-select` + `-webkit-touch-callout`). ReadingFlow ve
      LibraryScreen'de zaten tek tek `draggable={false}` vardı — aynı sorunun daha önce
      görülüp noktasal yamandığının kanıtı; DrawingsScreen hiç almamıştı.
      **(2) Fotoğraf kendi düğmesini ekrandan atıyor.** Upload ekranındaki önizleme
      `width: '100%'` idi; yatay iPad'de sütun 1148px, iPad'in kendi kamerasından gelen 3:4
      dikey fotoğraf **1148×1531** çıkıyordu ve altındaki "Kütüphaneme ekle" düğmesi 700px'lik
      ekranda **1705px** aşağıda kalıyordu (2,5 ekran). Önizleme artık yükseğinden ölçülüyor
      (`max-height: 55dvh`, `max-width: min(100%, 430px)`); ödül ekranındaki fotoğrafta da
      aynısı (40dvh). Ölçüm: dört cihaz şekli × dikey/yatay fotoğraf, düğme her seferinde
      ekranda, kaydırma gereksiz (0px).
      Doğrulama: altı görünüm (browse/ready/steps/upload/reward/library) × dört şekil
      (1194×700, 1194×834, 810×1080, 390×664) tarayıcıda gezildi; hiçbir düğme/görsel
      "ekranın altında ve hiçbir kaydırıcıyla ulaşılamaz" durumda değil.
      **Not:** (1) tarayıcıda kanıtlanamaz (headless Chromium'da iPadOS sürükleme jesti yok);
      ölçülen kısım (2). Ada'nın gerçek iPad'inde teyit edilmeli.
- [x] `i18n:check`'te 113 satırlık kör nokta (2026-09-13). Blok yorum takibi `accept="image/*"`
      içindeki `/*`'ı yorum başlangıcı sayıyordu; sonraki `*/`'a kadar (DrawingsScreen'de 113
      satır — ödül ekranının tamamı ve kütüphanenin yarısı) her şey "yorum" diye atlanıyordu.
      Repoda on tane `accept="image/*"` var, sekiz ekranda. Tarayıcı artık sınırlayıcıları
      string dışında arıyor. Ortaya çıkan 4 gerçek bulgu: DrawingsScreen'de "Great job! 🎉",
      "I sent your drawing to your grown-up to look at.", "Nothing here yet — draw something!",
      MyTree'de "📷 Photo attached".
- [ ] DrawingsScreen çevrilmedi. Yukarıdaki 4 bulgu buzdağının görünen kısmı: ekranda ~20
      sabit İngilizce metin var ("My Drawings", "Draw again", "I drew it!", "Next", "Add photo",
      "See my library", `SKINS[*].readySay`, `statusLabel` metinleri…). Tarayıcı bunların
      çoğunu hâlâ göremiyor, çünkü etiketle aynı satırdaki JSX metnini (`<Title>My Drawings</Title>`)
      atlıyor. Türkçe okuyan bir çocuk bugün bu ekranda İngilizce görüyor. Ayrı bir iş:
      `dr_*` anahtarları zaten var, eksikleri `src/lib/i18n.js`'e eklenip ekran `t()`'ye geçirilecek.
- [x] Matematik seansı bitişindeki bekleme (2026-09-13). "Cevaplarını inceliyorum" ekranı uzun
      sürüyordu; sebep sorgu yavaşlığı değil **sorgu sayısı**: `/api/children/:childId/math-session`
      art arda **11 Supabase gidiş-dönüşü** yapıyordu (focus konusu varsa 18), ve dördü zaten
      elde olan satırı yeniden okuyordu — `children` üç kez (endpoint, `tzForChild`, `math_focus`),
      `parents` iki kez (timezone, sonra prefs). İndeksler doğruydu, düzeltme tamamen tur sayısında:
      tek `children` okuması `math_focus`'u da taşıyor, tek `parents` okuması timezone+prefs'i;
      `previousLevelAccuracy` saf bir karşılaştırmaya indi (`recentAttempts()` ayrıldı) ki sorgusu
      paralel gidebilsin; üç bağımsız okuma (`rewardedToday` + son `math_progress` + son denemeler)
      tek `Promise.all`, üç bağımsız yazma (attempts insert + `clearFocusIfMastered` + `recordGems`)
      bir diğeri. 11 sıralı adım → 5. Ölçüm (sorgu başına 60ms gecikme simülasyonuyla, TTFB):
      702ms → 340ms (focus yok), 849ms → 367ms (focus var).
      İki not: ölçüm **TTFB** olmalı — `.json()` sonrası ölçmek, await edilmeyen ebeveyn
      bildirimini kritik yolda gösteriyor (A/B ile doğrulandı: bildirim engellemiyor). Ve bu
      sayılar yalnız ekran modu için; kağıt modunda Gemini vision çağrısı bunun hepsini gölgede
      bırakır. **Daha büyük bir kazanım duruyor:** gem/level belli olur olmaz cevap dönüp
      attempts insert'i ve focus temizliğini arkaya atmak (~5 tur → 3) — hata semantiğini
      değiştirdiği için uygulanmadı.
- [x] Ebeveyn arayüzü de üç dilli, ve dil seçimi ilk ekranda (2026-09-08). İki parça:
      **(1) Varsayılan artık İngilizce.** `prefs.language` sütun varsayılanı 'tr' idi çünkü ilk
      aile Türk'tü; ikinci aile kaydolduğu an bu bir gerekçe olmaktan çıkıyor. `server/lang.js`
      `DEFAULT_PARENT_LANG = 'en'`, sütun varsayılanı migration'la değişiyor
      (`server/migrations/2026-09-08_parent_language_default.sql`). Migration önce anahtarı
      olmayan satırlara açıkça 'tr' yazıyor: mevcut aileler bugün kodun fallback'i üzerinden
      Türkçe alıyor ve fallback değişince sessizce İngilizceye dönerlerdi.
      **(2) Ebeveyn ekranlarının tamamı çevrildi** — Opening, Login, Signup, Onboarding (10 adım),
      Dashboard, ChildDetail, TaskSettings, FamilySetup, ChildPin ve paylaşılan parentUI.
      ~330 anahtar, ayrı sözlükte: `src/lib/parentI18n.js`. Splash ekranındaki seçici gerçek —
      ilk dokunuşta ekranı değiştiriyor — çünkü ekranların dili cihazda (`tuto_ui_lang`),
      hesap onun üstüne biniyor (bkz. Sabit kararlar).
      Bu iş üç eski hatayı da ortaya çıkardı ve düzeltti: ChildDetail'de çizim/ağaç/ev katkısı
      bölümleri **sadece Türkçe** yazılmıştı (İngilizce bir ekranın ortasında); onboarding oyun
      ödülünü `label.includes('video game')` ile buluyordu (etiket çevrilince 8. adım sessizce
      atlanırdı — artık `kind: 'game'`); FamilySetup'ta kod alanı `minWidth: 0` olmadığı için
      "Bağlan" düğmesi ekrandan taşıyordu (İngilizcede 20px, İspanyolcada 26px).
      `npm run i18n:check` artık iki sözlüğü birden okuyor ve ebeveyn ekranlarını da tarıyor —
      eskiden "parent UI çevrilmedi" diye muaftılar, o Türkçe cümleler öyle kaçmıştı.
      Doğrulama: 9 ekran × 3 dil tarayıcıda render edildi, 390px'te yatay taşma 0, dil sızıntısı
      0, runtime hatası 0. (Sızıntı testinin ilk hâli Türkçeyi kaçırıyordu: JS'te `\b` yalnız
      ASCII sınırı, `\bÇocuklar\b` hiç eşleşmiyor.)
- [x] Üçüncü dil: İspanyolca (2026-09-07; main'e 2026-09-19'da girdi — 13 commit `claude/parent-dashboard-daily-max-setting-mfv4sa`'da PR'sız kalmıştı, bulmaca ve ödev sınırıyla uzlaştırılarak taşındı). Çocuk tarafı: 301 i18n anahtarının hepsinde `es`,
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
- [x] Ebeveyn uygulaması: alt sekmeler, Raporlar ve tek telefon kolonu (2026-10-04, Claude).
      Dört sekme — **Çocuklar** (ana ekran), **Tuto'ya Sor** (aynı gün Raporlar'ın yerine), **Ekran süresi**, **Ayarlar**.
      Ekran süresi sekmesi aynı gün kullanıcı kararıyla eklendi (önerim native'i beklemekti): kurallar
      çocuk çipleriyle, her kontrol kendini kaydediyor (700ms debounce, compare-and-swap; çocuk
      değişince ve sekmeden çıkınca bekleyen yazılıyor — sekme barının üstünde "Kaydet" düğmesi
      düzenleme kaybettirir). Değerler girilirken sıkıştırılıyor (hafta içi ≤ tavan, ek süre ≤ tavan),
      kaydedilemeyen tek şey başı = sonu olan program. Ekran KULLANIMI değil bugünün PLANINI gösteriyor
      ve üstte web denemesi uyarısı duruyor (bkz. 2026-09-20 sınırı). Çocuk görünümü denemesi eski
      `/parent/settings/screen-control?view=preview`'da.
      **Aynı gün ikinci tur (kullanıcı onayı, piyasa karşılaştırmasından):** (1) **Önce öğren, sonra oyna**
      (`learnFirst`, `learnNeed` 1-5): o günün BİTMİŞ görev sayısı (today-summary, gerçek veri) yetene kadar
      süreli uygulamalar kapalı; sayı bilinmiyorsa kapatmaz; uyku/okul saati önceliği korur. (2) **Bugünlük
      ek süre** (`extra: {date, minutes}`): kuralları değiştirmez, yalnız o gün; günlük tavanın ÜSTÜNE biner
      (tavan Gem'le kazanılan süreyi yönetir, bu ebeveynin kendi kuralını bir günlüğüne aşması); kişi başı
      günde en fazla 120 dk, kodda. Sohbette `give_screen_time` (5-120 dk, `clear`), sekmeyle aynı alanı
      compare-and-swap ile yazar; "bugün" ebeveynin saat dilimi. Model "şimdi oynayabilir/cihaz açıldı"
      diyemez — araç açıklaması ve sonuç web denemesi olduğunu söyler. (3) **Tatil modu** (`holiday`,
      `holidayFrom..holidayTo` dahil): okul saati kapalı, her gün hafta sonu süresi. Eski kayıtlı kurallar
      varsayılanların üstüne okunuyor (`readRules` birleştirir), sıfırlanmıyor. Sohbet bağlamında
      `screenTime` cümlesi (plan, kullanım değil). Sunucu mantığı `server/screenTime.js`, test
      `scripts/tests/screen-time.test.mjs`; model testi `src/lib/__tests__/screenControl.test.js` 10/10.
      Gerçek Supabase ve gerçek sohbet modeliyle (`give_screen_time` çağrısı) denenmedi.
      **Üçüncü tur: "Tuto'ya Sor" sekmesi (kullanıcı kararı).** Raporlar sekmesi gitti; rapor artık çocuğun
      sayfasında ("📊 Bu hafta" kartı → `/parent/reports?child=`, geri çocuğa döner, çocuk çipleri yok).
      Yerine 💬 **Tuto'ya Sor**: aynı beyin (`handleMessage`, `POST /api/parent/chat`, ebeveyn JWT, 1000
      karakter), ama **yalnız soru-cevap ve yalnız üç konu: çocuğun gelişimi, ekran süresi, gem.** Tuto burada
      kendiliğinden bir şey demez — bildirim/onay gösterilmez; ekran yalnız burada sorulanları gösterir
      (cihazda, `tuto_ask_v1:<uid>`, son 60), beyin yine ortak transkripti hatırlar. Kapsam KODDA: bu kanalda
      modele yalnız `give_screen_time`, `gift_gems`, `deduct_gems`, `update_task_reward`, `set_math_focus`
      sunuluyor ve dispatch'in en başında başka araç reddediliyor; davranışı `APP_SCOPE_NOTE` anlatıyor
      (kapsam dışını tek cümleyle Telegram/WhatsApp'a ya da ilgili ekrana yönlendirir). Fotoğraf yeniden
      gönderen iki araç uygulamadan çağrılınca fotoğrafı Telegram'a değil cevaba koyar. **Giriş kapısı ilk kez
      kuruldu ama YALNIZ bu sekme için** (`server/inboundGate.js`: dakikada 10, günde 150 ebeveyn mesajı;
      sayım `messages`'tan, kanal sütunu olmadığı için bütün kanalların toplamı; sayım başarısızsa geçer;
      model çağrılmadan sabit cevap). **Telegram ve WhatsApp davranışı DEĞİŞMEDİ** (kullanıcı: "o kısım tamamen
      farklı"): kapı, haftalık rapor bağlamı ve kapsam yalnız `opts.scope === 'app'` iken devrede; harness'te
      aynı ebeveyn için uygulama reddedilirken Telegram yolunun modele gittiği doğrulandı. Haftalık rapor
      `weekForChild()` tek kaynaktan (uç + sohbet bağlamı `thisWeek`, yalnız uygulama kanalında) — sohbetteki
      sayı grafikle aynı. Testler: `inbound-gate.test.mjs`, `parent-week.test.mjs` (weekContext). Gerçek
      Gemini ile uygulama kanalı denenmedi (anahtar yok): kapsam dışı soruya modelin cevabı görülmedi.
      **Dördüncü tur (kullanıcı bulgusu):** soru sorup başka sekmeye geçince cevap kayboluyordu (istek
      ekranın içindeydi; sunucu cevabı üretip transkripte yazıyor ama ekrana dönemiyordu). İki katman:
      (1) `src/lib/parentAsk.js` — sorular ekrandan bağımsız bir depoda; sekme değişse de cevap yerine
      oturur, uzaktayken gelen cevap için Tuto sekmesinde kırmızı nokta (bildirim değil, uygulama içi).
      (2) **Migration önce:** `server/migrations/2026-10-04_parent_app_chat.sql` (`parent_app_chat`): POST
      soruyu yazar, 202 ile hemen döner, cevabı arka planda satıra yazar; ekran geçmişi sunucudan okur
      (uygulama kapansa/cihaz değişse de cevap orada; sonraki bildirim işi bu satıra dayanacak). 3 dk'dan
      eski "pending" satır "Cevap gelmedi" + "Tekrar sor" olarak görünür (arada sunucu yeniden başlarsa).
      **Tablo yokken** eski davranış: cevap istek içinde, geçmiş cihazda — ama (1) sayesinde sekme
      değiştirmek yine kaybettirmez. `server/appChat.js` + `scripts/tests/app-chat.test.mjs`. Harness'te
      iki mod da gerçek `index.js` ile: tablo varken 202 (16 ms) ve 2 sn sonra GET'te cevap; yokken 200 +
      cevap. Tarayıcıda iki modda: sor → hemen Çocuklar → nokta → geri → cevap orada, nokta gitti, yenileme sonrası da.
      **Rapor her çocuğun altında:** Çocuklar sekmesinde her çocuk kartında "BU HAFTA 18 etkinlik · 255 ⭐"
      satırı + yedi çubuk → o çocuğun raporu (çocuk sayfasındaki kartla aynı kanca, `src/lib/parentWeek.js`).
      Raporun geri düğmesi geldiği yere döner (ana ekran ya da çocuk sayfası). Sekme çubuğu prototipin birebir tasarımı
      (düz bar + tek saç teli çizgi, emoji 👧 📊 ⚙️, pasifken %40) — çocuk uygulamasının yuvarlak barı
      bilerek farklı. Çocuk sayfası sekmenin üstüne biniyor, bar açık kalıyor; derin düzenleyiciler
      (görev ayarları, ekran kontrolü, PIN) barı kaldırıyor.
      **Raporlar:** `GET /api/parent/children/:childId/week` (ebeveyn JWT + sahiplik), Pazartesi
      başlangıçlı hafta, gün gün gem + sınıra takılan gün + geçen haftayla karşılaştırma. Toplama
      mantığı `server/week.js`'te — DB'siz ve saatsiz, `scripts/tests/parent-week.test.mjs` ile.
      **Tek genişlik:** 980px tablet düzeni kaldırıldı (tarayıcıda vardı, cihazda yoktu); her ebeveyn
      ekranı `.tc-col`, 430px, geniş ekranda arkası koyulaşıyor. Ekran Kontrolü 1100px'ti ve iki
      sütunu VIEWPORT'a bakıyordu — laptopta telefon kolonunu ikiye bölüyordu.
      **Yolda çıkan üç hata:** (1) `completedStoriesBetween` satır değil supabase sonucu döndürüyor,
      `.map` her istekte patlıyordu — uç canlı DB olmadan çalıştırılamadığı için fark edilemiyordu;
      `rowsOf()` iki şekli de okuyor. (2) `.tc-tabbed`'in 96px alt boşluğunu üç ekran satır içi
      `padding` kısayoluyla 32px'e eziyordu — bar sayfanın son 37px'ini kapatıyor, raporun "sınıra
      takıldı" uyarısı altında kalıyordu. (3) Rapor tarihleri ÇOCUĞUN diliyle yazılıyordu: görev
      adları çocuğun sözlüğünden gelmeli ama hafta aralığı ve gün adları ebeveynin dili
      (İspanyolca okuyan ebeveyn kendi raporunda "22–28 Eylül · Pzt Sal Çar" görüyordu).
      Doğrulama: npm test 107/107, build, font:check; i18n:check 82'de, eslint 353'te değişmedi;
      tarayıcıda 9 ebeveyn rotası × 320/390/1280 × 3 dil, yatay taşma ve runtime hatası 0.
      Gerçek Supabase/Railway ile denenmedi.
- [x] Parent dashboard keşfedilebilirliği (2026-09-20): panel "bugün" ekranı oldu — çocuk kartları bugünkü
      etkinlik, gem, Hezarfen ve "N onay bekliyor" rozetiyle (`/api/parent/overview`), "Bir süre meşgulüm" panelde,
      kanal bağlı değilse hatırlatma. Bütün ayarlar üstteki ⚙️ **Ayarlar** düğmesinden `/parent/settings`'e taşındı
      (Tuto sana nasıl ulaşır / Ne zaman yazarım / Önce bana sor / Cihaz). (Tabletteki iki sütun ve
      ⚙️ düğmesi 2026-10-04'te kalktı: ayarlar alt sekme oldu, uygulama tek telefon kolonu.)
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
      10-11 42/43 — kaçırmalar düzeltildi.
      Gece turu 2026-09-20 (taze seed): 5-6 41/41, 7-8 42/43 + 43/43, 8-9 46/46, 9-10 57/57, 10-11 54/57.
      Düzeltilenler: 7-8+ resimli `belongs`'ta çeldiriciler tek gruptan geliyordu, cevap şıklar arasında
      "tek farklı" olarak da bulunuyordu — artık 2 komşu grup + karışık gruplar; simetri sorusunda tarama
      (hatch) yok (çizgili ok dış hatla simetrik, çizgi açısıyla değil — çocuk şekle bakar); simetri
      sorusunda gerilmiş çokgen eğik durmaz (45° dönmüş dikdörtgen göze eşkenar dörtgen, köşeden köşeye
      bölünce "simetrik"; `symmetryGap` bunu ayıramıyor, bütün asimetrikler 10-18 aralığında). Kalan: iPad'de kart en altta (kaydırmadan görünmüyor). **İsim ve ikon kararı verildi (2026-09-16):** çocuk kartı
      "Bulmacalarım 🧩" / "My Puzzles 🧩" (kod zaten `puzzle` diyor; "Zekâ Oyunları" serbest oyun
      beklentisi kurar, "Şekil Bulmacaları" emoji/ikon sorularında yanlış olur), ebeveyn tarafı
      "Şekil ve örüntü bulmacaları (NVR)". İkon `src/assets/puzzle-tile-icon.svg` (2×2 ızgara + ?,
      turkuaz kart — pembe denendi, beğenilmedi, 2026-09-18); çocuk ekranı gelmeden ana ekrana kart koyma — boş sayfaya gider.
- [ ] English motoru: beş bant, 49 tip (2026-09-25, Claude). Üç yeni Bond kitabı baştan sona okundu:
      *Verbal Reasoning Assessment Papers 7-8* (22 kâğıt × 30), *English Assessment Papers 10-11
      Book 1* (10 × 100), *11+ English Multiple-choice Test Papers Pack 2* (4 test). `bandForAge`:
      ≤8 → **7-8** (yeni), 9 → 8-9, 10 → 9-10, 11 → **10-11** (yeni), 12+ → 11-12. Eskiden 7 yaş 8-9
      kitabının harf bulmacalarını daha düşük eşikle alıyordu — daha zor bir kitap, daha küçük kelimeler.
      **7-8 kitabı anlam değil kelimenin YAPISINI soruyor**, o yüzden neredeyse hepsi sözlükten
      deterministik üretiliyor (17 tip, `YOUNG_VR_TYPES`): TABLE=12345 şifresi (iki yön), aynı harfli iki
      kelime, dördünün başına gelen harf, alfabetik sıra, peac(h)ome, değişim kalıbı (pit→pot, lit→lot),
      TEN→?→FIN merdiveni, harflerden yapılamayan kelime, AB:CD harf analojisi, kelime analojisi
      (yavru/ses/yuva/renk/zıt/dişi — elle tablo), anlamdaş+kafiyeli (elle ipucu tablosu: WordNet
      eşanlamları duyu karıştırıyordu, "about → most"), bileşik kelimenin başı, en eş/en zıt çift,
      mantık tablosu (4 kişi × 2 özellik) ve sıralama, karışık harf, harfleri sıralı kelime, harf-sayı
      işlemi. Kelime havuzu **yalnız Dale-Chall** (somut isim kaçağı `cant`, `mike` getiriyordu).
      **10-11: 13 tip (`GRAMMAR_TYPES`)**, MC Pack'in kendi çoktan seçmeli biçimleri: sahiplik kesme
      işareti (girls' school / women's hospital), yanlış yazılmış kelime, ance/ence · ary/ery/ory ·
      cial/tial · sure/ture, ie/ei (tek ses olanlar), sessiz harf (kn/wr/gn/mb/mn/stle; `wh` aksana göre
      okunduğu için yok), kısaltma (iki yön, `could of` çeldiricisi), cümlede sesteş, cümlede fiil
      biçimi, karşılaştırma (cheaper/more cheap/most cheapest), tekil, dişil/eril, topluluk adı,
      atasözü; ayrıca paylaşılan üç harfle alfabetik sıra (procure/proclaim…). Elle yazılan her şey
      `src/lib/englishTables.js`'te; tablolar engel listesine takıldı ve temizlendi (`army`, `war`,
      `judge`, `hell`, `drunk`…), çalışma anında da her basılan kelime engel listesinden geçiyor.
      **Doğrulayıcı** her yeni tipte cevabı basılandan yeniden hesaplıyor ve kaç şıkkın uyduğunu
      sayıyor (örn. değişim kalıbında iki örneğin ikisine de uyan HER kural üçüncü kelimeye uygulanıyor;
      iki farklı gerçek kelime çıkarsa soru atılıyor).
      **Yolda bulunan eski hatalar:** (1) UK/US yazım tablosunda `below ↔ bellow`, `filing ↔ filling`,
      `pilar ↔ pillar` vardı — İngiliz ayarında `below` her yerde **`bellow`** basılıyordu; çift-l kuralı
      "ünlüden önceki her l" idi, artık "l ile biten bir kök + ek" (`travel+ed`). `check→cheque`,
      `tire→tyre`, `curb→kerb`, `draft→draught`, `story→storey` da çıkarıldı (Amerikan kelimesi aynı
      zamanda başka anlamda İngilizce). Üretilmiş dosya aynı kuralla süzüldü (nltk yok, yeniden
      derlenmedi; betik düzeltildi). (2) Kullanıcı bulgusu: 9-10'da `pit` cümlesi "they dug a pit to
      bury the body" — `bury` ailesi ve `smoking` çalışma anında reddediliyor ve `sentence-topics.txt`'e
      eklendi. (3) Kullanıcı bulgusu: tanım "make more attractive…", cevap `decorated` — 106 sıfat-fiil
      fiilin tanımını taşıyordu (`educated: give an education to`, `settled: settle into…`); tanımı fiil
      gibi okunan fiil-olmayan ya da çekimli kelime artık sorulmuyor.
      Doğrulama: english:check 5 bant × 2 çeşit × 300 soru/tip bulgu yok; her yeni tipten örnekler elle
      okundu; lab 7-8 ve 10-11 390px'te taşmasız; build, math:check, i18n:check değişmedi (38).
      **Kapsam dışı (BOOK_COVERAGE'da):** cümle tamamlama/kelime değiştirme/yer değiştirme, iki kelime
      arasına saklı kelime, ipuçlu harf ekleme-çıkarma, zaman/yaş bulmacaları; 10-11'de okuduğunu anlama,
      noktalama (Pack'in 3. bölümü), cümle dönüştürme, cümlede sözcük türü, benzetme/mecaz.
      **Açık:** `sense` tipinde aynı dilbilgisel uyumsuzluk sınıfı duruyor ("load the truck" → `laden`);
      çocuk ekranı hâlâ yok.
- [ ] English motoru: üç bant, 19 tip, lab canlı, çocuk ekranı yok (2026-09-20/21).
      **Üç kitap, iki ayrı ders.** 8-9 "English AND Verbal Reasoning" — kelimeler arası ilişki
      soruyor. 9-10 "Assessment Papers English" ve 11-12 "10 Minute Tests English" — dilbilgisi,
      yazım ve kelime türetme. Yani motorun açılış iddiası ("tipler yaşla değişmez, kadran
      değişir") bu üç kitapta **yanlış**; kopyalandığı NVR kitaplarında doğruydu. Artık her bant
      kendi tip listesini söylüyor (`BANDS[x].types`), 9-10 ve 11-12 harf bulmacalarını ve kelime
      ızgarasını hiç posalamıyor çünkü kitaplarında yok.
      **İki aile:** `VR_TYPES` (8) sözel akıl yürütme; `WORD_TYPES` (11) kelime bilgisi —
      odd-synonym, definition, rhyme, homophone, syllables, plural, past-tense, suffix,
      prefix-antonym, root-word, missing-vowel.
      **Çeldirici mantığı ikinci ailede farklı:** VR'de yanlış şık başka bir KELİME; burada en
      iyi yanlış şık **kuralın körlemesine uygulanmışı** — `beautyful`, `childs`, `writed`.
      Çocuğun gerçekten yazdığı cevap bu, o yüzden ekranda olması gerekiyor (`why` alanı söylüyor).
      **Yeni veri, hepsi çevrimdışı:** CMUdict (kafiye, eş sesli, hece) — WordNet'in hiç
      bilmediği ilk şey. CMU Amerikan, kitaplar İngiliz: 9-10'un kış şiiri `calm`'ı `arm` ile
      kafiyeliyor ve Amerikan yazımında bunlar kafiyeli değil. R düşürme şart ama **her sesliden
      sonra değil** — sadece AA/AO/ER/AH. (İlk hâli `shed`'e `shared`'ı eş sesli dedi; EH+R
      İngilizcede EH değil, `air`'in diftongu.) Ayrıca WordNet türetme ilişkileri (ek/kök),
      zıt anlam ∩ olumsuz ön ek (`possible→impossible`), düzensiz çoğul ve geçmiş zaman listeleri.
      **Hangi İngilizce ayarı (2026-09-21).** Yazım **ve ses** lehçeye göre değişiyor; ses
      tarafı cevabı değiştirdiği için asıl mesele o. `calm/arm` sadece İngilizcede kafiyeli,
      `bath/math` sadece Amerikancada; `flaw/floor` İngilizcede eş sesli, `oar/ore` ve
      `fairy/ferry` Amerikancada. Ölçüm: 880 kelimenin (%5) kafiyesi farklı, İngilizcede olup
      Amerikancada olmayan 49 eş sesli grubu, tersi 9. Yanlış varyantta üretilen soru "yanlış"
      görünmez, **doğru cevabı sayfada olmayan soru** gibi görünür.
      `generateItem(..., { variety: 'uk'|'us' })`, varsayılan `uk` (kitaplar ve 11+ İngiliz,
      bütün eşikler onlara karşı ölçüldü). Bir soru tek varyantta üretilir, doğrulayıcı
      karışmayı reddeder; denetçi 3 bant × 2 varyant = 6 kombinasyonu tarar. Lab'da düğme var.
      **Ürün kararı bekliyor:** ayar nerede yaşayacak (`children.language`'a BAĞLAMADAN — üçüncü
      eksen), kim seçecek, varsayılan kalsın mı. Uyarı: varyant yazımı ve sesi değiştirir,
      **müfredatı değiştirmez** — Amerikan yazımıyla İngiliz müfredatı sunuyoruz.
      **CMUdict atıldı**, yerine iki IPA sözlüğü (open-dict-data, MIT, kapsama %95). Sebep
      özellik değil hata: CMU Amerikan ve Amerikanca `hot` ile `calm`'ın seslisini birleştirmiş,
      İngiliz için R düşürünce `heart` ile `hot` aynı oluyordu — sözlük `heart/hot`, `carp/cop`,
      `darn/don` çiftlerini eş sesli sunuyordu (hiçbir lehçede değiller).
      **Kör test beş tur, 312 soru, 305 doğru.** Üç kaçırma da motorun hatasıydı:
      `shed≈shared` (R kuralı), `form≈spring` (baskınlık kapısındaki kaçak — ana sözcük türü
      iki koldan yalnız birinde şart koşuluyordu), `unopposed→opposed` (kök bütün ekleri soymalı).
      **Diğer bulgular:** `ring→rung` (geçmiş zaman değil sıfat-fiil); `dive→dove` yanında
      `dived` çeldirici olarak (iki biçimi de doğru olan 28 fiil listeye yazıldı — frekans
      bunları ayıramıyor, `speeded` 2.37 ama doğru); kafiye anahtarı son **vurgulu** sesliden
      alınmalıydı (381 grup → 1326); `act+tion=action`; `comedian ≠ co+median`;
      **`cat` sözlükte yoktu** — özel-ad kapısı WordNet'te `CAT` (tomografi) var diye onu ve 520
      sıradan kelimeyi (`ball`, `angle`, `army`, `bath`, `begin`) atıyordu, kapı kaldırıldı;
      **her kelimenin iki yazımı vardı** (15/15 çift) — 91 Amerikan biçimi atıldı, çünkü
      yazım tiplerinde çocuğun öğrendiği yazım yanlış şık olarak çıkıyordu.
      **Performans:** beş üreteç her soruda kendi indeksini baştan kuruyordu (19.000 kelimeyi
      süzerek). 24.000 soru 19.192ms → 1.445ms; 10 soruluk oturum 0,72ms.
      **Havuz:** 68.185 farklı soru (şıklarıyla 1,34 milyon). En dar tipler `odd-two` 182 ve
      `hidden-word` 167; en geniş `letter-pair` 26.537.
      Eski 8-9 notu aşağıda duruyor.

- [ ] English (sözel akıl yürütme) motoru: lab canlı, çocuk ekranı yok (2026-09-20).
      Kaynak Bond 11+ English and Verbal Reasoning 10 Minute Tests **8-9**; diğer yaşlar sonra.
      **Metin yok** — kitabın 9 comprehension testi bilerek dışarıda; uydurma paragraf okutmak
      Reading modülünün gerçek kitapla yaptığının kötü kopyası olur. Sekiz tip üretiliyor:
      synonym, antonym, sense ("bu cümlede 'bear' ne demek", kitabın en kalabalık tipi),
      odd-two, word-grid, letter-pair (`tired → sl__py`), shared-letters, hidden-word
      (`pil___` → low).
      **Mimari bulmacanınkiyle aynı, besleme kaynağı başka:** NVR'da içerik çizilendi (sonsuz,
      bedava, dilden bağımsız); burada içerik bir SÖZLÜK. Motor ince, ağırlık veride —
      `src/lib/englishLexicon.generated.js`, WordNet'ten `scripts/english/build_lexicon.py` ile
      bir kez üretiliyor (`npm run english:lexicon`). **Üretimde model yok**: soru maliyeti
      sıfır, süresi milisaniye, 40 soru 90ms.
      **Ölçüm, tahmin değil:** kitabın 598 gerçek şık kelimesinin 5. yüzdeliği Zipf 2.86, o
      yüzden bant eşiği 2.8 — kitabın kendi kelimelerinin %95'ini tutuyor. Bant bir kadran
      (`BANDS`), şablon seti değil; 5-6 ve 10-11 aynı üreteçler + farklı eşik.
      **WordNet'in ne verdiği ölçüldü:** kategori ve zıt anlam mükemmel (`lamb/calf/foal` →
      young_mammal, `donkey/pig` değil — kitabın kendi sorusu), sense mükemmel (örnek cümle +
      o anlamın eşanlamları tek kayıtta), **eşanlam zayıf** — kitabın 12 çiftinin 4'ü. Ama
      `medal` için verdiği `ribbon` kitabın birinci çeldiricisi: WordNet cevap üreticisi değil,
      **çeldirici üreticisi**.
      **Güvenlik — üç ayrı eksen, üçü ayrı liste:**
      (a) *Küfür/hakaret*: `scripts/english/vendor/`'da gömülü iki yayınlanmış liste (LDNOOBW
      CC-BY, cuss MIT) + elle yazılmış 475 madde = 1.958 kelime. Üçüncü bir liste
      (profane-words) kullanıldı ve **çıkarıldı**: tek kopyasol lisans oydu (LGPL-3.0) ve bu
      listeler uygulama bundle'ına giriyor. Tek başına koruduğu 50 kelimenin yarısı yanlış
      alarmdı (`leper`, `licking`, `vixen`), gerçek olan 25'i elle `blocklist.txt`'e yazıldı. Elle
      yazılan liste **90 kelimeyi kaçırmıştı** (ırkçı hakaretler ve müstehcen kelimeler dahil,
      hepsi sözlükte duruyordu) — yayınlanmış listeler bu yüzden var. `cuss` derecelendirilmiş
      ve **yalnız skor 1-2 alınıyor**: skor 0'da `african`, `asian`, `american`, `banana`,
      `church` var, onları engellemek daha büyük bir hata olurdu.
      (b) *Yetişkin sahnesi*: `sentence-topics.txt` (314). Masum ama cümle kurunca haber
      bülteni olan kelimeler — savaş, mahkeme, borsa, klinik. Hiçbir küfür listesinde yok;
      ilk bozuk soru "received confirmed reports of **casualties**" idi ve `casualty` hiçbir
      listede geçmiyor, çünkü kaba bir kelime değil.
      (c) *Okunabilirlik*: Dale-Chall (2.942 kelime, 4. sınıfın %80'inin bildiği) — engelleme
      değil **izin** listesi, cümle denetiminde kullanılıyor.
      (d) *Din*: tamamı çıkarıldı (2026-09-20 kullanıcı kararı). Dar çizgi masadaydı — binalar
      kalsın (cami/kilise/sinagog genel kültür, `place_of_worship` kategorisi), yalnız kavramlar
      çıksın — alınmadı; geniş çizgi daha net ve savunması kolay. Sebep `mosque` değildi: sözlükte
      `holy ↔ unholy`, `sacred ↔ profane`, `religious → secular`, `pray = beg = implore`,
      `saint = ideal` duruyordu ve `religious → secular` gerçekten üretiliyordu. **Simetri pazarlık
      konusu değil** — `mosque` çıkıp `church` kalsaydı hiç dokunmamaktan kötü olurdu. Maliyet:
      26 kategoriden biri (ibadethane) ve ~140 kelime. Doğrulama: 4.651 soruda dini kelime 0.
      Bilerek tutulanlar: `spirit`, `belief`, `cardinal`, `crescent`, `wedding`. Buna ek olarak her cümlede en az
      bir somut isim şartı ("of___d all laws of humanity" bu yüzden eleniyor).
      WordNet'in kendi işaretleri hiçbirini görmüyor (`slut` Zipf 3.8, `usage_domains` boş,
      lexname `noun.person` — `teacher` ile aynı). Blocklist çalışma anında da gerekiyor:
      harf tipleri şıkkı harften kuruyor ve üç harf ~300 soruda bir `ass` yazıyor.
      **Tarayıcıda ve denetimde bulunan gerçek hatalar** (hepsi düzeltildi): lemma büyük/küçük
      harf kontrolü **küçültmeden sonra** yapılıyordu — `Russia`, `Jap`, `Wallace`, `Denmark`
      şıklara girdi (bir ırkçı hakaret dahil); `sense` çeldiricileri aynı kelimenin başka
      anlamlarındandı ve yakın anlamlar ikinci doğru cevap oluyordu (`protection` → cevap
      `shelter`, çeldirici `security`) — artık yalnız Wu-Palmer uzaklığı 0.4'ün altındaki
      anlamlar çeldirici olabiliyor; `related()` hem eşanlamı hem aynı-kökü kapsadığı için
      eşanlam üreteci kendi cevabını reddediyordu (90.000 tohumda sıfır soru) — ikisi ayrıldı;
      wordfreq özel adların frekansını ödünç veriyor (`murphy` Zipf 4.3, WordNet'te tek anlamı
      "patates" argosu) — NLTK'nin isim listesi + SemCor sayacıyla eleniyor.
      `npm run english:check` sekiz tipi 300'er soruyla tarıyor: tek doğru cevap, bant altı
      kelime yok, blocklist ihlali yok, 200 oturumda tekrar yok, cevap konumu a-e %19-21.
      **Çoğullar kural, liste değil (2026-09-21).** İlk hâli WordNet'in düzensizler listesiydi;
      kitapların sorduğu 27 çoğulun 19'u üretilemiyordu (`baby`, `church`, `valley`, `roof`,
      `fly`, `lady`, `donkey`) — çünkü onlar düzensiz değil, **kuralın öğretildiği** kelimeler.
      Kitap kuralı komşusuyla çiftleyerek öğretiyor: `baby→babies` yanında `valley→valleys`
      (ünsüz+y ile ünlü+y), `thief→thieves` yanında `roof→roofs`, `potato→potatoes` yanında
      `piano→pianos`. Artık her kayıt kuralını taşıyor, yanlış şıklar **öteki kuralın o kelimeye
      uygulanmışı**. 66 → 825 çoğul. Latin çoğulları 11-12'ye kilitli (kitap da orada soruyor).
      **Tanım taraması iki işi birden yapıyordu (2026-09-21).** `valley` sözlükte yoktu: tanımı
      "a long **depression** in the surface of the land", `depression` engelli. Tarama hem
      anlamın GÖSTERİLMESİNİ hem kelimenin VAR OLMASINI engelliyordu; ikincisi kasıtlı değildi
      ve yazılı değildi, yani sildiği kelimelerin yazarı yoktu. 142 sık kelime: `valley`,
      `clan`, `akin` ("related by blood"), `cattle` ("regardless of sex"), `chew`, `certainly`,
      `knife`. Ayrıldı: varlığa lemma listesi karar veriyor, tarama yalnız basılan metne.
      Sonra geri gelen 785 kelime **elle okundu** ve `imprisonment`, `handgun`, `leukemia`,
      `sexism`, `holocaust`, `screwing` gibi ~300 madde listeye yazıldı; `hospital`, `tennis`,
      `victory`, `tornado`, `fisherman` bilerek bırakıldı.
      **2026-09-26 kör test:** tekil-s iyelik, belirsiz contraction, rhyme-synonym yardım etiketi,
      bağlamsız WordNet eş/zıt anlam çiftleri, çakışan odd-two kategorileri ve doğrulanmış bozuk
      sense kayıtları düzeltildi. Seed'ler, ölçümler ve kalan editoryal risk
      `ENGLISH_BLIND_TEST_2026-09-26.md` içinde. **Açık işler:** (1) kategori havuzu ince — 26
      kullanışlı grup, `odd-two` en dar tip; (2) `sense` cevapları artık elle okunmuş
      `SENSE_ANSWERS` allowlist'inde (77–82 ayrı soru, üretim verimi %49–62); çeldiricileri
      WordNet'ten geldiği için kör okuma sürmeli;
      (3) kitabın cloze
      paragrafı, karışık cümle ve kelime türü tipleri yok (cümle bankası ister);
      (4) çocuk ekranı yok — geldiğinde soru sunucuda üretilmeli, cevap tarayıcıya hiç
      gitmemeli (PuzzleScreen deseni). Sözlük 1.8MB, yalnız lab'a lazy yükleniyor.

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

- 2026-10-04: Aile kodu okuma hatasında yeniden üretilmez; ilk yazım yalnız NULL koşuluyla yapılır. Birden fazla çocukta giriş açık çocuk seçimi + o çocuğun PIN doğrulamasıdır. Aynı PIN ile belirsiz eski istemci isteği ilk kardeşi seçmez.

- 2026-10-04 kullanıcı revizyonu: günlük çocuk seçimi kaldırıldı. /setup/assign yalnız ebeveyn oturumuyla cihazı çocuğa bağlar, bu tarayıcıdaki ebeveyn oturumunu local scope ile kapatır. Sunucunun amaç ayrımlı HMAC cihaz belgesi parent/child/device kimliğine bağlıdır ve 1 yıl geçerlidir; SUPABASE_SERVICE_ROLE_KEY yalnız sunucuda imza anahtarıdır. PIN girişinde belge zorunlu, child_id istemciden seçilmez. Eski cihazlar bir defa kurulur. DB migration yok; tekil cihaz iptali ve bütün API/DB erişiminin çocuk session auth ile korunması ayrı kalan iştir.

- 2026-10-04: Ana ekranda Okuma / Hikâye yazma / Kitaplık / Arşiv kısa yolları; hikâye liste ekranında Okuma / Kitaplık / Arşiv bağlantıları görünür. Yazı düzenlerken gösterilmez; kapalı görevler kısa yollarda da gizlenir.

- 2026-10-04 kullanıcı geri alma kararı: ebeveyn oturumuyla cihaz eşleştirme geri alındı. /setup yeniden aile kodu veya QR -> çocuk PIN akışı. /setup/assign eski bağlantısı /setup yönlendirmesidir. Cihaz belgesi zorunluluğu ve çocuk kurulumunda ebeveyn sign-out kaldırıldı. Aile kodunun sabit kalması düzeltmesi korunur. Yukarıdaki cihaz belgesi kararı artık geçerli değildir.

- 2026-10-04: ReadingFlow kitap kayıt hatasında kapağa dönmez; başlık/kapak korunur, tekrar deneme aynı kitap ID ile yapılır. Sayfa alanları DB hatasında ilerlemez. QA hesabında doğrudan anon insert başarılı; kullanıcının asıl kayıt hatası henüz yeniden üretilemedi.

- 2026-10-04: My Books ortak aktif kitap/hikâye sayfasıdır; /child/stories idle aynı LibraryScreen bileşenini gösterir. Write ve upload doğrudan editöre gider. Raflı arşivin etiketi My Library; üstte iki sekme. Story route location.key ile remount olur, aynı route üzerindeki farklı taslak/action state değerleri kaybolmaz.

- 2026-10-04 kullanıcı kararı: My Books içinde Story Studio / Book Explorer renkli seçim kartları aynı sayfada yalnız ilgili aktif kitap listesini gösterir. My Library kartı ikisinin altında raflı arşivi açar. Son alan çocuk kimliğine göre bu cihazda hatırlanır; EN/TR/ES etiketleri yerelleştirilir.

### 2026-10-06 Android publication and device validation
User explicitly approved publishing `codex/android-complete` to public `issolded/tuto`.
Shell push had no credentials; connected GitHub API published an identical tree as
`ea40ddc`, then version-only bump `3217f87` (4 / 0.4.0-native-validation).
CI https://github.com/issolded/tuto/actions/runs/37461523253 passed build, 9 JVM tests,
lint (0 errors, 11 warnings), and all 4 Pixel Tablet API 35 UI tests. Captured
landscape screens inspected. Test API is injected: no live WhatsApp or real family
E2E verified. Missing native modules remain; do not describe this as full parity
or deliver the withdrawn offline preview. See mobile/BUILD_STATUS.md.


### 2026-10-06 Android missing-module implementation

User explicitly requested implementation of English, reading/library, homework, stories/drawing, parent and newer maths features, not another placeholder preview. Native implementations now exist in `EnglishRun`, `FeatureRun`, `ParentRun`, `Cloud`, `Media`, and their Compose screens. Only mobile code/CI/docs changed; web/backend production was not deployed. Public Supabase anon config is packaged from the deployed frontend (never a service-role key). Parent tokens are Keystore encrypted, child requests never inherit the parent token. New photo originals use private Storage; parent previews request ownership-checked signed URLs. Native device and state tests use isolated fake transports and never write a real family. Full scope and remaining differences are in `mobile/NATIVE_MODULES_2026-10-06.md`.

Still not a full-parity release: complete specialised maths helpers, OAuth, some parent/history/library presentation, cross-process in-flight sessions, and live auth/storage/model/WhatsApp E2E remain. The earlier offline preview stays withdrawn; do not call a successful compile or fake-server device run a live E2E pass. Version 0.5.0 is validation only. Existing user authorization to publish this work to public `issolded/tuto`, `codex/android-complete`, remains valid.

Android module follow-up: local full build + lint + 14 JVM tests passed; public source `980d085`, CI `37471192968` Android job passed. Its tablet result was 5/7: all three new ModulesTest cases passed, existing sibling PIN and maths tests failed. Maths Check was below the viewport after extra controls; paper action moved into the top bar and scratchpad after primary actions. Login now dismisses IME; tests verify visible/selected controls and wait for platform UI settling. Follow-up also refreshes signed-in child language/task settings from anon RLS, adds full puzzle history figures, preserves automatic English variety and legacy age-only profiles, and explains the story completion word minimum. Follow-up device re-run required; no live E2E claim.

Android follow-up c9df357: CI 37473978404 passed both jobs and all 7 Pixel Tablet tests; the two prior failures are resolved. Next changes: signed numeric answers, ordered in-place photo crop replacement, pending-save help metadata, additional descriptor-driven maths manipulatives (including half pictograms) and translated screen-plan labels. New helper tests exercise signed-decimal worked steps and half-key counting. These need their own final CI; live family/WhatsApp remains unverified. No source/backend production deployment.

Android retirement verified: release 397715776 / asset 593265107 were the obsolete android-preview APK. User-authorized scoped cleanup workflow 37477802302 succeeded; subsequent GitHub release listing is empty. Native validation source remains 9b6957f while final six-mode place-value guidance and shape/arithmetic counters are being validated. CI debug signing is not a stable production update certificate; no production signing key is configured.

Final maths follow-up: six guided place-value modes (build/missing/shift/compare/arrange/digit), explicit borrow/carry exchange, counted shape marks and literal sum counters. Local full APK/instrumentation/lint build passed; 18 JVM tests passed. Added tablet 100−1 borrowing path; final device CI pending. Previous source 9b6957f passed all 9 tablet tests in CI 37476924186.

Math review contract audit found a real stale-state bug: help_shown from the original sitting survived into fresh reinforcement and could suppress its reward. Clear both help sets and wrong tries at new-session/review boundaries. The existing full maths tablet test now opens a hint, finishes, then answers a fresh review unaided and asserts the outgoing help flags/tries are clean. Android and tablet CI jobs now run independently (tablet builds its own APKs); both are still required.

Android source126694a passed both CI jobs in37481528885:18 JVM and10 tablet tests, including clean help flags on unaided maths reinforcement. Native Google OAuth follow-up adds PKCE, encrypted short-lived verifier, exact custom callback, initiated-flow guard and Android intent routing. Requires Supabase allowlist entry app.tuto.mobile://auth/callback; no admin configuration or live Google login was performed. Local execution environment went offline after the initial patch, so this follow-up is reconstructed against the published source and validated by GitHub CI. Unit and isolated callback device tests are included; do not call the provider/live family/WhatsApp path verified.

OAuth source ec5c86d: Android build/JVM/lint passed; tablet10/11. The new callback test reached its assertions but ActivityScenario teardown timed out at PAUSED. Follow-up retains the original activity launch intent instead of replacing it with the callback intent; callback data is still consumed directly and cleared. Re-run the same callback test and all tablet gates; do not suppress the failure or claim it passed before re-run.

Android automated closure (6 October 2026): source7c9cb3a passed CI37486144183:APK/lint,20 JVM tests and11/11 Pixel Tablet tests including guarded OAuth callback plus teardown. Native Google PKCE code is implemented; Supabase redirect allowlist app.tuto.mobile://auth/callback and real provider/family/Storage/model/WhatsApp E2E still require external setup/test access. No real family writes, messages, backend deploy or migration occurred. Obsolete preview release/APK deletion was verified. Canonical current evidence is mobile/BUILD_STATUS.md. Local environment disconnected with older uncommitted OAuth edits; tested GitHub source is authoritative and those local edits must be reconciled rather than blindly pushed.

Android photo follow-up (6 October evening): raw inline camera photos could exceed Express's 15 MiB JSON body limit. LocalPhoto.modelImage now uses an EXIF-oriented JPEG derivative, max edge 1600 and max 640 KiB, off the UI thread; 15 base64 pages fit within the limit. Reading/story transcription, drawing review and cover uploads use it. Private Storage originals and homework EXIF/date processing remain unchanged. Added three real Android decoder/encoder tests for noisy 15-page payload budget, orientation/date/original-byte preservation and invalid-photo rejection. Version 6 / 0.5.1-native-validation; CI result pending. User is testing the previously delivered 0.5.0; do not imply these changes are already in that APK. Backend/web not deployed.

Android photo follow-up verified: source d6e6d1c, CI37502854810 passed build/lint/JVM and 14/14 tablet tests. Initial emulator archive download failed before tests; rerun of failed job passed unchanged source. Native 0.5.1 photo derivatives are validated. User device installation remains unresolved (unknown-developer Play Protect prompt, then App not installed; user reports no Tuto installed, is updating Android). Do not assume certificate conflict or say photo patch fixes installation. Live family/provider/WhatsApp gates unchanged.

Android install investigation (6 October night): user tablet is Galaxy Tab S10 FE SM-X520, One UI 8.5; Auto Blocker off, no visible old Tuto, Android updated, still generic App not installed after Play Protect override. User cannot attach USB and explicitly wants native testing. Exact package-manager error remains unavailable; do not claim a root cause. APK audit confirmed alpha13 libquickjs.so uses 4 KiB ELF LOAD segments (APK ZIP entries already 16 KiB aligned; no testOnly flag). Version 7/0.5.2 rebuilds the exact alpha13 JNI/QuickJS sources (pinned upstream SHA and submodules) with NDK r28 and 16 KiB link flags, retaining its Kotlin API. AAR classes only are used so the old .so cannot be packaged. CI adds native ELF/ZIP checks and apksigner verification; tablet matrix now includes 4 KiB and google_apis_ps16k with PAGE_SIZE assertion. These gates must pass before delivering the new APK. This resolves a known binary compatibility gap, not proven Samsung install diagnosis. Web/backend/auth settings unchanged.

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

## Açık işler / yol haritası

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
- [x] Parent dashboard keşfedilebilirliği (2026-09-20): panel "bugün" ekranı oldu — çocuk kartları bugünkü
      etkinlik, gem, Hezarfen ve "N onay bekliyor" rozetiyle (`/api/parent/overview`), "Bir süre meşgulüm" panelde,
      kanal bağlı değilse hatırlatma. Bütün ayarlar üstteki ⚙️ **Ayarlar** düğmesinden `/parent/settings`'e taşındı
      (Tuto sana nasıl ulaşır / Ne zaman yazarım / Önce bana sor / Cihaz). Tablette iki sütun.
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
      **Açık işler:** (1) kategori havuzu ince — 26 kullanışlı grup, `odd-two` en dar tip;
      (2) `sense` havuzu 137 kelimeye indi (güvenlik+okunabilirlik kapıları cümleleri budadı) —
      verim %85 ama çeşitlilik sınırlı; (3) kitabın cloze
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

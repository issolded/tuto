# NVR: 6-7 ve 11-12 yaş bantları

Çalışma dalı: `codex/nvr-age-bands`. Başlangıç commit'i: `451dc21`.
Kaynak PDF'ler kullanıcının Downloads klasöründe; kitaplar veya sayfa görselleri repoya eklenmedi.
Sorular seed ile üretilen özgün SVG çizimleri. Üretimde model çağrısı yok.

## Kaynak incelemesinin sınırı

Üç PDF'nin metni çıkarılıp soru/bölüm başlıkları tarandı. Aşağıdaki **36 sayfa görsel olarak
incelendi**; tüm soruların tek tek çözüldüğü veya kitapların tamamının kapsandığı iddia edilmiyor.
Sayfa numaraları PDF sayacı; basılı sayfa numarası değil.

| Kaynak | İncelenen PDF sayfaları | Motora taşınan fikirler |
| --- | --- | --- |
| Schofield & Sims, *11+ Non-verbal Reasoning Rapid Tests 1, 6-7*, Rebecca Brant | 6, 8, 10, 12, 14, 16, 38, 40, 41, 44, 46, 48 | Beş şık, benzerlik/farklılık, tek değişimli analoji, AB dizisi, ayna, resmin içinde parça bulma |
| Bond, *Assessment Papers Non-verbal Reasoning 11+-12+, Book 1*, Alison Primrose | 7, 8, 10, 12, 14, 15, 16, 24, 30, 32, 36, 58 | Bileşik parçalar, analoji, kod, 3×3 örüntü, katlanabilir/katlanamaz küp, üst üste birleştirme |
| Bond, *Assessment Papers Non-verbal Reasoning 11+-12+, Book 2*, Nic Morgan | 7, 9, 10, 11, 12, 14, 15, 16, 26, 31, 38, 64 | Aynı ailelerin başka biçimleri; yatay/eğik ayna ve yönlü küp yüzleri gibi kalan farklar |

## Uygulanan kapsam

- `6-7`: beş şık; geometrik/ikon/emoji ağırlığı 4/2/4. Bu oran bir ürün ayarıdır,
  kitabın tüm soruları sayılarak ölçülmüş dağılım değildir. Tek adımlı analoji ve AB dizisi;
  geometrik yansıma; yeni `hidden-part`: aranan şeklin hem dış hattını hem dolgusunu
  dört parça arasından bulma. Yanlış seçeneklerde aynı dış hat ters dolguyla bulunur.
- `11-12`: tamamı geometrik. 10-11 bandının tüm dokuz geometrik tipine (analoji, yansıma ve ızgara dahil)
  beş yeni biçim eklendi:
  - `overlay`: iki çizimin bütün parçalarını konumlarını koruyarak birleştirme;
    tüm seçeneklerde aynı sayıda parça bulunur.
  - `compound-analogy`: bütün düzeni 90/180/270 derece çevirme ve dolu/boş değiştirme.
    Çeldiriciler bir adımı atlar, yanlış yöne döner veya dönmek yerine aynalar.
  - `compound-mirror`: dört parçalı bütün düzenin sağ-sol yansıması.
  - `matrix`: 3×3; satırda çeyrek dönüş, sütunda şekil döngüsü ve dolu/boş değişimi.
    Boşluk farklı hücrelerde çıkar. Son satır ilk satırın kopyası değildir.
  - `cube-net`: üç açınım biçimi, altı farklı ve çeyrek dönüşte aynı kalan yüz simgesi;
    hem “oluşabilir” hem “oluşamaz”. Katlama, yüzlerin 3B yönlerini hesaplar;
    sadece karşı yüzleri değil, köşedeki üç yüzün el yönünü/sırasını da kontrol eder.
- Çizim/üretim: `src/lib/puzzleSpatial.js`; sunucuya `puzzle:sync` ile birebir kopyalanır.
- EN/TR/ES yönergeleri ve cevap sonrası açıklamalar; lab ve çocuk ekranında ortak çizim.
  Küp açınımı en az 132px çizilir; diğer çizimler soru ve şıklarda aynı ölçektedir.
- `bandForAge` sunucunun da kullandığı tek kaynak oldu. Önceden ortak yardımcı ile
  sunucu farklı eşleme yapıyordu. Canlıdaki başlangıç yaşını esas alan yaklaşım korundu:
  5 ve altı → 5-6, 6 → 6-7, 7 → 7-8, 8 → 8-9, 9 → 9-10, 10 → 10-11, 11+ → 11-12.
  Önceki bantların üreteç/pool ayarları değişmedi.
- Sunucu, seçeneklerde `why` veya cevap anahtarı göndermeden çizim verisini gönderir.
  Yeni şekil verileri de yalnız görünen parçaları/yüzleri içerir. DB migration gerekmez.

## Bilerek açık bırakılanlar

`BOOK_COVERAGE` bunları makine tarafından okunabilir biçimde kaydeder:

- Küçük yaşın gizli şekilleri şimdilik ayrık geometrik parçalardır. Ortak çizgilerden
  oluşan gizli kontur, gerçek nesne resimleri, düzensiz siluetler ve ayrıntılı gölgeleme yok.
- Büyük yaşta serbest çizgi/eğri kompozisyonları ve kesintisiz yapboz örüntüleri yok.
- Yatay/eğik ayna ekseni yok; yalnız dikey ayna.
- Küplerde yönlü veya tekrar eden yüz simgeleri ve küpten açınım seçme yok.
- Kod ve sınıflandırma soruları mevcut özellik sözlüğünü kullanır; kitapların bileşik
  parça ilişkilerinin tümüne taşınmadı. Bu çalışma tam Bond sınav eşdeğerliği iddiası taşımaz.

## Doğrulama

- `puzzle:check`: yedi bantta 4.000 karma soru/bant; ayrıca her tipte 2.500 üretim ve
  cevap konumu taraması, 400 soru/tip bağımsız cevap kontrolü ve her yanlış cevap konumuna
  kasıtlı mutasyon. İlk taramada 6-7 `odd-one-out` 2497/2500 üretildi; bu yeni bandın
  dar havuzuna özel 180 deneme sınırıyla 2500/2500. Diğer bantların 60 sınırı korunur.
  Son değişikliklerden sonra 6-7 ve 11-12 ayrı tekrar tarandı: bulgu yok.
- `scripts/lib/spatial-oracle.mjs`: üretim dönüşümlerini veya küp katlayıcısını çağırmaz.
  Küpler üç elle katlanmış yön tablosuyla, 3×3 sorular komşu hücre ilişkileriyle çözülür.
- `scripts/tests/puzzle-spatial.test.mjs`: 1.200 yeni soru, bütün yanlış cevap konumları,
  bozulmuş çizimler, karşı yüz/el yönü örnekleri, katlanamayan açınım, yaş sınırları ve
  font olmadan 200 adet on soruluk oturum. Seed: `260926 + i*41`. İlk sürümde dört test geçti; aşağıdaki inceleme sonrasında altı test var.
- WebKit + Chromium: yeni soru türlerinden 552 çizim dahil toplam 720 görsel; boş çizim yok.
  Tek küçük kontur, tam hücreyi kaplayan emojiden daha az mürekkep taşıdığı için onun
  boşluk eşiği ayrı; boş SVG her iki eşikte de başarısız olur.
- `puzzle:pixels`: tüm bantlar, her tipte 40 soru; son SVG sürümünde ayırt edilemeyen
  şık çifti veya boş çizim bulgusu yok. `PLAYWRIGHT_CORE` ve isteğe bağlı `CHROMIUM_PATH`
  ile yerel runtime kullanılabilir; eski `/opt/pw-browsers/chromium` yolu da korunur.
- Gerçek React çocuk ekranı, **taklit API yanıtlarıyla ve tüm canlı istekler engellenerek**:
  WebKit'te 390×844 ve 1024×768, EN/TR/ES, altı yeni türden birer soru. Yanlış cevap
  açıklaması, ilerleme ve sonuç ekranı tamamlandı; yatay taşma ve çalışma hatası yok.
  Gerçek Supabase/Railway oturumu veya fiziksel iPad denenmedi.
- `i18n:check`: başlangıç commit'iyle aynı 41 bulgu; yeni bulgu yok. `font:check` geçti.
- Vite build exit code 0. Veritabanına yazılmadı; deploy/push yapılmadı.

## Ek test turu — 2026-09-26

Dal yine `codex/nvr-age-bands`, taban `451dc21`; yerel değişiklikler, push yok.
`git pull --ff-only origin main`: güncel. Aşağıdaki iki ek test betiği repoda saklandı.

- `node scripts/puzzle-spatial-stress.mjs`: altı yeni türün her birinde **5.000**, toplam
  **30.000** soru. Seed dizisi `(0x9e3779b9 * (i + 11)) >>> 0`. Üretim, doğrulama,
  bağımsız çözüm ve **120.000 yanlış cevap konumu mutasyonu** geçti. Matris cevabının
  gösterilmiş hücrelerden birinin kopyası olmadığı da kontrol edildi.
- Doğru şık dağılımı bütün tür/konumlarda %18,92–21,14; belirgin konum yanlılığı yok.
- Her yeni bantta 500, toplam **1.000 on soruluk oturum**. Seed:
  `(0x85ebca6b * (i + 23)) >>> 0`; ikon açık/kapalı dönüşümlü. Her oturum tam doldu,
  aynı seed yeniden üretildiğinde JSON birebir eşleşti, bir tür ikiden fazla sorulmadı.
  Bu makinede en yavaş oturum 6-7 için 35,5 ms, 11-12 için 173,0 ms (yerel ölçüm;
  ağ ve DB süresi içermez).
- **Görsel kör örnekleme:** `902100 + i*187`, altı yeni türden ikişer, 12 soru.
  İlk çözüm 11/12. `compound-mirror`, seed `903970`: elle E seçildi, anahtar C.
  Tekrar çizimden kontrol: üst soldaki boş daire üst sağa, orta sağdaki dolu kare
  orta sola, alt soldaki artı alt sağa gider; alttaki orta daire yerinde kalır.
  Bunların tümünü C taşır. Bu kaçırma motor hatası değildir; 12/12 diye raporlanmadı.
- **Bulunan ve düzeltilen ekran hatası:** WebKit 667×375, yanlış cevap sonrası uzun
  açıklamada “Tap to carry on” ekran dışında kalıyor, kaydırılarak da getirilemiyordu
  (Playwright `outside of the viewport`, 30 saniye timeout). Sabit geri bildirim
  katmanı dikey kaydırılabilir oldu; kısa içerik yine ortalı, uzun içerik küçülmeden
  büyüyor. Değişiklik `src/screens/PuzzleScreen.jsx` içinde.
- `scripts/puzzle-ui-check.mjs`: gerçek React ekranı, taklit API ve tüm uzak istekler
  engelli. WebKit 320×568 ve 667×375 × EN/TR/ES × altı tür = **36 soru akışı**;
  yanlış cevap açıklaması, devam metninin görünür koordinatlarda olması ve sonuç
  ekranı doğrulanır. Ayrıca EN/yatayda altı doğru cevabın otomatik ilerlemesi ve
  sonuç akışı denendi. Vite build exit code 0; canlı DB veya fiziksel iPad kullanılmadı.

Tekrar çalıştırma (Vite ayrı terminalde çalışırken):

```sh
node scripts/puzzle-spatial-stress.mjs
PLAYWRIGHT_CORE=/path/to/playwright node scripts/puzzle-ui-check.mjs
PLAYWRIGHT_CORE=/path/to/playwright UI_ANSWERS=correct UI_LANGS=en UI_SIZE=landscape node scripts/puzzle-ui-check.mjs
```

## Claude incelemesi sonrası düzeltme — 2026-09-26

Aynı dal ve taban commit; henüz commit/push yok. Önceki test sayıları tarihsel sonuçlardır:
**küp kiralitesinin fiziksel doğruluğunu kanıtlamıyorlardı.** Üretici ve ayrı denetçi aynı
yanlış determinant işaretini paylaşmıştı. Önceki kör örneklemedeki küp değerlendirmeleri de
bu hatayı kaçırdı; fiziksel doğrulama olarak kullanılmamalı.

- Artı açınım `[[1,0],[0,1],[1,1],[2,1],[1,2],[1,3]]`, simge=hücre indeksi:
  kuzey üst, merkez sol-ön, doğu sağ-ön olacak şekilde `[0,2,3]` geçerli;
  `[0,3,2]` geçersiz. Bu elle doğrulanmış sabit örnek düzeltmeden önce testi düşürdü.
  Ekranda y aşağı olduğu için top/front/right determinantı **-1** olmalı.
  Motor ve oracle düzeltildi; hem oluşabilir hem oluşamaz yönergesi test ediliyor.
- 11-12 artık 10-11'in dokuz tipinin tamamını aynı ayarlarla devralıyor ve beş yeni
  uzamsal tipi ekliyor (14 geometrik tip). Yeni küçük kompozisyonlar eski zengin şekil
  sözlüğünün yerine geçmiyor.
- 6-7 `glyph-analogy` içeriyor (üretir/dönüşür/korunma/yaşadığı yer). Resimli soru
  ağırlığı %30'dan %60'a çıkarıldı: geometrik/ikon/emoji = 4/2/4. Bu bir ürün tercihi;
  Claude'un bildirdiği Bond Starter 11/12 oranı tek örneğe ait ve burada yeniden
  ölçülmedi. Schofield'in geometrik alıştırmalarını da korumak için %92 hedeflenmedi.
  İşlev analojisi emoji ailesinin dört tipinden biri; oturumlar zorunlu bir kota taşımıyor.

Ölçüm: 6-7, seed 0..499, ikon açık, 500 × 10 soru: 2.073 geometrik,
1.096 ikon, 1.831 emoji; resimli payı %58,54. 346 işlev analojisi
(oturum başına 0,692). Ağırlıklar çekiliş olasılığıdır; tekrar/kategori sınırları
nihai oturum dağılımını değiştirebilir.

İnceleme sonrası tamamlanan kontroller: altı regresyon testi geçti; `puzzle:pixels`
3.720 soruda bulgu yok; WebKit + Chromium 720 çizimde bulgu yok; Vite build exit 0.
Sunucunun sekiz motor dosyası kaynakla birebir eşleşiyor.

Yeni ayarlarla stres testi yeniden geçti: 30.000 soru, 120.000 yanlış anahtar
mutasyonu ve 1.000 tam/tekrar üretilebilir oturum; tür sınırı istisnası yok.
En yavaş oturum 6-7: 21,8 ms; 11-12: 1.337,2 ms (eşzamanlı denetimler sırasında
bu makinede ölçüldü; eski tiplerin geri gelmesiyle önceki süreler güncel değil).

İnceleme regresyonunu yeniden çalıştırma:

```sh
PUZZLE_AUDIT_BANDS=6-7,11-12 npm run puzzle:check
```

`physical cross net fixes chirality in both engine and oracle` testi üreticiden
hesaplanmış bir beklenen cevap kullanmaz. Bant regresyonu, 10-11'in her tipinin
11-12 listesinde bulunduğunu ve 6-7'de işlev analojisinin etkin olduğunu sınar.

Son kapsamlı denetim de exit 0 ile tamamlandı: `PUZZLE_AUDIT_BANDS=6-7,11-12 npm run puzzle:check`.
Her bantta 4.000 karma soru, tip başına 2.500 üretim/cevap konumu ve 400 bağımsız
cevap/mutasyon denetimi; bulgu yok. 6-7 çekiliş karması geometrik %39, ikon %21,
emoji %40; 11-12 geometrik %100. Bu sonuçlar yukarıdaki tarihsel küp testlerinin
yerine, fiziksel regresyon düzeltmesinden sonraki sürümü kapsar.

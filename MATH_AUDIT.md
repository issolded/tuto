# Matematik Pedagojik Denetimi — 2026-08-21

Batu'nun (9) ilk oturumundaki şikâyetlerle başladı, 5–11 yaş arası tam bir taramaya döndü.

**Bulgular iki çocuktan geliyor, karıştırmayalım:**

- **Batu (9):** ekranda `3786+4904` (6), görünmeyen grafiğe atıf (4), `582,304`'teki
  tutarsız binlik ayırıcı (5).
- **Ada (7):** saat sorusunun yardımı cevabı veriyor (2), yardımdan dönünce görsel
  kayboluyor (3). Year 4/5/6'da zaman konusu olmadığı için 9 yaşındaki bir çocuğa saat
  sorusu zaten çıkmıyor — bulgu 7'nin kendisi bu.
- **Taramadan (5–11):** geri kalan her şey.

Kanıt iki kaynaktan: `/tmp/tuto-e2e/math-sweep.json` (21 oturum, yaş 5–11, en/en/tr, her biri
10 soru) ve tarayıcıda gerçek telefon boyutunda (390×664) yürütülen saat oturumları.

Bulgular önem sırasına göre. Her birinde dosya:satır ve ölçülen/alıntılanan kanıt var.

---

## P0 — Yayına almadan önce

### 1. Soru görselleri kısa ekranda eziliyor

`src/screens/MathScreen.jsx:80`

```
.math-scroll { overflow-y: auto; min-height: 0; }
```

`.math-scroll` bir flex kolon (satır 2190) ve içindeki hiçbir çocuk `flexShrink: 0` almıyor.
Kolon taştığında flex, kaydırmayı devreye sokmadan önce soru kartını ve içindeki SVG'yi eziyor.

Ölçüm:

| viewport | saat yüksekliği |
|---|---|
| 430×900 | 168px (doğru) |
| 390×664 | **26px** |

26px'lik bir kadranda yelkovanla akrep ayırt edilmiyor. Yani soru okunamıyor — ve bu yalnız saatte
değil, görselin *sorunun kendisi olduğu* her yerde: şekiller, piktogram, saat.

**Düzeltme:** soru kartına ve görsel sarmalayıcısına `flexShrink: 0`. Tasarım kararı gerektirmiyor.

### 2. Saat yardımı cevabı doğrudan veriyor

`src/screens/MathScreen.jsx:704-748`, satır 736:

```js
<DraggableClock hour={clock.hour} minute={clock.minute} size={228} language={language} />
```

Yardım, `DraggableClock`'u sorudaki saatle tohumluyor; `ClockFace.jsx:163-170` de altında
`digital(h, m)` ve `timeWords(h, m, language)` yazıyor. Üç farklı oturumda üç farklı saatle
tekrarlandı (1:00→"1 o'clock", 5:00→"5 o'clock", 9:00→"9 o'clock").

Tarayıcı çıktısı:

```
HELP readout: Turn the short hand — the number it stops at tells you the hour.  |  9:00  |  9 o'clock
```

Koddaki yorum "yardım cevabı asla göstermez" diyor; satır 736 bunu yalanlıyor.

Soru şekline göre sızıntı derecesi (`src/lib/mathTemplates.js:658-792`):

| şekil | tohumlama |
|---|---|
| `hour`, `halfPast`, `past` | cevabı **doğrudan** veriyor |
| `to`, `h24` | cevaptan bir adım ötede |
| `span`, `later` | tohumlamak **doğru** — başlangıç saati zaten soruda |

**Düzeltme:** ilk beş şekilde `DraggableClock`'u 12:00'den başlat, sorunun statik saatini
yanına koy (çocuk kendi kadranını ona getirsin — kullanıcının istediği tam olarak bu).
`span`/`later`'da mevcut davranış kalsın. Sıfırlama düğmesinin etiketi
`ClockFace.jsx:187`'de `↺ Sorudaki saate dön` / `Back to the question`; tohum değişince bu yalan
olur, `Başa dön` / `Start over` olmalı.

---

## P1 — Sabah halledilmeli

### 3. Yardımdan dönünce görsel ekrandan kayıyor

Kullanıcının bildirdiği bulgu. 390×664'te ölçüldü:

```
BEFORE help: {"scrollTop":0,  "scrollH":610,"clientH":594,"clockTop":44, "clockBottom":70,"fullyVisible":true}
AFTER help:  {"scrollTop":66, "scrollH":660,"clientH":594,"clockTop":-21,"clockBottom":5, "fullyVisible":false}
```

Görsel silinmiyor — kaydırma konumu korunuyor ama kolon uzuyor. Yardım kapandıktan sonra
`Skip this one →` düğmesi ekleniyor (`MathScreen.jsx:2276-2288`), `scrollHeight` 610→660,
`scrollTop` 66'da kalıyor ve saat üstten dışarı çıkıyor.

**Düzeltme:** yardım kapanırken (`MathScreen.jsx:2191-2203`, `onDone`) kaydırmayı başa al.
Not: 1 numaralı düzeltme bu semptomu hafifletir ama tek başına gidermez.

### 4. Çizilmeyen grafiğe atıf yapan sorular — 10 örnek

Batu'nun ikinci şikâyeti buydu; taramada sistematik olduğu görüldü.

- `"If a chart shows 8 dogs and 5 cats…"` (7en)
- `"In a chart of 6 red cars…"` (7en)
- `"if a pictogram has 5 symbols…"` (8en)
- `"On a pictogram, each symbol represents 4 books"` (8en)
- `"Grafikte her elma resmi 5 elmayı temsil ediyor"` (8tr)
- `"Grafiğe göre Ali 12, Can 18, Efe 9 kitap okudu"` (9tr)
- `"If Leo's graph shows 15 mm of rain in June…"` (9en)
- `"In a table, the values are 450, 720, and 310"` (10en)
- `"Bir dairesel grafikte 180 derecelik dilim 40 kişiyi gösteriyorsa"` (11tr)

`src/lib/gemini.js:344-346` şunu zaten söylüyor: *"Data for a statistics or graph question goes
INTO the sentence… Never 'Team | Week 1 | Week 2'."* — yani tabloyu **basmayı** yasaklıyor ama
grafiğe **atıf yapmayı** yasaklamıyor. Model kuralı harfiyen uyguluyor: veriyi cümleye koyuyor,
sonra olmayan bir grafiğe işaret ediyor.

**Düzeltme:** (a) prompta açık yasak, (b) `isUnreadable(q)` yanına bir muhafız — görseli olmayan
soruda grafik/tablo/piktogram/diyagram/şema geçiyorsa reddet. İki katman gerekli çünkü prompt
kuralları tek başına tutmuyor (kanıt: yukarıdaki 10 örnek).

### 5. Binlik ayırıcı rastgele

Aynı taramada:

- `Round 347820 to the nearest 10000` (ayırıcı yok)
- `Round 482,735 to the nearest 10,000` (ikisinde de var)
- `round 582,304 to the nearest 100000` (kullanıcının bulduğu — birinde var, ötekinde yok)
- `58,294 + 13,805 = ?` (çocuğun tuş takımıyla cevaplayacağı çıplak toplamda virgül)

Türkçede virgül **ondalık** ayırıcı. TR sorusunda İngiliz usulü `482,735` yazılırsa çocuk bunu
482.735 okur. `src/lib/numerals.js`'teki `numeralise(text, lang)` yalnız yazıyla yazılmış sayıları
rakama çeviriyor, ayırıcıya dokunmuyor.

**Düzeltme:** `numeralise` yanına dile duyarlı bir ayırıcı normalleştirici — EN'de tutarlı virgül
ya da hiç, TR'de nokta ya da hiç. En güvenlisi: tuş takımıyla cevaplanan sorularda ayırıcıyı
tamamen kaldır.

### 6. Ekran modunda kâğıt isteyen aritmetik

Batu'nun ilk şikâyeti. `3786+4904` LLM'den **gelmiyor** — `src/lib/mathTemplates.js:111-149`
`additionTemplate`'ten geliyor. Zincir: `MAX_FOR_LEVEL[8] = 10000` → `rangeForLevel(8) =
{min: 2500, max: 10000}` → `a = randInt(2500, 7500)`, `b = randInt(2500, 10000-a)`.

Bu bir hata değil, müfredatın kendisi: `gemini.js` içinde `y4_addition` = *"Add numbers with up to
4 digits using formal columnar method"*, `y5_addition` = *"more than 4 digits"*, `y6_multiplication`
= *"using long multiplication"*. Sorun, ekran modunda çocuğun yazacak yeri olmaması.
`countingOnSteps` bile bunu itiraf ediyor: *"Line the two numbers up by their place value — ones
under ones, tens under tens."* — neyin üstüne?

Taramadan: `3482 + 2519`, `7003 - 2458` (sıfırdan ödünç), `4032 - 1758`, `4728 + 3584` (9 yaş);
`54300 - 12800`, `1425 × 6` (10 yaş); `1408 × 23 = 32384`, `3458 ÷ 13 = 266`, `3432 ÷ 24` (11 yaş).

Ayrıca kâğıt/ekran seçimi oturum başına bir kez yapılıyor, soru başına değil.

**Karar gerektiriyor — sabah konuşalım.** Üç seçenek:
1. Ekran modunda karalama alanı (en çok iş, en doğru cevap).
2. Ekran modunda büyüklüğü kıs, büyük olanları kâğıda yönlendir (en ucuz, müfredattan ödün).
3. Yardım panelinde sütun toplama/çıkarma göstericisi (orta yol; yardım zaten var).

### 7. Saat Year 3'ten sonra kayboluyor, Year 1'de ise kadran yok

`src/lib/gemini.js:5-85`: Year 4/5/6'da zaman konusu **yok**. Bu yüzden `clock-bug3.js`
9 yaşta 10 soruda tek saat sorusu bulamadı — hata değil, müfredat boşluğu.

Diğer uçta `y1_measurement` `TEMPLATE_FOR_TOPIC`'te değil, yani modele düşüyor ve 5 yaşındaki
çocuk saati **düzyazı** olarak alıyor:

> *"If the small clock hand points to 5 and the big hand points to 12, what hour is it?"*

Kadranın en çok gerektiği yaşta kadran yok. `src/lib/mathCurriculum.js:82-86` bu boşluğu zaten
yazıyla kabul ediyor.

**Not — bu düzeltmeyi tek başıma yapmadım.** `mathCurriculum.js:82-86`'daki yorum haklı bir
itiraz getiriyor: `y1_measurement` uzunluk, kütle, hacim, para VE saati birlikte taşıyor;
`timeTemplate`'e bağlarsam beş şeridin dördü sessizce silinir. Doğru çözüm diğer şeritleri de
kapsayan bir ölçme şablonu — yani gerçek bir iş, sabah konuşulacak. Year 4+ için zamanı geri
koymak da ayrı bir müfredat kararı.

---

## P2 — Kalite, acil değil

### 8. Açı sorularının diyagramı yok

Kullanıcının bulgusu. Year 5/6 geometri LLM'de:

- *"An angle on a straight line is split into 115 degrees and angle a"*
- *"Three angles on a straight line are 55°, 72° and x"*

Becerinin kendisi *doğruyu görmek*. Diyagramsız bu soru `180 - 115` oluyor — açı öğretmiyor,
çıkarma soruyor. Hem soruya hem yardımına görsel gerekiyor (kullanıcının önerisi).

### 9. Para, parasız öğretiliyor

`src/lib/gemini.js:360-372` FAIRNESS RULES ülkeye özgü parayı tamamen yasaklıyor. Model bunu
uyguluyor ve ortaya şu çıkıyor:

- *"3 coins of value 5"* (5 yaş)
- *"Sam has 50 coins and buys a toy for 30 coins"* (7 yaş)

Yani para şapkası takmış çıkarma. Bu arada TR oturumu gerçek TL kullandı — *"Can 12 TL değerinde
bir oyuncak alıp 20 TL verdi"* — ki bu pedagojik olarak **daha iyi** ama kuralı ihlal ediyor.
`y2_money` müfredatı zaten harfiyen para birimi sembolleri hakkında.

**Öneri:** kuralı gevşet — çocuğun kendi para birimi (tr→₺, en→£). Kural "ülkeye özgü olmasın"
değil, "çocuğun bilmediği ülkeye özgü olmasın" olmalı.

### 10. Year 3 üstü istatistik, kılık değiştirmiş aritmetik

y3'ten sonra grafik şablonu yok:

> *"Jack swam 4 laps on Monday, 7 on Wednesday and 5 on Friday. How many in total?"*

Bu toplama. İstatistik konusu adına bir şey öğretmiyor.

---

## P3 — Not edildi

### 11. Year 1'de müfredat dışı çarpma

- *"3 coins of value 5"* → 15
- *"4 packets with 10 sweets in each"* → 40

Year 1'de çarpma konusu yok. Model, "toplama" başlığı altında çarpma üretiyor.

### 12. Örnekleme çeşitliliği düşük

İki 9 yaş oturumu da `142 × 6 = ?` üretti; iki 11 yaş oturumu da `3432 ÷ 24` üretti.
`previousQuestions` kaçınma listesi tek başına yük taşıyor; oturumlar arası hafıza yok.

---

## Kullanıcının sorusuna cevap: yuvarlama LLM'den mi geliyor?

Evet. `y4_place_value` / `y5_place_value` / `y6_place_value` `TEMPLATE_FOR_TOPIC`'te değil,
yuvarlama modelden geliyor.

Faydalı bir soru tipi mi? **Evet** — gerçek Year 5 müfredatı (*"Round any number up to 1,000,000"*).
Ama sayı doğrusu olmadan tamamen soyut: çocuk bir kural ezberliyor, "hangisine daha yakın"
sezgisini kurmuyor. Doğru çözüm bir **sayı doğrusu şablonu**: 582,304'ü 500,000 ile 600,000
arasında bir çizgide göster, çocuk hangi uca yakın olduğunu görsün. Bu aynı zamanda 5 numaralı
ayırıcı sorununu da çözer (şablon kendi biçimlendirmesini yapar).

---

## Sabah iş planı

### A1 — Yayına alındı (saat + yerleşim)

1. **P0/1** `flexShrink: 0` — soru kartı, şekil/sayma sarmalayıcıları, `ClockFace` svg,
   `Pictogram` kökü. `MathScreen.jsx`, `ClockFace.jsx`.
2. **P1/3** Yardım kapanınca ve soru değişince kaydırma başa alınıyor — `MathScreen.jsx`,
   `[qIdx, helpVisible]` üzerine bir `useEffect`.
3. **P0/2** `DraggableClock` artık 12:00'den başlıyor; sorunun saati yanında küçük statik
   kadran olarak "Sorudaki saat" başlığıyla duruyor. `span`/`later` eskisi gibi (orada
   başlangıç saati zaten soruda). Yönergeler "önce soruya benzet" diye yeniden yazıldı,
   sıfırlama etiketi `Başa dön` / `Start over` oldu.

### A2 — Yazıldı ve doğrulandı, push bekliyor

Batu'nun bulgularıyla birlikte ele alınacak diye ayrı tutuldu.

4. **P1/4** `refersToMissingVisual()` muhafızı `isUnreadable()` yanına kondu ve LLM yolunda
   uygulanıyor; prompta da "HİÇBİR ŞEY ÇİZİLMİYOR" kuralı eklendi (`gemini.js`).
5. **P1/5** `stripGroupSeparators()` `numeralise()` içine katıldı. Yalnız tam üçlü gruplara
   dokunuyor, ondalık bozulmuyor (EN `3.75`, TR `3,75` korunuyor).

Ek not (4): reddedilen soru **atılmıyor**, cevabı tutmayan sorularla aynı şablon-dolgu
yolundan geçiyor. Aksi hâlde Year 4+ istatistik oturumları her seferinde bir soru kısalırdı —
o konunun kendi grafiği olmadığı için model neredeyse her defasında bir grafiğe uzanıyor.
Konunun şablonu yoksa dolgu boş döner ve soru yine düşer; Year 4+ istatistik için grafik
şablonu gelene kadar bu risk duruyor (B listesinde).

**Doğrulama — hepsi geçti:**

- `npm run build` → exit 0, `npm run i18n:check` → exit 0.
- 390×664 tarayıcı turu, saat sorusu: `clockH` **26 → 168px**; yardım çıktısı artık
  `12:00 / 12 o'clock` (çocuğun başlangıcı, cevap değil) ve yanında "Sorudaki saat" kadranı;
  yardım kapanınca `scrollTop 66 → 0`, `fullyVisible: false → true`.
- `later` şeklindeki bir saat sorusunda kontrol edildi: orada kadran hâlâ sorunun saatinden
  başlıyor — doğrusu bu, başlangıç saati zaten soruda yazıyor.
- 3 oturum × 10 soru (9en, 9tr, 11en): görünmeyen görsele atıf **0** (önce oturum başına ~1),
  binlik ayırıcı **0**, üç oturum da tam 10 soru — dolgu çalışıyor.
- `numeralise` birim kontrolü: `482,735 → 482735`, `1.250.000 → 1250000` (tr), ondalıklar
  korunuyor (`3.75` en, `3,75` tr).
- Muhafız regex'i 14 gerçek ihlalde de tetikliyor, 9 temiz soruda tetiklemiyor
  ("Sam sat at the table" mobilya, `grafiğe`/`grafikte` Türkçe ekleri dâhil).

### A3 — Karar verildi ve yayına alındı (çoktan seçmeli)

Karar, LearnLM'in 10 yaş için ürettiği iki soru setiyle (EN + TR) karşılaştırma sonrası
verildi. İkisinde de tam **3/10** soru sayı tuş takımına sığmıyordu — yani bu bir yeniden
yazım değil, %30'luk bir ek. İkisinde de çıplak dört işlem sorusu yoktu.

6. **Şıklı format ikinci cevap şekli oldu.** `format: 'choice'` + `options: [{value, why}]`,
   `correct_answer` kazanan şıkkın kendi metni. Gerekçe: sayı tuş takımı, cevabı tek bir tam
   sayıya indirgenemeyen her soruyu konudan siliyordu — bir yıllık kesir müfredatı bu yüzden
   "12'nin 1/3'ü" olarak çıkıyordu.
7. **Çelduruc anatomisi kural oldu:** 2 gerçek kavram yanılgısı + 1 yakın sayı. Eleme ile
   bulunamasın diye. Kesirlerde: paydaları da toplamak (5/16), toplama yerine çıkarmak,
   bir fazla saymak.
8. **Her şık kendi `why`'ını taşıyor.** 5/16 seçen çocuk *tek bir* hata yaptı ve genel ipucu
   adımları o hatanın adını koymuyor. Yanlış şıkta genel rehber değil, o şıkkın açıklaması
   açılıyor.
9. **Tek dokunuş, tek deneme, tekrar hakkı yok.** Cevap zaten ekranda; ikinci tahmin garanti
   geme giden dört dokunuştan ibaret olurdu. Tekrarın yerini "ne yaptığının söylenmesi" alıyor.
   `guessRound` ilerlemiyor, 9 yaş altı yardım paneli bu yolda devreye girmiyor.
10. **Kâğıt modu şıklı soruyu senkron olarak sayısala çeviriyor.** Şıklı soru basılamaz —
    çocuk harf yazar, fotoğraf değerlendirmesi çöker. Oturum mod seçilmeden önce kuruluyor
    (yükleme ekranını atlanabilir kılan şey bu), o yüzden takas `adoptSession`'da. Şablonlar
    senkron üretildiği için bedava. Aynı zamanda ekran/kâğıt ayrımının ilk taşı.
11. **Yalnız Year 3 ve üstü.** Aynı paydalı toplama ve birim kesir karşılaştırması müfredata
    orada giriyor. Ada (Year 2, band 2) bu soruları görmüyor; ilk karşılaşacak olan Batu.

İlk şekiller `fraction-of-number` şablonunda: `addSame` (2/8 + 3/8) ve `compare`
(1/4, 1/3, 1/2, 1/5'ten hangisi büyük). `timeTemplate`'in banda göre şekil seçme kalıbı
izlendi. 1600 üretimde şık tekrarı yok, doğru cevap hep şıklar içinde, band ≤2'de hiç
şıklı soru çıkmıyor.

### A4 — Şıklı format genişledi + saat yardımı kapandı (2. tur)

12. **Kesir ↔ ondalık denkliği (Year 4+).** `y4_fractions`'ın tanımı "1/4=0.25, 1/2=0.5,
    3/4=0.75"u açıkça istiyordu ve şablonda hiç yoktu. Çelduruclar: kesri rakam rakam okumak
    (`4/5`→`0.45`), alt sayıyı virgülden sonra yazmak (→`0.5`), basamak kaydırmak (→`0.08`).
    Yakın miss her zaman doğru cevapla aynı yazım şeklinde, ki şıkkın biçiminden elenmesin.
    Band ≥5'te beşliler de giriyor. Canlıda doğrulandı (yaş 10, TR).
13. **Şekil adlandırma (Year 4+).** "Bu şeklin adı nedir?" — şekil çizili, şıklar isim.
    Bu dosyanın geometri notu tam da bunu eleştiriyordu ("çocuğun 'beşgen' kelimesiyle
    tanışıp tanışmadığını ölçer"); şekli çizmek onu çözüyor, çünkü cevap sayılabilir ve
    yanlış şık bunu söyleyebiliyor ("beşgen demek 5 kenar demek, bunu say — 3 kenarı var").
    **Kare ile dikdörtgen asla birbirine karşı şık olmuyor:** kare gerçekten bir dikdörtgendir,
    yanlış demek yalan olurdu. Canlıda doğrulandı (yaş 9, TR).
14. **Saat yardımındaki okunuş satırı kapandı.** Ada'nın bulgusu: yardımda saat doğrudan
    yazıyordu. Kollar önceki turda 12:00'a sıfırlanmıştı — ama rehber metni çocuğa "önce
    soruya benzet" diyor, benzettiği anda altındaki `11:05 — 11'i 5 geçiyor` satırı
    "saat 11'i kaç dakika geçiyor?" sorusunu cevaplıyordu. Satır artık yalnızca `h24`,
    `span`, `later` şekillerinde duruyor: orada söylediği saat cevap değil, iskele.
15. **Saat dokununca büyüyor.** 168px kadran telefonda küçük. Hem sorudaki hem yardımdaki
    "Sorudaki saat" kadranı tam ekran açılıyor, dakika sayıları (5, 10, 15…) açık.
    Overlay `document.body`'ye portal'lanıyor: soru kartı `scaleIn ... both` ile animasyonlu,
    kalan transform `position: fixed`'i kartın içine hapsediyordu.

### B — Birlikte karar verelim

- Ekran modu aritmetik büyüklüğü: karalama alanı mı, sınır mı, sütun göstericisi mi? (6)
- Year 1 için ölçme şablonu (saat + uzunluk + kütle + hacim + para) — 7'nin gerçek çözümü
- Year 4+ zaman konusu geri gelsin mi? (7) — şıklı format 16:15 gibi cevapları mümkün
  kıldığı için bu soru yeniden açıldı; artık "kadranı sürükle" tek seçenek değil.
- Açı diyagramı: şablon mu, LLM'e görsel şeması mı? (8)
- Yuvarlama için sayı doğrusu şablonu? (yukarıdaki bölüm)
- Year 3 üstü istatistik için grafik şablonu? (10)
- LLM'in de şıklı soru yazması: çelduruc anatomisi ve birim gerçekçiliği prompta nasıl
  girecek? (Şu an şıklı soru yalnızca şablonlardan geliyor.)
- **Türkçe ondalık ayracı.** Türkiye'de `4/5 = 0,8`; uygulama her yerde nokta kullanıyor
  (sayı tuş takımındaki tuş da `.`). Virgüle geçmek tuşu, puanlama normalizasyonunu ve
  LLM'in ürettiği soru metinlerini kapsayan bir i18n işi — Ada'nın defterindeki yazımla
  çakışıyorsa ayrı iş olarak alınmalı.
- **`y5_geometry` şablona bağlı değil.** `mathCurriculum.js` yalnızca `y1_shapes`,
  `y3_geometry`, `y4_geometry`'yi `geometry`'ye eşliyor; Year 5 geometri hâlâ LLM'e gidiyor,
  yani 10 yaşında şekil adlandırma sorusu hiç çıkmıyor.

**Kapandı:** Para politikası (9) — yerel para birimine izin verildi, yasak olan sikke
*isimleri*. EN dolar (`$15`), TR lira (`15 TL`). `gemini.js`, commit `abe4001`.

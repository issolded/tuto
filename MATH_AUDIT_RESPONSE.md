# 100 soruluk matematik denetimine cevap

**21 Eylül 2026 tarihli "Tuto — İngilizce 100 soru denetimi" raporuna karşılık.**
Yazıldığı an: 22 Eylül 2026, `main` üzerinde `843940c`.

Rapordaki sekiz bulgunun her biri kodda arandı. Bu dosya her biri için üç şeyi söyler:
**doğrulandı mı**, **düzeltildiyse hangi commit**, düzeltilmediyse **neden ve ne gerekiyor**.

Sonunda raporun kendisinin görmediği bir yapısal bulgu var (§3); denetimin bulgularının
neden o yaşlarda çıktığını açıklıyor ve bence raporun en önemli sonucu odur.

---

## 1. Bulgu bulgu durum

| # | Bulgu | Öncelik | Durum |
|---|---|---|---|
| 1 | Konu etiketi ile üretilen beceri uyuşmuyor | yüksek | ✅ `843940c` |
| 2 | 11-13 yaş başlangıçları ayrışmıyor | yüksek | ⬜ açık — veri kararı, §2.2 |
| 3 | Aynı oturumda zorluk çok geniş | orta/yüksek | 🟡 yarısı `01405e6` |
| 4 | Matematik dili ve koşullar | yüksek | ✅ `843940c` (iki parça) |
| 5 | Yanlış cevap sonrası öğretim sınırlı | yüksek | ⬜ açık — ürün kararı |
| 6 | Bulmaca erişilebilirliği | yüksek | ⬜ açık — ayrı modül |
| 7 | Çeşitlilik dar | orta | ⬜ ölçülmedi, §2.7 |
| 8 | Sayı biçimi ve sunum | orta | ✅ kısmen `843940c` |

---

## 2. Ayrıntılar

### 2.1 — Konu etiketi ✅

**Doğrulandı.** `fractionOfNumberTemplate` paydaları alt iki bant için tek liste veriyordu
(`[2, 3, 4]`). Year 1'in konusu **"Half and Quarter"** ve müfredat satırı *"a half as 1 of 2
equal parts… a quarter as 1 of 4 equal parts"* — üçte bir o satırda yok. Raporun bulduğu
`What is 1/3 of 18?` tam olarak buradan geliyordu.

**Düzeltme.** Bant başına payda:

```
Year 1        2, 4
Year 2        2, 3, 4      ← kendi satırı 1/3'ü adıyla sayıyor
Year 3-4      2, 3, 4, 5, 6, 8
Year 5-6      + 10, 12
```

Raporun *"bu sadece metin sorunu değildir"* vurgusu kabul edildi ve düzeltmenin gerekçesi
odur: konu etiketini ebeveyn raporu ve ilerleme kaydı okuyor.

**Yan bulgu.** Year 2'nin adı `Fractions: ½ ¼ ¾` iken kendi açıklaması 1/3'ü içeriyordu. Ad
`Fractions: ½ ⅓ ¼ ¾` oldu — yani rapor "etiket yanlış" derken iki ayrı etiket yanlıştı.

### 2.2 — 11-13 ayrışmıyor ⬜

**Doğrulandı, düzeltilmedi.** `ageToSchoolYear` 11 ve üstünü tek `year6`'ya yıkıyor,
`BASE_LEVEL_FOR_YEAR` Year 6'da (seviye 12) bitiyor. Üç yaş aynı müfredat, aynı seviye; 11 ve
13'te birebir aynı sorunun çıkması bunun doğrudan sonucu.

**Neden düzeltilmedi.** Düzeltmek Year 7 ve Year 8 müfredatını yazmak demek — negatif sayılar,
indisler, doğrusal denklemler, oran-orantı, olasılık. Bu bir kod değişikliği değil **içerik
kararı**; uydurulacak bir şey değil, bir kaynaktan alınması gerekiyor. KS3 düzeyinde bir
kaynak bekleniyor.

**Ara çözüm önerilmedi**, çünkü 12-13 yaşı Year 6'nın üstüne seviye ekleyerek ayırmak
`clampLevelToAge`'in kasten kaldırdığı şeyi geri getirir (dosyadaki yorum bunu anlatıyor:
seviyenin yıl içinde gezinmesi "31099 + 17807"i yedi yıldızla yan yana koymuştu).

### 2.3 — Oturum içi zorluk aralığı 🟡

**10 yaş yarısı doğrulandı ve düzeltildi.** Raporun verdiği örnek — `2 × 2` ve `3 × 10`'un
yüzde, yuvarlama ve açı sorularıyla aynı sette olması — bir tesadüf değil, bir eşik hatasıydı:

`multiplicationWordTemplate` tablolarını `Number(level) >= 10` ile seçiyordu. Ama **bir yıl iki
rung sahibi**: `clampLevelToAge` 10 yaşı `[9, 10]` bandına koyuyor. Eşik Year 5'in bandını tam
ortadan kesiyordu — üst rungda zor tablolar, alt rungda **Year 2 tabloları**. Ölçüm: seviye
9'da `2 × 2` çarpma sorularının **%3,1**'inde çıkıyordu, en küçük çarpım 4'tü.

`bandForLevel` (= `ceil(level/2)`) tam olarak okul yılına denk geliyor ve dosyadaki diğer
**bütün** şablonlar onu kullanıyor. `divisionWordTemplate` de kullanıyor, üstelik yorumunda
aynı hatanın orada düzeltildiği yazılı. Çarpma atlanmış.

Tablolar artık her yılın kendi müfredat satırından:

```
Year 1-2   2, 5, 10 tabloları
Year 3     3, 4, 8 tabloları
Year 4     12'ye kadar, henüz çalışılmayanlar
Year 5-6   tabloların ötesi: iki basamak × bir, sonra iki × iki
```

Ölçüm: Year 5'te en küçük çarpım **4 → 39**, farklı çarpan çifti **30 → 609** (Year 6: 1227).

**Diğer yarısı açık.** Raporun 6 yaş örneği (iki balon sayma + 18'in üçte biri) ile
"ısınma / hedef / pekiştirme oranlarını planlayın" önerisi bir oturum tasarımı kararıdır ve
yapılmadı. Üçte bir kısmı §2.1 ile ortadan kalktı; sayma ile kesirin aynı sette olması kalıyor.

### 2.4 — Matematik dili ✅ (iki ayrı düzeltme)

**"A straight line has 2 angles."** Model yazmış, ve raporun dediği gibi yanlış. Prompt'ta
zaten "çizilmemiş bir şeye atıf yapma" kuralı vardı; eksik olan, **şekli kelimeyle anlatırken
doğru bir önerme bırakma** kuralıydı. Eklendi, raporun önerdiği düzeltme birebir örnek olarak
konuldu ve üçgen/dörtgen/nokta etrafı için genelleştirildi.

Not: bu soru `mathVerify.js`'ten geçmişti ve geçmesi doğru — cevabı (135) doğru. **Doğrulama
cevabı kontrol eder, önermeyi değil.** Bu ayrımın kendisi §3'ün konusu.

**Paylaştırma şablonu.** `Mia has 45 candies. Shared equally among 5 teammates. How many
each?` — bir cümle, sonra öznesi olmayan bir sıfat-fiil, sonra ismi olmayan bir soru.
Raporun teşhisi ("eksik cümleler", "düzeltme şablon düzeyinde yapılmalı") kabul edildi.

Yeni: `Mia shares 45 candies equally among 5 teammates. How many does each get?`

Raporun önerdiği metin biraz daha uzundu; en uzun kelime kombinasyonuyla ölçüldü ve **77
karakter** çıktı — 7 yaşın 90 karakterlik okuma sınırının altında, o yüzden aynen alındı.
Türkçe ve İspanyolca zaten tam cümleydi, dokunulmadı.

### 2.5 — Yanlış cevaptan sonra öğretim ⬜

**Doğrulandı, düzeltilmedi.** Davranış raporun anlattığı gibi: ret ve puanlama tutarlı,
açıklama ve yeniden deneme yok.

Bu bir ürün kararı — açıklama mı, benzer bir soru mu, yeniden deneme mi, ve değerlendirme
puanı ile öğrenme denemesinin nasıl ayrı kaydedileceği. Aynı bulgu 20 Eylül tarihli çocuk
deneyimi raporunda da **G05** olarak var; ikisi aynı işi tarif ediyor.

### 2.6 — Bulmaca erişilebilirliği ⬜

**Ayrı modül, bu turda ele alınmadı.** Raporun iki ayrı şey söylediğini not ediyorum:

- **Adsız button / görselin metinle erişilebilir olmaması** — teknik, kapatılabilir.
- **Uğur böceği sorusu** (`trait:wings`) — bundan farklı ve daha ciddi: soru saf görsel
  muhakeme olarak sunuluyor ama çizimden çözülemiyor, dış bilgi istiyor. Raporun *"bunu saf
  görsel NVR olarak değerlendirmeyin"* uyarısı doğru ve bu bir üretici kuralı sorunu.

### 2.7 — Çeşitlilik ⬜

**Ölçülmedi.** Raporun kendi sınırı burada doğru: *"bu test aynı çocuğun tekrar önleme
mekanizmasını ölçmedi."* Tek oturumlardan çeşitlilik hakkında hüküm çıkarılamaz.

Yan not: §2.3'ün düzeltmesi çarpma çeşitliliğini Year 5'te 30'dan 609'a çıkardı, yani
raporun gördüğü tekrarın bir kısmı aynı eşik hatasındandı.

### 2.8 — Sayı biçimi ✅

**Doğrulandı ve düzeltildi.** Beş basamak ve üstü sayılar artık yerel biçimde:
`4,200,000` (en) / `4.200.000` (tr, es). Soruda, ipuçlarında ve prompt kuralında.

**Bu düzeltmenin altında bir tuzak vardı ve rapor onu göremezdi.** `MathScreen` sayıları soru
metninden **geri ayrıştırıyor** (`/\d+/g`) — görsel yardımı seçmek için. Ayırıcı eklendiğinde
`4,200,000 + 1,000` beş sayıya bölünüyor ve ilki `4` oluyor. Yani prompt kuralını tek başına
eklemek yeni bir hata açardı.

Bütün okumalar tek yardımcıdan (`numbersIn`) geçiyor artık, ve ayırıcıyı yalnız **arkasından
tam üç rakam geldiğinde** siliyor — böylece `8.4 - 3.2` ve `0.75` dokunulmuyor, Türkçe
`1.500` doğru biçimde 1500 oluyor.

Eşik beş basamak: `7155` ayırıcısız kalıyor, İngiliz ilkokul yazımına uygun.

Raporun bu başlık altındaki diğer maddeleri (geometri çizimleri, bulmaca şık etiketleri,
hazırlama ekranı ilerleme göstergesi) yapılmadı.

---

## 3. Raporun görmediği yapısal bulgu

Rapor *"üretim kaynağı bulgusu"* başlığında şunu ölçmüş: 80 matematik kaydının 39'u template,
41'i llm; **11, 12 ve 13 yaşın toplam 30 sorusunun tamamı llm**. Ve doğru şekilde
"bu bir hata kanıtı değildir" demiş.

Kod tarafından bakınca bunun sebebi görünüyor. Müfredattaki 49 konunun kaçının şablonu var:

| yıl | şablonlu | şablonu olmayanlar |
|---|---|---|
| Year 1 | 5/6 | Measurement |
| Year 2 | 8/9 | Money |
| Year 3 | 8/10 | Numbers to 1000, Measurement |
| Year 4 | 6/9 | Numbers to 10.000, Area & Perimeter, Data & Time Graphs |
| Year 5 | 4/8 | Numbers to 1.000.000, Decimals & Percentages, Geometry & Angles, Statistics |
| **Year 6** | **0/7** | **hepsi** |
| | **31/49 (%63)** | |

11, 12 ve 13 yaşın üçü de Year 6'ya düşüyor ve **Year 6'nın hiç şablonu yok.** Raporun
"30 sorunun tamamı llm" ölçümü bir gözlem değil, bu tablonun kaçınılmaz sonucu.

Ve raporun bulgularının yaş dağılımı bu tabloyu birebir takip ediyor:

| yaş | şablon kapsamı | denetimde çıkan |
|---|---|---|
| 6-8 | %83-89 | iki ifade kusuru (§2.1, §2.4) |
| 9-10 | %50-67 | `2 × 2`, `3 × 10` |
| 11-13 | **%0** | yanlış matematik önermesi, üç yaşın birebir aynı olması |

**Sonuç:** raporun bulduğu içerik hatalarının tamamı, şablonun olmadığı yerde. `mathVerify.js`
modelin cevabını iki aşamada denetliyor ve iyi çalışıyor — bu 100 soruda hiç cevap anahtarı
hatası çıkmamasının sebebi odur. Ama doğrulama **cevabı** kontrol eder, **önermeyi** değil;
`A straight line has 2 angles` doğru cevaplı bir yanlış önermedir ve doğrulamadan geçer.

Önceliğimiz bu yüzden Year 6'nın yedi şablonu. Raporun 1. ve 2. sıradaki önerileriyle
(konu-soru uyumu, 12-13 politikası) aynı yöne bakıyor ama sebebe bir kat daha iniyor.

---

## 4. Düzeltmeleri doğrulamak

```bash
git log --oneline 7328d1b..843940c        # bu turun iki commit'i
npm run dev                               # sonra /math-lab
```

`/math-lab` konu ve seviye seçicili; denetimde geçen her durum orada yeniden üretilebilir:

| kontrol | nasıl |
|---|---|
| §2.3 çarpma bandı | `multiplication-word`, seviye 9 ve 10 — en küçük çarpım 39 |
| §2.1 Year 1 kesirleri | `fraction-of-number`, seviye 1-2 — yalnız 1/2 ve 1/4 |
| §2.4 paylaştırma | `division-word`, herhangi bir seviye |
| §2.8 sayı biçimi | `addition`, seviye 11 — `31,592 + 16,000`; "Show help" ile ipucu da aynı biçimde |

Uyarı: **matematikte otomatik bir denetim betiği yok.** İngilizce modülünde
`npm run english:check` altı bant-varyant kombinasyonunu tip başına 300 soruyla tarıyor;
matematikte karşılığı olsaydı `2 × 2`, Year 1'deki `1/3` ve binlik ayırıcı bulunurdu. Binlik
ayırıcı bulgusu 21 Ağustos tarihli `MATH_AUDIT.md` raporunda da vardı (madde 5) ve bir ay
sonra yeniden bulundu; aradaki fark tam olarak bu betiğin yokluğu.

---

## 5. Denetime iki not

**Yöntem iyiydi.** Özellikle şu cümle: *"Bu 99/100 testçinin gönderdiği yanıtların puanıdır.
Sistem doğruluğu %99 değildir."* Aynı şekilde kanıt etiketleri, kapsam dışı bırakılanların
açıkça sayılması ve "bu bulgu şunu kanıtlamaz" ayrımları. Bulguları kovalarken hiçbirini
yeniden doğrulamak zorunda kalmadım; hepsi kodda anlatıldığı yerdeydi.

**İki şeyde şüphelendim, ikisinde de yanıldım** — kayda geçsin:

- `If Leo has $10 and spends $3` — İngiliz müfredatında dolar tuhaf geldi. Kasıtlı:
  `en → "$15"`, `tr → "15 TL"`, `es → "15 €"`. Yerleşik karar.
- `Harry pays with $20 for a $13 toy` sorusu **Measurement** başlığı altındaydı; §2.1'in aynısı
  sandım. Year 3 Measurement'ın açıklaması aynen *"Add and subtract amounts of money to give
  change"* ile bitiyor. Tam yerinde.

**Bir sonraki tur için.** Raporun kendi sınırlarını göz önüne alarak en çok şunlar değer
katar: (a) aynı çocukla art arda oturumlar — tekrar önleme hiç ölçülmedi, (b) kâğıt/fotoğraf
modu — kapsam dışıydı ve orada bilinen bir P0 var (fotoğraf hatası yanlış cevap olarak
kaydediliyor, 20 Eylül raporu G06), (c) Year 6 şablonları yazıldıktan sonra 11-13 yaşın
tekrarı.

---

## 6. Sırada: İngilizce modülü de denetime hazır

Matematik denetimi sürerken ikinci bir modül tamamlandı ve aynı gözle bakılması isteniyor.
**Tam handoff dokümanı ayrı bir dosyada: [`ENGLISH_AUDIT.md`](ENGLISH_AUDIT.md).** Burada
yalnız denetime başlamak için gereken minimum var.

### Ne olduğu

Üç yaş bandı (8-9, 9-10, 11-12) için **19 tip** çoktan seçmeli İngilizce/sözel muhakeme
sorusu: eşanlam, zıt anlam, kafiye, hece, gizli kelime, kelime zinciri, sınıflandırma,
tekil-çoğul, ek-kök, imla, homofon ve diğerleri. Kaynak: Bond 11+ kitapları (8-9 10 Minute
Tests, 9-10 Assessment Papers, 11-12 10 Minute Tests).

Matematikten **farkı ve denetim açısından önemi**: soru üretiminde model yok. Sorular
WordNet 3.0 + IPA telaffuz sözlükleri + frekans verisinden **deterministik** üretiliyor.
Yani buradaki bir hata istatistiksel bir sapma değil, tohumdan yeniden üretilebilir bir
kural hatası — bulunduğunda birebir tekrarlanabilir.

Kasıtlı iki karar:
- **Okuma parçası yok.** Ürün kararı; sorular tek satırlık.
- **İki İngilizce varyantı** (`uk` / `us`) hem imlayı hem telaffuzu değiştiriyor —
  `colour/color` ama aynı zamanda hangi kelimelerin kafiyeli sayıldığını da.

### Nasıl bakılır

```bash
npm run english:check    # 6 bant×varyant taraması, tip başına 300 soru, hata varsa non-zero
npm run dev              # sonra /english-lab
```

`/english-lab` dört görünüm taşıyor: **grid** (soru üret ve gez), **audit** (tarama
sonuçları), **words** (bir kelimenin sözlükteki bütün kaydı — eşanlam, zıt, telaffuz,
frekans, hangi kapıdan geçtiği), **coverage** (tip × bant havuz büyüklükleri).

Bant ve varyant düğmeleri üstte. Her soru tohumuyla birlikte gösteriliyor.

### Nereye bakılmasını istiyorum

`ENGLISH_AUDIT.md` §8 **hiç kontrol edilmemiş olanları** açıkça listeliyor; denetim en çok
orada değer katar. Özeti:

| | |
|---|---|
| §8.1 | **Hiçbir çocuk bunu görmedi.** Tek test kaynağı benim körlemesine çözmem. |
| §8.2 | Zorluk **eğrisinin şekli** doğrulanmadı — bantlar birbirinden gerçekten ayrışıyor mu |
| §8.3 | Üç tip ince (`odd-two` 39 grup, `suffix` %20 verim) |
| §8.4 | Cümleler bantlanmamış — 8-9 ile 11-12 aynı cümle havuzunu görüyor |
| §8.5 | Bilinen kalıntı: kapılardan geçmiş ama tartışmalı kelimeler |
| §8.6 | **Hiçbir yere bağlı değil** — lab canlı, çocuk ekranı yok |
| §8.7 | Varyant (uk/us) ayarının nerede duracağı ve varsayılanın doğru olup olmadığı |

Ve denetim yaparken bilinmesi gereken bir sınır: **cevap "tartışılabilir" olabilir.** WordNet
bir sözlük değil bir anlam ağı; `validateItem` her soruda tek savunulabilir cevap olduğunu
kanıtlamaya çalışıyor ama bunun bir kapsamı var. Bir soru için "ben olsam B derdim" diyorsanız
bu **bulgudur** ve tohumuyla birlikte yazılması yeterli — ben o tohumdan sorunun hangi kapıdan
kaçtığını bulabiliyorum.

Matematik denetiminin yöntemi (kanıt etiketleri, kapsam dışı bırakılanların sayılması, "bu
bulgu şunu kanıtlamaz" ayrımı) burada da aynen isteniyor.

# Matematik motoru — denetim devri

**Ne değişti:** matematik soruları artık modelden değil, deterministik şablonlardan geliyor.
**Ekran modunda, 5'ten 13'e kadar her yaşta, model hiç çalışmıyor** — ne soru üretiminde ne
cevap doğrulamada. Müfredat kapsamı 57/57.

Bu dosya o motoru denetlemek için yazıldı. Ne olduğunu, nasıl çalıştırılacağını, nereye
bakılmasını istediğimi ve **kimsenin kontrol etmediği yerleri** söyler.

Yazıldığı an: 23 Eylül 2026, `main` üzerinde `fe883b9` sonrası.
Önceki iki doküman hâlâ geçerli: [`MATH_AUDIT_RESPONSE.md`](MATH_AUDIT_RESPONSE.md)
(21 Eylül denetimine cevap) ve [`ENGLISH_AUDIT.md`](ENGLISH_AUDIT.md) (İngilizce modülü).

---

## 1. Önce: 22 Eylül denetimi hangi kodu gördü

Rapor `95339aa`'yı incelemiş. O commit'ten sonra dört commit girdi ve matematik bölümünün
bir kısmı geçersiz kaldı. Tekrar bulgu yazılmaması için açıkça:

| raporun gördüğü | bugün |
|---|---|
| "Matematik 11: 10 LLM" | 11 yaş **10 şablon, 0 LLM** |
| "11-13 ayrışması: bu turun kapsamı dışında" | `year7` gerçek bir yıl; 12 ve 13 oraya düşüyor |
| M-F01 büyük sayı ayırıcısız (örnekler 10 ve 11 yaş, **ikisi de LLM**) | o iki konu artık şablonda, `num()`'dan geçiyor. Kalan LLM yolunda **açık** |
| M-F02 açı önermesi varsayım gerektiriyor | düzeltildi (`683a325`) — aşağıda §6 |

Raporun **açık kalan** matematik bulguları — bunlar hâlâ geçerli, tekrar bulmaya gerek yok:
M-F03 (yanlış cevap öğretime dönüşmüyor), M-F04 (oturum içi zorluk dalgalanması),
M-F05 (`a 800 ml` → `an 800 ml`, LLM cümlesi), P-F01/P-F02 (bulmaca erişilebilirlik ve
çeşitlilik).

---

## 2. Modelden ne kadar kurtulduk — ölçüm

10 soruluk bir oturumda kaç sorunun şablondan geldiği, yaş başına 2.000 oturum simüle
edilerek:

| yaş | yıl | şablon | LLM |
|---|---|---|---|
| 5-6 | Year 1 | 10.0 | **0** |
| 7 | Year 2 | 10.0 | **0** |
| 8 | Year 3 | 10.0 | **0** |
| 9 | Year 4 | 10.0 | **0** |
| 10 | Year 5 | 10.0 | **0** |
| 11 | Year 6 | 10.0 | **0** |
| 12-13 | Year 7 | 10.0 | **0** |

Cevap doğrulaması da düştü: `findBadAnswers` yalnız modelden gelen slotlar için çalışıyordu,
onlar kalmadı. `generateCurriculumQuestions` çağrı yeri kodda duruyor ama **ölü** — bir konu
eşlemesi kaldırılırsa devreye giren emniyet ağı.

**Modelin kalmaya devam ettiği yerler:**
- **Kağıt modu.** Her yaşta. Gemini el yazısını okuyor (`evaluateMath`). Orada model soru
  üretmiyor, **görüyor**; yerine konacak bir şey yok.
- Uygulamanın matematik dışı yerleri: okuma (`identifyCover`), hikâye (`readStory`,
  `checkTitleSpelling`), sunucudaki ödev ve hikâye üretimi, ebeveyn sohbet katmanı. Bu devrin
  dışında.

## 3. Müfredat kapsamı

`npm run math:check` her çalıştığında bu tabloyu basıyor:

```
✓ year1   6/6      ✓ year5   8/8
✓ year2   9/9      ✓ year6   7/7
✓ year3  10/10     ✓ year7   8/8
✓ year4   9/9      ── toplam 57/57 (%100)
```

Müfredat verisi `src/lib/gemini.js` içinde `BRITISH_CURRICULUM`. Year 1-6 ulusal
müfredattan; **Year 7 yeni** — KS3 programından alınıp Bond'un *11+-12+ Maths 10 Minute
Tests* kitabıyla satır satır karşılaştırıldı. Year 8 **bilerek yok**: 13 yaş şimdilik Year
7'yi paylaşıyor, çünkü bir yılı hafızadan uydurmak tam olarak bu verinin engellemek için
var olduğu şey.

---

## 4. Eşlemeler

Bir müfredat konusu tam olarak **bir** şablona eşleniyor (`TEMPLATE_FOR_TOPIC`,
`src/lib/mathCurriculum.js`) ve şablon hangi konuyu doldurduğunu **bilmiyor**. Bu yapısal
sınır hâlâ duruyor ve bir kez ısırdı:

`y5_statistics` bir süre `averages` şablonuna bağlıydı. Year 5'in satırı *"çizgi grafikteki
bilgiyle karşılaştırma, toplam ve fark problemleri; bir tablodaki bilgiyi tamamla"* diyor —
ortalama orada geçmiyor, Year 6'da geçiyor. Yani 10 yaşındaki bir çocuk, etiketi "çizgi grafik
ve tablo" diyen bir konunun altında ortalama sorusu alıyordu. Bu, 21 Eylül denetiminin 1.
bulgusunun aynısı.

`npm run math:check` artık **eşlemenin kendisini** denetliyor: şablonun konusundan en az bir
kelime, müfredat konusunun adında ya da tarifinde geçmek zorunda. Muafiyetler gerekçesiyle
birlikte listeli (bugün tek muafiyet `y1_fractions` — adı "Half and Quarter", yarım ve çeyrek
kesirdir ama "fraction" kelimesi geçmez).

## 5. Nasıl çalıştırılır

```bash
npm run math:check     # tam denetim; hata varsa non-zero döner
npm run dev            # sonra /math-lab
```

`MATH_AUDIT_N=1000 npm run math:check` örneklemi büyütür (varsayılan 400).

**`/math-lab`** konu ve seviye seçicili, menülerden linkli değil. Her soru için ham problem
nesnesini de açabiliyor (`Raw problem object`). Çoktan seçmeli sorularda şıkları ve seçilen
şıkkın **gerekçesini** gösteriyor — bu bölüm 22 Eylül'de eklendi; öncesinde lab şıklı
soruyu hiç gösteremiyordu, yani aylardır duran kesir şablonları da orada test edilemiyordu.

Seviye ↔ yıl karşılığı: `bandForLevel(level) = ceil(level/2)`, ve bir yıl **iki basamak**
sahibi. Year 6 = 11-12, Year 7 = 13-14. Bir yaşı denemek için o yılın üst basamağını seç.

| yıl | seviye |
|---|---|
| Year 1 | 1-2 |
| Year 2 | 3-4 |
| Year 3 | 5-6 |
| Year 4 | 7-8 |
| Year 5 | 9-10 |
| Year 6 | 11-12 |
| Year 7 | 13-14 |

Canlı: <https://tuto-blue.vercel.app>. Sunucu bileşenlerinin bu commit'i çalıştırdığı
doğrulanmadı — kaynakta görülen düzeltme ile canlıda görülen davranış ayrı ele alınmalı.
(Önceki rapor bu ayrımı doğru yapmıştı, aynen korunsun.)

---

## 6. Şablonlar

20 şablon, `src/lib/mathTemplates.js`. Onu son 48 saatte yazıldı, ikisi genişletildi.

| şablon | hangi yıllara | ne üretiyor |
|---|---|---|
| `counting` | Y1-2 | sayma, sıradaki sayı |
| `addition` / `subtraction` | Y1-5 | zihinden ve sütun |
| `multiplication-word` | Y2-7 | tablolar, sonra iki basamak × iki |
| `division-word` | Y2-7 | eşit paylaştırma; Y6+ iki basamaklı bölen |
| `long-mult-div` | Y6 | yukarıdaki ikisinin birleşimi (konu ikisini birden adlandırıyor) |
| `fraction-of-number` | Y1-7 | kesir, ondalık, **yüzde alma, yüzde artış/azalış, sadeleştirme, farklı paydalı toplama** |
| `geometry` | Y1-7 | kenar/köşe; Y5+ **açılar ve alan** |
| `pictogram` | Y2-3 | piktogram okuma |
| `place-value` | Y4-7 | **yuvarlama, basamak değeri, sıfırı geçen aralık, ondalığa yuvarlama** |
| `algebra` | Y6-7 | **sayı tutma, yerine koyma, denklem, benzer terim, x cinsinden ifade** |
| `ratio` | Y6-7 | **sadeleştirme, oranla paylaştırma, doğru orantı, hız-yol-zaman, birim dönüşümü** |
| `averages` | Y5-7 | **ortalama, ters ortalama, ortanca, mod, açıklık, olasılık** |
| `number-properties` | Y7 | **çarpan, asal, EKOK, kare, küp, karekök** |
| `sequence` | Y7 | **dizi devamı, konum-terim kuralı, fonksiyon makinesi** |
| `time` | Y2-3 | saat okuma |
| `money` | Y2 | **bozuk para toplama, para üstü, kaç tane X eder** |
| `measurement` | Y1, Y3 | **uzunluk/kütle/hacim karşılaştırma, birim dönüşümü, çevre**; Y1'de saat ve para da |
| `area-grid` | Y4 | **ızgarada L şeklinin alanı ve çevresi — kareler sayılarak** |
| `chart` | Y4-5 | **sütun grafik (Y4) ve çizgi grafik (Y5) okuma** |
| `decimals-percentages` | Y5 | **ondalık ↔ kesir ↔ yüzde, ondalık toplama/çıkarma, yuvarlama** |

**Kalın** olanlar denetlenmemiş yeni yüzey.

### Görseller

Üç konunun müfredat satırı **resmin kendisini adlandırıyor** — *"kareleri sayarak"*,
*"sütun grafik"*, *"çizgi grafik"*. Resim olmadan soru "şu sayıları çıkar"a dönüşüyor:
cevabı aynı, sorusu başka, ve etiket çocuğun görmediği bir şeyi tarif ediyor.

- `src/components/MathGeometry.jsx` — açı ve alan şemaları. **Ölçekli değil** ve bunu
  yazıyor; ekrandan ölçmeye davet etmiyor.
- `src/components/MathChart.jsx` — ızgara, sütun ve çizgi grafik. Bunlar **ölçekli** ve bunu
  belirtmiyorlar, çünkü çubuğu eksene karşı okumak zaten becerinin kendisi.

İkisinin de ortak kuralı: **sorulan değer çizimde yazmaz.** Üstüne sayıları yazılmış bir
sütun grafik, arkasında resim olan bir çıkarma sorusudur.

### Sözleşme

Bir şablon `(level, lang) → problem`. Problem üç biçimden biri:

- `numeric` — tam sayı cevap, tuş takımına yazılır
- `decimal` — ondalıklı cevap; tuş takımı noktayı **yalnız** bu biçimde açıyor
- `choice` — cevap sayı değil (`7:4`, `5/8`, `4x + 16`); her şık kendi `why`'ını taşıyor

**Tuş takımında eksi yok.** Cevabı negatif olan bir soru yazılamaz — bu yüzden negatif sayı
soruları cevabı pozitif olacak şekilde kuruluyor ("−6°C'den 2°C'ye **kaç derece yükseldi**").

`hint_steps` **cevabı söylemez**, yöntemde durur. Bu bir sözleşme, denetlenebilir bir iddia.

---

## 7. Nereye bakılmasını istiyorum

Önem sırasına göre.

### 7.1 Önerme doğruluğu — en yüksek öncelik

22 Eylül raporunun M-F02 bulgusu **bir saat önce yazdığım koda** düştü ve haklıydı:
*"3 angles meet at a point"* açıların 360 ettiğini kanıtlamıyor — bitişik olmaları ve tam
turu kapatmaları gerekiyor. Düzeltildi:

> *"4 angles sit next to each other and together they make a full turn. 3 of them are
> 23°, 99° and 49°. How many degrees is the last one?"*

**Ama bu tek bir şablonun tek bir şekli.** Aynı sınıf hata her yerde olabilir: hiçbir şey
çizilmiyor, yani cevabın dayandığı her koşulun cümlede olması gerekiyor. Şu sorularla
taranmasını istiyorum — özellikle `geometry`, `ratio` ve `averages`:

- Cevap, cümlede **söylenmeyen** bir varsayıma mı dayanıyor?
- Cümle, şeklin çizilmemiş hâli için **doğru bir önerme** mi?
- Birden fazla savunulabilir cevap var mı?

Not: `mathVerify.js` bunu yakalayamaz — cevabı denetler, önermeyi değil. Model
"A straight line has 2 angles. One is 45°" yazdığında 135 doğru cevaptı ve doğrulamadan
geçmişti.

### 7.2 Çoktan seçmeli şıkların gerekçeleri

Her yanlış şık gerçek bir yanılgıyı kodluyor ve çocuğa **o yanılgı adıyla** söyleniyor.
Bunlar bugüne kadar yalnız benim tarafımdan okundu. `/math-lab`'de şıklı bir soru seçip
yanlış bir şıkka basınca gerekçe altında çıkıyor.

Sorular: gerekçe **doğru** mu? Yaşa uygun bir dille mi yazılmış? Türkçe ve İspanyolcada
aynı şeyi mi söylüyor?

### 7.3 Yaş uygunluğu — kelime değil, **bağlam**

İngilizce modülünde bulunan bulgu (E-F03: yaş bandı kelimede kalıyor, cümlede değil)
burada da geçerli olabilir. Şablon cümleleri elle yazıldı ve yaş sınırı yalnız **karakter
sayısıyla** denetleniyor (`maxQuestionChars`: 7 yaş 90, 9 yaş 120, üstü 160).

Bakılacak: bir 11 yaşındakine "bir mont 200 lira, %20 indirimde" sorulması uygun mu? Hız,
yüzde indirimi, oranla paylaştırma — bunların dünyası çocuğun dünyası mı?

### 7.4 Üç dil

Her cümle `say(lang, en, tr, es)`'ten geçiyor. Denetim dil sızıntısını kelime listesiyle ve
Türkçe harflerle tarıyor, ama **çeviri kalitesini** ölçemez. Özellikle:

- İspanyolca cinsiyet/sayı uyumu (`¿cuántas libras?` vs `¿cuántos kilómetros?` — bu zaten bir
  kez yanlıştı ve düzeltildi)
- Türkçe ek uyumu, özellikle sayılardan sonra
- İspanyolca **es-ES** olarak seçildi (euro, `es-ES` tarih). LatAm değil.

### 7.5 Havuz büyüklüğü — bilinen zayıf noktalar

20.000 çekilişte kaç **farklı soru metni** çıktığı:

| şablon | | şablon | |
|---|---|---|---|
| `averages` L12 | 19.742 | `ratio` L12 | 8.025 |
| `long-mult-div` L12 | 19.245 | `geometry` L12 | 7.367 |
| `place-value` L12 | 15.138 | `measurement` L6 | 6.314 |
| `algebra` L12 | 12.189 | `sequence` L14 | 4.900 |
| `decimals-percentages` L10 | 11.540 | `measurement` L2 | 3.579 |
| `place-value` L6 | 8.643 | `money` L4 | 3.270 |
| **`chart` L8 / L10** | **207 / 216** | **`fraction-of-number` L12** | **800** |
| **`number-properties` L14** | **243** | **`area-grid` L8** | **12** |

Son dördü ince, ve son ikisi **bilerek** öyle: `area-grid` ve `chart` için çeşitlilik
metinde değil **resimde**. Bir alan sorusunun cümlesi her seferinde aynıdır, değişen şekildir.
Yine de cümle sayısı 2 → 12 ve 69 → 207'ye çıkarıldı, çünkü oturumun kendi tekrar koruması
(`avoidText`) **cümleye** bakıyor ve Year 4'te 9 konu 10 slota düşüyor — yani bir konu mutlaka
iki kez geliyor.

`number-properties` 65'ti (havuzlar elle listelenmişti), rakamlar rastgeleleştirildi.
`fraction-of-number`'ın yüzde şekilleri "çocuğun zihinden bulabileceği" yüzdelerle sınırlı —
bilinçli ama daraltıyor.

**Sorulması gereken:** haftada üç oturum yapan bir çocuk ne kadar sürede tekrar görür? Oturum
içi tekrar engelli, **günler arası değil** — 21 Eylül raporu 7 yaşta `1/3 of 18`'in iki gün
üst üste çıktığını göstermişti ve bu hâlâ böyle.

---

## 8. Kimsenin kontrol etmediği yerler

Bunlar sürpriz değil, bilinen boşluklar.

**8.1 Hiçbir çocuk bu soruların hiçbirini görmedi.** Yaş uygunluğu hakkındaki her iddia ya
bir müfredat satırına ya benim yargıma dayanıyor.

**8.2 Zorluk eğrisinin şekli doğrulanmadı.** Bir yıl iki basamak sahibi ve bantlar arası
geçiş `clampLevelToAge` ile kilitli. Year 6'nın gerçekten Year 5'ten zor olup olmadığı
ölçülmedi.

**8.3 Oturum tasarımı yok.** Raporun M-F04'ü açık: bir oturumda ısınma/hedef/pekiştirme
rolü yok, konular sadece dönüyor. 6 yaşta tek elma saymakla 16'nın dörtte birini bulmak
aynı sette.

**8.4 Şablon hangi konuyu doldurduğunu bilmiyor.** §4'e bakın: bu sınır bir kez ısırdı ve
şimdi bir kontrolle korunuyor, ama kontrol kelime eşleşmesine dayanıyor — kaba bir test.
Bir yılın iki konusu aynı şablona baktığında ikisi de kontrolden geçer ve etiket yarı yarıya
tutmaz. Bugün öyle bir eşleme yok.

**8.8 Görsellerin doğruluğu yalnız benim gözümle denetlendi.** `MathGeometry` ve `MathChart`
çizimlerinin metinle uyuştuğunu tarayıcıda şekil şekil karşılaştırdım ve iki grafiği çocuk
gibi okuyup cevabı doğru verdim — ama bu bir program değil. Bir çizimin yanlış ölçeklenmesi
ya da yanlış çubuğu vurgulaması `math:check`'in göremeyeceği bir hatadır.

**8.5 Kağıt modu denetlenmedi.** Bilinen bir P0 orada: fotoğraf hatası yanlış cevap olarak
kaydediliyor (20 Eylül raporu G06).

**8.6 Yanlış cevaptan sonra öğretim yok.** Ret ve puanlama tutarlı, açıklama ve ikinci
deneme yok. Ürün kararı bekliyor.

**8.7 Esnek seviye henüz yok.** Bugün bir çocuk yaşının yılına kilitli. Üstelik merdivende
ölçülmüş bir hata var: her seansta %100 alan bir çocuk **iki seansta bir "seviye atladın"
kutlaması görüyor ve sorular hiç zorlaşmıyor** — sunucu tırmanıyor, ekran yaşa kırpıyor,
ikisi birbirini iptal ediyor. Sıradaki iş bu.

---

## 9. `npm run math:check` ne yapar, ne yapmaz

Yapar: 9 yaş × 3 dil × 400 soru/konu. Şıkların tekil ve cevabı içerdiğini, metinde
`undefined`/`NaN` olmadığını, ipucunun cevabı söylemediğini, okuma sınırını, dil
sızıntısını, oturum içi tekrarı ve her yılın bir oturumu doldurabildiğini denetler.

**Yapmaz — ve bu önemli:**

- **Matematiğin doğruluğunu bağımsız olarak doğrulamaz.** Cevabı şablonun kendisi
  hesaplıyor; denetim aynı koddan okuyor. Şablonun formülü yanlışsa denetim bunu göremez.
  (İngilizce tarafında aynı eleştiri yapıldı ve orada iki bağımsız telaffuz sözlüğüyle
  çözüldü. Matematikte karşılığı **yok** — `number-properties` için 8.000 cevabı ve
  `area-grid` için 5.000 alan/çevre değerini elle yazılmış ikinci bir algoritmayla
  karşılaştırdım, ikisinde de 0 hata; **diğer şablonlar için böyle bir kontrol yapılmadı.**
  Burası denetimin en çok değer katacağı yer olabilir.)
- **Önermenin doğruluğunu denetlemez** (§7.1) ve **çizimin metinle uyumunu denetlemez** (§8.8).
- Pedagojiyi, yaş uygunluğunu, çeviri kalitesini denetlemez.
- İpucu sızıntısı kontrolü **cevabı 20'nin altında olan soruları hiç görmez** — eşik
  ölçülerek seçildi (0'da 120 bulgu, 5'te 34, 10'da 17, 20'de 0, ve 20'nin altındakilerin
  okuduğum her biri tesadüftü), ama bu Year 1'in çoğu demek.

**Eklenenler (23 Eylül):** eşleme kontrolü (§4), ve `decimal` formatının tam sayı cevapla
kullanılmaması — tuş takımının noktasını çocuğun kullanamayacağı bir soruda açıyordu.

## 10. Boşa harcanmasın

- **Kağıt modu / Gemini vision** — burada model kalacak, tartışma yok.
- **$ para birimi** İngilizcede kasıtlı (`tr` → TL, `es` → €). Daha önce bulgu yazıldı ve
  kapatıldı.
- **Year 3 Measurement altında para sorusu** doğru: o satır *"Add and subtract amounts of
  money to give change"* ile bitiyor.
- **Year 8 yok** — bilerek, kaynak beklenirken.
- §8'deki maddeler zaten biliniyor; yeniden bulgu olarak yazmaya gerek yok, ama bir
  **ölçüm** getirilirse çok değerli.

---

## 11. Commit geçmişi

| commit | ne |
|---|---|
| `e887cf6` | Year 7 müfredatı, yaş eşlemesi, `place-value`, ve `npm run math:check` |
| `ed8c07b` | `algebra`, `ratio`, iki basamaklı bölen, Year 6'nın çarpma+bölme eşlemesi |
| `2967d3a` | `averages`, `number-properties`, `sequence`, geometri açıları ve alan, kesir/yüzde genişlemesi, lab'da şık desteği |
| `683a325` | 22 Eylül denetiminin üç bulgusu (açı önermesi + iki İngilizce ses bilgisi hatası) |
| `60001a3` | bu doküman, ve `number-properties` havuzunun genişletilmesi |
| `2075a5d` | `y5_statistics` yanlış eşlemesi, `averages` cümle/değer düzeltmeleri, eşleme kontrolü; Codex'in geometri çizimleri ve ondalık şablonu |
| `fe903fd` | `money` ve `measurement` — Year 1 ve Year 2 kapandı |
| `fe883b9` | `area-grid`, `chart`, Year 3 yer değeri — **57/57, ekran modunda model bitti** |

Öncesi: `843940c`, `01405e6` (21 Eylül denetiminin dört bulgusu ve `2 × 2`).

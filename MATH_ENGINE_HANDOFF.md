# Matematik motoru — denetim devri

**Ne değişti:** matematik soruları artık büyük ölçüde modelden değil, deterministik
şablonlardan geliyor. 11, 12 ve 13 yaşta model **hiç çalışmıyor**.

Bu dosya o motoru denetlemek için yazıldı. Ne olduğunu, nasıl çalıştırılacağını, nereye
bakılmasını istediğimi ve **kimsenin kontrol etmediği yerleri** söyler.

Yazıldığı an: 22 Eylül 2026, `main` üzerinde `683a325`.
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

10 soruluk bir oturumda kaç sorunun şablondan geldiği, yaş başına 1.000 oturum simüle
edilerek:

| yaş | yıl | şablon | LLM | şablon % |
|---|---|---|---|---|
| 5 | Year 1 | 8.3 | 1.7 | 83% |
| 6 | Year 1 | 8.4 | 1.6 | 84% |
| 7 | Year 2 | 8.9 | 1.1 | 89% |
| 8 | Year 3 | 8.0 | 2.0 | 80% |
| 9 | Year 4 | 7.8 | 2.2 | 78% |
| 10 | Year 5 | 8.8 | 1.2 | 88% |
| **11** | Year 6 | **10.0** | **0.0** | **100%** |
| **12** | Year 7 | **10.0** | **0.0** | **100%** |
| **13** | Year 7 | **10.0** | **0.0** | **100%** |

**Önemli nüans:** oturum kurulumu model çağrısını **bekliyor**. 10 soruda tek bir LLM sorusu
olsa bile tam bir gidiş-dönüş bekleniyor. Yani 5-10 yaşta kazanç "sorularin %80'i şablon"
değil — bekleme ve hata ihtimali aynen duruyor. O yaşlarda asıl sıçrama son yedi konu
kapandığında olur.

**Modelin kalmaya devam ettiği yerler:**
- **Kağıt modu.** Her yaşta. Gemini el yazısını okuyor (`evaluateMath`). Şablonla ilgisi yok
  ve yerine konacak bir şey de yok — orada model soru üretmiyor, **görüyor**.
- **Şablonu olmayan 7 konu** (aşağıda §4).
- Ebeveyn mesajlaşma katmanı — ayrı sistem, bu devrin dışında.

---

## 3. Müfredat kapsamı

`npm run math:check` her çalıştığında bu tabloyu basıyor:

```
  year1   5/6   eksik: Measurement
  year2   8/9   eksik: Money
  year3   8/10  eksik: Numbers to 1000, Measurement
  year4   7/9   eksik: Area and Perimeter, Data and Time Graphs
  year5   7/8   eksik: Decimals and Percentages
✓ year6   7/7
✓ year7   8/8
  ── toplam 50/57 (%88)
```

Müfredat verisi `src/lib/gemini.js` içinde `BRITISH_CURRICULUM`. Year 1-6 ulusal
müfredattan; **Year 7 yeni** — KS3 programından alınıp Bond'un *11+-12+ Maths 10 Minute
Tests* kitabıyla satır satır karşılaştırıldı. Year 8 **bilerek yok**: 13 yaş şimdilik Year
7'yi paylaşıyor, çünkü bir yılı hafızadan uydurmak tam olarak bu verinin engellemek için
var olduğu şey.

---

## 4. Şablonu olmayan 7 konu — ikisi bilerek

Beşi gerçekten eksik: Measurement (Year 1 ve 3), Money (Year 2), Area and Perimeter
(Year 4), Data and Time Graphs (Year 4).

**İkisi bilerek bağlanmadı**, ve sebebi denetimin kendi 1. bulgusu:

- **Year 3 "Numbers to 1000"** — o yılın satırı karşılaştırma ve sıralama diyor, yuvarlama
  hiç demiyor. `place-value` şablonuna bağlasam bir sıralama konusuna yuvarlama sorusu
  etiketlerdim.
- **Year 5 "Decimals and Percentages"** — aynı yılda kendi "Fractions" konusunun yanında
  duruyor. İkisi de tek şablona bakarsa etiket yarı yarıya tutmaz.

Bir müfredat konusu tam olarak bir şablona eşleniyor (`TEMPLATE_FOR_TOPIC`,
`src/lib/mathCurriculum.js`) ve şablon hangi konuyu doldurduğunu **bilmiyor**. Bu yapısal
sınır kalkana kadar o ikisi modelde kalıyor.

---

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

16 şablon, `src/lib/mathTemplates.js`. Altısı son 24 saatte yazıldı, ikisi genişletildi.

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

**Kalın** olanlar denetlenmemiş yeni yüzey.

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

### 7.5 Havuz büyüklüğü — bilinen zayıf nokta

20.000 çekilişte kaç farklı soru metni çıktığı:

| şablon | Year 6 | Year 7 |
|---|---|---|
| `averages` | 19.844 | 16.059 |
| `long-mult-div` | 19.252 | — |
| `place-value` | 15.324 | 16.716 |
| `algebra` | 12.068 | 12.902 |
| `ratio` | 8.088 | 5.444 |
| `geometry` | 7.424 | 6.512 |
| `sequence` | — | 4.913 |
| **`fraction-of-number`** | **800** | **881** |
| **`number-properties`** | — | **243** |

Son ikisi ince. `number-properties` 65'ti, havuzları elle listelendiği için; rakamlar
rastgeleleştirildi ve 243'e çıktı — hâlâ en dar şablon. `fraction-of-number`'ın yüzde
şekilleri "çocuğun zihinden bulabileceği" yüzdelerle sınırlı (5, 10, 15, 20, 25, …), bu
bilinçli ama havuzu daraltıyor.

**Sorulması gereken:** haftada üç oturum yapan bir çocuk ne kadar sürede tekrar görür?
Oturum içi tekrar engelli (`avoidText`), günler arası **değil** — önceki rapor 7 yaşta
`1/3 of 18`'in iki gün üst üste çıktığını gösterdi ve bu hâlâ böyle.

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

**8.4 Şablon hangi konuyu doldurduğunu bilmiyor.** §4'teki iki eşlemenin yapılamamasının
sebebi bu. Aynı sınır, bir yılın iki konusu aynı şablona baktığında etiket uyumsuzluğu
riski yaratır — bugün öyle bir eşleme yok, ama yapılabilir ve fark edilmez.

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
  çözüldü. Matematikte karşılığı **yok** — `number-properties` için elle bağımsız bir
  hesapla 8.000 cevabı karşılaştırdım, 0 hata; diğer şablonlar için böyle bir kontrol
  yapılmadı. **Burası denetimin en çok değer katacağı yer olabilir.**)
- Önermenin doğruluğunu denetlemez (§7.1).
- Pedagojiyi, yaş uygunluğunu, çeviri kalitesini denetlemez.
- İpucu sızıntısı kontrolü **cevabı 20'nin altında olan soruları hiç görmez** — eşik
  ölçülerek seçildi (0'da 120 bulgu, 5'te 34, 10'da 17, 20'de 0, ve 20'nin altındakilerin
  okuduğum her biri tesadüftü), ama bu Year 1'in çoğu demek.

---

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

Öncesi: `843940c`, `01405e6` (21 Eylül denetiminin dört bulgusu ve `2 × 2`).

# Matematik QA raporu: düzeltmeler (2026-09-27)

Kaynak: `Tuto_Matematik_Detayli_Test_Raporu_2026-09-27.pdf` (Astra/Codex, Türkçe ekran modu).
Bu not, rapordaki her bulgunun kodda neye karşılık geldiğini ve nasıl doğrulandığını anlatır.
Bazı bulgular düzeltmelerden önceki kodla test edilmişti. Bulgunun asıl sebebi farklı çıktıysa
bu not onu da yazıyor.

Tekrar test ederken **bu commit'lerden sonraki main**'i kullan:
`97ed7d0`, `9ac3c6d`, `75a2ee5`, `5538435`, `54aa2a4`, `992ea27`.

## P1

### Seviye salınımı ("Yeni bir seviye açtın!" tekrar ediyor)
- **Sebep:** `/api/children/:childId/math-session` seviyeyi yaş bandının üstüne çıkarıyordu.
  İstemci (`clampLevelToAge`) bir sonraki oturumda seviyeyi geri indiriyordu. Böylece her
  seferinde yeniden "yükseldin" deniyordu.
- **Düzeltme:** Sunucu artık çocuğun `age` alanını okuyor ve seviyeyi `mathLevelBand(age)`
  = `[base−1, base]` içinde değiştiriyor (`server/index.js`). Bu bant istemcinin
  `BASE_LEVEL_FOR_YEAR` bandıyla aynı. 5-14 yaşın hepsinde karşılaştırıldı.

### 5-6 yaşta sayı aralıkları
- **"83 − 42" (6 yaş):** Bu da seviye salınımının sonucuydu. Çocuk bir oturum için 3.
  seviyeye, yani Year 2'ye (100'e kadar) çıkıyordu. Yeni kodla 5-6 yaş oturum planlarından
  8.000 soru üretildi, 20'yi aşan sayı yok.
- **Uzunluk farkı ("90 − 27 cm"):** Year 1 (band 1) artık 4-20 cm aralığında, kalem/cetvel
  ile sınırlı (`measureDifference`).
- **Birleşik para ("3 × 5 + 2 × 50 = 115"):** Year 1'de yalnız ≤10'luk paralar, en çok iki
  tür, toplam ≤20 (`moneyCombine`).
- **Olmayan paralar:** `COINS_BY_LANG` eklendi. TR `[1, 5, 10, 25, 50]` (Darphane serisi;
  2 ve 20 kuruş yok), EN `[1, 5, 10, 25, 50]`, ES `[1, 2, 5, 10, 20, 50]` (euro).
  `moneyMakeValue` da bu listeyi kullanıyor. "14 kuruş için kaç tane 2 kuruş" artık çıkmıyor.

### Pasta grafiği kesin bilgi vermiyor
- Daire, grafiğin ortak paydası kadar **eşit parçaya** kesik çizgilerle bölünüyor
  (`visual.parts`). Her dilimin kenarı bu çizgilerden birine denk geliyor. 120°/60° gibi
  dilimler artık tahmin edilmiyor, "6 parçadan 2'si" diye sayılıyor.
- Dilimler numaralı, lejantta da aynı numaralar var. Lejant yalnız renge dayanmıyor.
- İpucu artık parçaları saymayı söylüyor. Kesir/açı/yüzde yazılmadı: "Hangi kesir?"
  sorusunda cevabı basmış olurdu.
- `math:check`: her dilim tam sayıda parça kaplıyor ve parçalar daireyi dolduruyor.

## P2

### Türkçe binlik ayırıcı ("30,000", "8,000,000")
- **Sebep:** Soru değil ekrandı. Basamak değeri şıkları `num()` ile önceden gruplanmış
  geliyordu ("30.000"). Ekran şıkları `dnum()` ile çizerken noktayı ondalık sanıp virgüle
  çeviriyordu.
- **Düzeltme:** Şık değerleri ve cevaplar artık gruplanmamış tutuluyor. `dnum()` tam sayıyı
  dilin ayırıcısıyla grupluyor, ondalığı virgülle yazıyor. Tek biçimleyici bu.
  Sonuç listesi (`SittingReview`) de artık `dnum()`'dan geçiyor.
- Aynı sınıftan ikinci hata: 13 yaş `pow10` sorusu "0,4132 ÷ 1,000" basıyordu. Artık
  "÷ 1.000".
- `math:check` iki yeni kontrol: TR/ES metinde `,000` ile biten sayı, EN'de önceden
  gruplanmış şık değeri.
- Not: Klavyeyle yazılan tam sayı da ekranda gruplanıyor (3092 → 3.092).

### L şekli: "bütün köşeleri dik açı"
Artık "Bu şeklin yan yana kenarları birbirine dik." EN: "Each side of this shape meets the
next at a right angle." ES: "Cada lado … es perpendicular al siguiente."

### Yönerge belirsizlikleri
- "12 sayısında kaç tane 2 vardır?" → "12 nesneyi 2'şer 2'şer gruplarsan kaç grup olur?"
- "Bu rakamlarla yazabileceğin en küçük sayı" → "Her rakamı bir kez kullan. 4, 8, 3 ile
  yazabileceğin en küçük 3 basamaklı sayı kaçtır?"
- 2 kuruş: yukarıda, paralar dile göre.

### Mod seçimi metni
`math_paper_desc` (tr): "Kâğıtta çöz, çalışmanı fotoğrafla paylaş. Yazarken beynin büyür! 🧠"

### Görsel erişilebilirliği
- Yeni `src/lib/mathVisualText.js` → `describeVisual(visual, lang, question)`. MathChart ve
  MathFigure `aria-label`'ı buradan alıyor.
- Açıklama görselin **yapısını** anlatıyor:
  - pasta: parça sayısı, dilim adları;
  - Venn: iki etiket ve boyalı bölge;
  - Carroll: başlıklar ve işaretli kutu;
  - sütun/çizgi grafiği: kategoriler ve ölçek adımı;
  - tablo: bütün hücreler, "?" dahil;
  - piktogram: anahtar;
  - ölçek: aralık ve adım;
  - koordinat: nokta adları;
  - çark ve yol haritası.
- **Okunacak değeri söylemiyor.** Saatteki zaman, kabın seviyesi, dilimin büyüklüğü ve
  sütun yükseklikleri açıklamada yok, çünkü soru onları okutuyor. Fiyat listesi de bu
  yüzden açıklanmadı.
- Tanınmayan türler (geometri, açılar vb.) hâlâ soru metnine düşüyor.
- **Gerçek ekran okuyucuyla (VoiceOver/TalkBack) test edilmedi.**

## P3

### Küçük ekran (390×664)
- 740px'ten kısa ekranda soru kartı, görsel (azami 140px), cevap kutusu ve tuşlar (54px;
  44px dokunma alanı sınırının üstünde) küçülüyor.
- Cevap kutusu ve klavye alta sabit (`.math-pad`, sticky). Soru ve ipucu üstlerinde kayıyor.
  İpucu açılınca alan ipucuna kaydırılıyor.
- Ölçüm, mock'lu gerçek MathScreen'de, görselli soru + açık ipucuyla: gönder tuşunun alt
  kenarı 776px → 650px. 1180×820'de düzen değişmedi (798px, ekranda).
- Kâğıt modu ve seçmeli soru düzeni bu değişiklikte ayrıca ölçülmedi.

### Tam tur açı çizimi eşit çeyrekler gibi
`MathGeometry` artık açıları gerçek oranlarıyla çiziyor (doğru, tam tur, ters açılar).
Etiket sığsın diye her dilim en az 35° alıyor. "Ölçekli değildir" notu duruyor.

## Açık: karar bekliyor

**10 yaşta (Year 5) üçgen alanı ve üçgen/dörtgen açıları.** Bunlar İngiltere müfredatında
Year 6 konusu. Ölçüm: 10 yaş oturumunda geometri ~0,54 dikdörtgen, ~0,48 üçgen (alan +
açı), 0,13 dörtgen açısı soru/oturum.

Claude'un önerisi: bunları 10 yaştan çıkarmak, yerine Year 5'in kendi içeriğini koymak.
Çıkanlar 11 yaşta aynen kalıyor. Konulacaklar:
- bileşik/L şeklin çevresi ve alanı (şablon var, şu an band ≥6'da açık);
- doğru ve tam tur açıları;
- dar/geniş/reflex açı tanıma.

Kullanıcı henüz karar vermedi, **uygulanmadı**.

## Rapordan kapsam dışı kalanlar
- Uzun ortalama sorularının tekrarı (11 yaş): bakılmadı.
- 11 yaşta konu dağılımı (istatistik 29, geometri 26): bakılmadı.

## Doğrulama
- `npm run math:check`: bulgu yok (yeni kontroller dahil).
- `vite build`: çıkış kodu 0.
- `font:check`: geçti.
- `i18n:check`: yeni bulgu yok.
- `node --check server/index.js`: geçti.
- Tarayıcı (Playwright, mock API):
  - math-lab'da pasta grafiği ve açı çizimleri;
  - gerçek MathScreen, 10 yaş TR, 390×664 ve 1180×820, ipucu açık;
  - mod seçim ekranındaki yeni metin görüldü.
- Canlı DB'ye yazılmadı.

## Tekrar testinde bakılacaklar
1. Aynı yaşta art arda oturumlarda "Yeni bir seviye açtın!" tekrar etmemeli. Not: canlıdaki
   çocukların `math_progress` satırlarında eski, bant dışı bir seviye kalmış olabilir. İlk
   oturumda bir kez düzelmesi beklenir.
2. 5-6 yaşta para ve uzunluk soruları 20 içinde olmalı. TR'de 2/20 kuruş çıkmamalı.
3. 11 yaş pasta grafiği: parçalar sayılarak cevaplanabilmeli.
4. 10 ve 11 yaş basamak değeri şıkları "30.000" biçiminde olmalı.
5. 390×664'te görselli soru ve açık ipucuyla ✓ kaydırmadan görünmeli.

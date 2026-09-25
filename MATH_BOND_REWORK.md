# Matematik motoru — Bond kitaplarına göre yeniden kurulum (23–25 Eylül 2026)

**Ne değişti:** 7'den 13 yaşa kadar her yaşın soru biçimleri, o yaşın Bond kitabı baştan sona
okunarak yeniden yazıldı; görselli sorular eklendi; 13 yaş için ayrı bir yıl (Year 8) kuruldu.
**Ekran modunda model hâlâ hiç çalışmıyor**: bütün sorular deterministik şablonlardan geliyor.
Müfredat kapsamı **65/65** (eskiden 57/57; Year 8'in 8 konusu eklendi).

Bu dosya, önceki [`MATH_ENGINE_HANDOFF.md`](MATH_ENGINE_HANDOFF.md)'nin devamı. O doküman
"13 yaş Year 7'ye düşüyor, Year 8 kaynak bekliyor" diyor; bu artık geçerli değil (§3.5).
Yazıldığı an: 25 Eylül 2026, `main` üzerinde `32f0770`.

---

## 1. Yöntem: tahmin değil, kitap

Her yaş için elimizdeki Bond kitabı sayfa sayfa okundu (taranmış PDF'ler, metin katmanı bozuk
olduğu için görüntü olarak). Not dökümleri oturumun scratchpad'inde duruyor. **Kitaplar telif
nedeniyle repoda yok.**

| Yaş | Okul yılı | Kaynak kitap |
|---|---|---|
| 7 | Year 2 | *Bond Assessment Papers Maths 7-8* (22 kâğıt) |
| 8 | Year 3 | 7-8 kitabı + *Bond 10 Minute Tests Maths 8-9* (28 test) |
| 9 | Year 4 | *Bond 10 Minute Tests Maths 8-9* |
| 10 | Year 5 | *Bond Maths 10 Minute Tests 10-11* (~200 soru; taramada 18, 22, 23. testler eksik) |
| 11 | Year 6 | 10-11 kitabı |
| 12 | Year 7 | *Bond 10 Minute Tests Maths 11+-12+* (30 test) |
| 13+ | **Year 8 (yeni)** | *Bond Maths Assessment Papers 12+-13+* (20 kâğıt × 50 soru) |

Her turda aynı döngü uygulandı:
1. Kitabı oku ve soru biçimlerini listele.
2. Motorun o yaşta ürettiğini ölç (1500–2000 oturum).
3. Aradaki farkı kapat.
4. Tekrar ölç.
5. Tarayıcıda gerçek ekranda bak.

---

## 2. Ölçülen önce / sonra

| Ne | Önce | Sonra |
|---|---|---|
| 7–9 yaş, oturum başına çıplak işlem (`68 + 25 = ?`) | 2,2 | 0,67 |
| 7 yaş, oturum başına şıklı soru | 0 | 1,4 |
| 7–9 yaş, konu başına soru biçimi sayısı | 1–3 | 7–30 |
| 10 yaş, oturum başına çıplak 4 basamaklı toplama | 1,3 | 0 |
| 10 yaş, kalanlı bölme | 0 | ~1,0 / oturum |
| 11 yaş, konu dengesi (sayı / şekil / veri) | ~7 / 1,5 / 1,5 | 5 / 2,5 / 2,5 |
| 11 yaş, görselli soru / oturum | 3,7 | 4,4 |
| 12 yaş, görselli soru / oturum | 3,0 | 4,3 |
| 11–12 yaş, görsel türü | 5 | 13 |
| 13 yaş | Year 7 ile aynı liste | ayrı Year 8: 58 soru biçimi, 3,1 görselli soru, 10 görsel türü |
| Kapsam | 57/57 | 65/65 |

---

## 3. Yaş yaş ne yapıldı

### 3.1 10–11 yaş: dört işlem hikâyeye girdi
Kitapta çıplak "a + b = ?" **hiç yok**. Toplama ve çıkarma hep bir bağlam içinde soruluyor ve
çoğu iki adımlı. Büyük sayı, doğası gereği büyük olan şeyde duruyor: "52 kişilik otobüs × 12".
Bizde ise "93 sepet × 8 düğme" gibi yapay sorular çıkıyordu.
- `y5_addition` yeni `add-sub-word` şablonuna bağlandı: anket kalanı, otobüs iniş-biniş, para kalanı vb.
- `multiplication-word` / `division-word`'de bağlam kendi sayı aralığını taşıyor.
- Bölmede dört mod var: tam, yukarı yuvarla ("kaç otobüs gerekir"), aşağı yuvarla, kalan.
- Year 5 istatistiğine iki yönlü tablo eklendi (bir hücresi "?").
- **Ondalık virgülü:** TR/ES'de binlik ayırıcı nokta olduğu için `8.412` "sekiz bin" okunuyordu.
  `dnum()` artık okunan metni virgülle basıyor; şık değerleri ve cevaplar noktalı kalıyor.

### 3.2 7–9 yaş: kitabın biçimleri, görsellerle
Yeni bileşen `src/components/MathFigure.jsx`. Çizebildikleri:
- **Ölçme araçları:** cetvel, ölçü kabı, termometre, tartı, sayı doğrusu.
- **Kesir ve ızgara:** taralı kesir, koordinat ızgarası.
- **Şekiller:** 3B cisimler (gizli ayrıtlar kesikli), çokgenler.
- **Veri ve günlük hayat:** çetele, fiyat listesi, dijital saat.

Şablonlarda bir "young" bölümü var. Her konu düz biçimi bir pay olarak tutuyor; geri kalan
biçimler kitabınkiler:
- eksik sayı, eksik işaret
- iki adımlı hikâye
- kalanı yuvarlama
- ölçek okuma
- simetri, dik açı
- süre ve tarife

Sonradan eklenenler:
- Venn ve Carroll diyagramı
- yol haritası
- ızgara referansı + pusula
- yarım sembollü piktogram

### 3.3 Kullanıcı / test geri bildirimiyle düzeltilenler
- **"Dikdörtgen" diye kare soruluyordu** (7 cm × 7 cm). Taramada 17.548 dikdörtgen sorusunun
  9.444'ü kare ya da dikey çıktı. Artık kenarlar farklı ve uzun kenar altta (`rectSides`).
- **Ortalama sorusu** neyin ortalaması olduğunu söylüyor.
- **Para:** "How many dollars" yerine "How much money … in dollars", tutar "$12" biçiminde.
- **Konu dengesi (Astra'nın bulgusu):** fazladan slotlar artık en az temsil edilen alana gidiyor
  (sayı alanı yarım ağırlıkla sayılıyor). Test: `scripts/tests/session-balance.test.mjs`.
- **8 yaş yol haritası çok ağırdı:** yollar 40–260 km'ydi, yani üç tane üç basamaklı sayı
  toplanıyordu. Kitap (7-8, Paper 8) 8, 15, 24, 17 km kullanıyor. Artık 8–60 km; en büyük toplam ~170.
- **Yardım paneli boş çıkıyordu:** panel sayma noktalarını metindeki ilk iki sayıdan
  çiziyordu. Yol haritasında metinde sayı yok, bu yüzden 0 + 0 çizdi. `5 + ? = 12` sorusunda da
  5 + 12 çizerdi. Artık noktalar yalnız metin gerçekten "a + b" olduğunda çiziliyor; diğer
  sorularda panel görseli ve adım adım ipuçlarını gösteriyor.
- **Sonuç ekranında ("Cevapların") görseller yoktu.** Artık her soru görseliyle görünüyor;
  kâğıt modu da görseli basıyor.

### 3.4 11–12 yaş: kitabın resimli yarısı
Year 7 zaten bu kitabın *metninden* yazılmıştı. Eksik olan resimli sorulardı. Eklenenler
band ≥6'da, yani 11 ve 12 yaşta çıkıyor:
- **Pasta grafiği, açınım, çarkla olasılık, harita ölçeği.**
- **Dört bölgeli koordinat:**
  - dikdörtgen, kare ya da paralelkenarın 4. köşesi
  - noktaları birleştirip şeklin "en doğru adı"
  - üçgeni öteleme
- **Noktalardan kural:** örneğin `y = 2x − 1`.
- **Açı çizimleri:** dış açı, ikizkenar, ters açılar, doğru üstünde iki eşit açı.
- **Bileşik şekil:** L-şekli, köşesi kesilmiş taralı dikdörtgen.
- **Cisimler:** dörtyüzlü, sekizyüzlü, beşgen ve altıgen prizma.
- **Fonksiyon makinesi:** çizimi ve boş kutulu hâli.
- **Diğerleri:**
  - sayı haçı
  - zar sonuç tablosu
  - üçgensel ve kare sayı noktaları
  - sıfırın altına uzanan sayı doğrusu

### 3.5 13 yaş: Year 8
Önceden 12 ve 13 aynı Year 7 listesini alıyordu. Artık `ageToSchoolYear`: 12 → `year7`,
13+ → `year8`.
- **Seviye kadranı 15'te bitiyor.** Sunucu 15'in üstüne çıkarmıyor ve Year 7 zaten 13–14'te.
  Bu yüzden Year 8 15'e oturuyor ve **her konusu kendi şablonunda** (`powers-primes`,
  `negatives-decimals`, `fdp`, `algebra-8`, `sequences-graphs`, `ratio-8`, `geometry-8`,
  `stats-8`). İçeriği bant değil konu seçiyor. Trade-off: Year 7 ile bir basamak çakışıyor,
  ama Year 8 şablonları banda bakmadığı için bu zararsız.
- **Konular:**
  - **Üsler ve asallar:** asal çarpanlar (üslü), EBOB/EKOK.
  - **Negatifler ve ondalıklar:** dört işlem, yuvarlama.
  - **Kesir, ondalık, yüzde:** tam sayılı kesirlerle dört işlem, kesirli yüzde, indirim, ters yüzde.
  - **Cebir:** parantez açma, çarpanlara ayırma, iki parantez çarpımı, iki taraflı ve iki bilinmeyenli denklem.
  - **Diziler ve doğrular:** n. terim, doğruyu denklemiyle eşleme, kesişim.
  - **Oran:** 3–4 parçalı oran, ters orantı, birim çevirme, hız, dişli çark.
  - **Geometri:** prizma hacmi ve yüzey alanı, π, Pisagor, paralel doğrularda açılar, düzgün çokgen, büyütme.
  - **İstatistik:** sıklık tablosundan ortalama, birleşik ortalama, iki zar, deste, serpilme grafiği.
- **Yeni görseller:** dişli, ölçülü prizma, daire, dik üçgen, bahçe planı, serpilme grafiği,
  paralel doğrular, ızgarada doğrular, cebirsel dikdörtgenler.

### 3.6 Her yaştan okuma turu (25 Eylül)
5–13 yaş × EN, artı 6–13 yaş × TR için gerçek oturum planlarıyla ~260 soru üretildi, her biri
elle çözüldü. **Hesap hatası çıkmadı.** Üslup ve gerçekçilik bulguları düzeltildi:
- **Belirsiz grafik sorusu:** "How many books were there on the busiest one?" (TR "En yoğun
  olanında…"). Artık "in a single day / month" diyor (TR: "Bir günde en fazla kaç kitap?").
- **Gerçek dışı gol sayısı:** grafik ölçeği 20'şer çıkınca bir ayda 160 gol oluyordu. Veri
  kümeleri artık kendi ölçek sınırını taşıyor; gol en fazla 2'şer, yani ayda en fazla 18.
- **Türkçe ölçü farkı sorusu:** "…bir kapı 159 cm. kapı kaç cm daha uzun?" Cümle küçük harfle
  başlıyordu ve kapı gerçekçi değildi. Artık sandalye 40–110 cm, kapı 190–230 cm ve cümle büyük
  harfle başlıyor. İspanyolcada ağırlık için "mide" yerine "pesa".
- **Türkçe ortalama sorusu:** "İlk 3 maç içinde … Sonuncusunda kaç tane?" yerine "İlk 3 maçta …
  gol attı. Son maçta kaç gol attı?"
- **İspanyolca cinsiyet uyumu:** "los primeros 3 sesiones … el último" yerine "las primeras …
  la última" (semanas, sesiones dişil).
- **İngilizce para sorusu:** "1 5c coin" yan yana iki sayı gibi okunuyordu; artık "one 5c coin".
- **13 yaş birim fiyat:** "200 g → 400 g" gibi tam katlar çıkmıyor; ikiye katlamak orantı değil.

**İkinci tur, İspanyolca + ipuçları:** 6–13 yaş İspanyolca oturumları okundu, sonra 7, 9, 11 ve
13 yaşta her sorunun ipuçları ile yanlış şık açıklamaları okundu. Yine hesap hatası çıkmadı.
Düzeltilenler:
- **Yuvarlama sorusu:** "a la 100 más cercana" ve "en yakın 100 sayısına" yerine "a la centena
  más cercana" ve "en yakın yüzlüğe"; ipucu da "Yüzler basamağı" diyor.
- **Cetvel için yanlış sıfat:** "taller / más alta" yerine "longer / más larga".
- **İngilizce sıra sayısı:** "A 3th is bigger than a 9th", "the 2th term" yerine "a third",
  "ninths", "2nd" (`ordinal`, `fracName`).
- **Venn/Carroll yanlış şık açıklaması:** "12 is not a multiple of 5 and is even" yerine hangi
  etiketin bozulduğunu söyleyen "12 is even, but it is not a multiple of 5".
- **Dilbilgisi:** "The 1 left over still need" yerine "needs".

**Üçüncü tur, 5/6/8 yaş (EN) ve 10/12 yaş (TR) ipuçları + gerçek ekran:** ipuçlarında hesap ya da
mantık hatası çıkmadı; Türkçede "ortak bölene sahip" ifadesi "ortak bir böleni var" oldu.
Türkçe 10 ve 13 yaş, İspanyolca 7 yaş oturumları MathScreen'de uçtan uca çözüldü. Sonuç
ekranında bir görselin altındaki yazıya bindiği görüldü; bunun üzerine bütün konular ve
seviyeler lab'da gezilip her SVG'nin çiziminin kendi kutusundan taşıp taşmadığı ölçüldü (EN
25, TR 40 soru/konu/seviye). Dört taşma bulundu ve düzeltildi:
- **Koordinat ızgarası ve düzlem:** "y" etiketi kutunun 11–14 px üstüne taşıyordu.
- **Alt satırdaki nokta etiketi:** 6 px alttan taşıyordu.
- **Dişli:** yanlış ortalanmıştı, 14 px taşıyordu.
- **Paralel doğrular:** kesen doğru sabit uzunlukla çizildiği için 135 px taşıyordu; artık
  çizim alanına kırpılıyor.

Son ölçümde taşma sıfır.

---

## 4. Bilinçli kararlar

- **Yansıma ve dönme matematikte yok.** NVR bulmacaları zaten soruyor (kullanıcı kararı).
- **Negatif cevaplar şıklı.** Klavyede eksi tuşu yok.
- **Şıklarda "doğru ama başka isim" yok.** Kare aynı zamanda dikdörtgen ve eşkenar dörtgendir;
  bu yüzden "en doğru ad" sorusunda doğru cevabın üst sınıfı şık olarak verilmiyor ve kare hiç
  cevap olmuyor.
- **Fonksiyon makinesinde boş kutu için iki giriş–çıkış çifti gösteriliyor.** Tek çiftle
  "× 3" de "+ 14" de doğru olurdu.
- **Her yanlış şık neden yanlış olduğunu söylüyor** (`why`), örneğin "x = 2 koy: bu kural 5
  verir, ama nokta 6'da". 8 yaş ve altında yanlış şıktan sonra açılan ilk ipucu bu.
- **Türkçe ekler:** sayıdan sonraki ek sabit yazılıyordu ("11'nin", "%20'ini"). `trEk(sayı, hâl)`
  eki sayının okunuşunun son kelimesinden seçiyor: 11'in, %20'sini, 4'e, 60'tan, 17½'si.

**Kapsam dışı, çünkü otomatik puanlanamıyor:**
- grafik ya da pasta grafiği çizdirme
- açıölçer ya da cetvelle ölçme
- kerteriz
- cümle yazdırma
- "şekli boya", "noktayı işaretle"

---

## 5. Nasıl doğrulanıyor

`npm run math:check` iki parçadan oluşuyor: node testleri (`scripts/tests/*.mjs`) ve
`scripts/math-audit.mjs`. Denetim 10 yaşı (5–14) × 3 dili × N soruyu tarıyor (`MATH_AUDIT_N`,
varsayılan düşük; turlarda 2000 kullanıldı). Kontrol ettikleri:

- **Kapsam:** her müfredat konusunun bir şablonu var mı (65/65), konu adı ile şablonun
  uyuşup uyuşmadığı.
- **Şıklar:** en az 3 şık, tek doğru cevap.
- **Metin:** ipucu cevabı söylemiyor, dil sızıntısı yok, okuma uzunluğu sınırı aşılmıyor.
- **Sayı biçimi:** ondalık işareti dile uygun.
- **Resimden söz eden soru** görselsiz çıkamaz.
- **Görselden yeniden hesaplanan cevaplar:** her görsel için cevap çizimden bağımsız olarak
  yeniden hesaplanıyor.
  - ölçek okuması, taralı parça, tablo
  - dörtgen noktalardan sınıflandırılıyor, yanlış şıkkın da doğru olması ayrıca aranıyor
  - 4. köşe, öteleme, noktalardan kural
  - açı etiketleri, bileşik alan, makine
  - sayı haçı, zar tablosu
  - prizma, daire, Pisagor, dişli, bahçe
  - doğruların kesişimi, büyütme, sıklıktan ortalama, serpilme yönü
- **Kontrollerin gerçekten yakaladığı** ayrıca sınandı: dört cevap bilerek bozuldu, dördü de
  yakalandı.

**Son durum:** 65/65, **bulgu yok**. Build, `font:check` ve `i18n:check` (38, değişmedi)
temiz. Tarayıcıda her yeni görsel 390px'te EN, çoğu TR/ES'de de görüldü. MathScreen'de 9, 12
ve 13 yaş oturumları uçtan uca çözüldü (Supabase'siz; kayıt adımı "Couldn't save" veriyor,
beklenen).

**Elle bakmak için:** `/math-lab`'da konu ve seviye seçip soruları gezmek yeterli. Year 8
seviyesi 15.

---

## 6. Kimsenin kontrol etmediği yerler

- **Gerçek, Supabase'li bir oturumda** Year 8 kaydı ve gem yazımı görülmedi. Kod yolu
  değişmedi, ama bakılmadı.
- **Eski şablonlardaki sabit Türkçe ekler** taranmadı. `trEk` yalnız 11–12 ve 13 bloklarında.
- **Kâğıt modunda** yeni görsellerin baskısı yalnız kodda doğrulandı; kâğıda basılıp fotoğrafı
  okutulmadı.
- **İspanyolca** metinler EN/TR kadar elle okunmadı; denetim dil sızıntısını ve biçimi
  yakalıyor, üslubu yakalamıyor.
- **Year 1'e 1/3 çıkıyor.** Müfredat yarım ve çeyrek diyor. Kullanıcı kararı bekliyor
  (CLAUDE.md'de açık madde).

## 7. Açık öneri

- **Karalama alanı** (kullanıcı fikri, ertelendi): uzun toplamalar için. Tablette sorunun
  üstüne açılan bir çizim katmanı, telefonda boş basamak ızgarası; ikisi de aynı "✏️" tuşunun
  arkasında. Yol haritası sayıları küçüldüğü için önce ihtiyaç tekrar gözlenecek.

---

## Commit'ler (eskiden yeniye)

| Commit | Ne |
|---|---|
| `d1fd17a` | 10–11: Bond biçiminde hikâye problemleri, kalan, iki yönlü tablo, ondalık virgülü |
| `a358397` | 7–9: Bond 7-8 ve 8-9 biçimleri, `MathFigure` |
| `ae4bc40` | dikdörtgen asla kare değil |
| `bc4d81d` | ortalama sorusu neyin ortalaması olduğunu söylüyor |
| `20e6623` | para ifadesi |
| `926211d` | oturumda alan dengesi |
| `1d88c0e` | pasta, açınım, Venn/Carroll, sonuç ekranında görseller |
| `2bf6207` | ızgara referansı, yol haritası, çark, harita ölçeği, öteleme, yarım sembol |
| `3794c9d` | 11–12 görselleri |
| `67e6fd4` | Year 8 (13 yaş) |
| `8bf6197` | 8 yaş yol haritası iki basamaklı |
| `32f0770` | yardım paneli sayma noktalarını yalnız "a + b" metninde çiziyor |

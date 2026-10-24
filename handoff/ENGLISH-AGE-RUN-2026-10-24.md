# İngilizce: her yaş için çözülmüş testler (2026-10-24, Claude)

Kapsam `tuto-app-main` dalı `claude/english-stories-315`: #35 ve #36'nın içeriği, yani yayına girecek sürüm.

## Nasıl yapıldı

- **Merdiven oturumu (English kartı):** her yaş için (5–12) bir çocuk, art arda 3 oturum × 10 soru oynadı.
  - Bellekte sunucunun kendi modülleri kullanıldı: `ladder.js` (start / nextProbe / record), `catalog.js`, `literacyLab.dealItem`.
  - Kaynak seçimi sunucudaki gibi rastgele; aynı çocuğa aynı madde ikinci kez verilmez.
  - Çocuk cevapların %80'ini doğru verdi, ki merdiven yerleşsin.
- **Word puzzles (VR oturumu):** 5 bandın (7-8 … 11-12) her biri için `generateSession` ile 2 oturum × 10 soru.
- **Toplam:** 371 soru (merdiven 271, Word puzzles 100).
- **Çözüm:** cevap anahtarı ayrı dosyadaydı; soruları ona bakmadan, metni okuyarak çözdüm, sonra karşılaştırdım.
  - Dinleme sorularında ses yerine konuşma metnini okudum.
  - Resimli kelime sorularında resmin kelimesini kullandım. 32 resmin eşleşmesi ayrıca kontrol edildi: hepsi tek ve açık.

## Sonuç

- **371/371 doğru.** Yanlış anahtar, iki doğru şık ya da metni okumadan bilinen okuma sorusu bulunmadı.
- **8 soruda kalite sorunu.** Hepsi Word puzzles / VR üreticisinden geliyor:

| Soru | Tür, bant | Sorun |
|---|---|---|
| "a person who possesses great material wealth" → **have** | definition 11-12 | Hiçbir şık "zengin kişi" demiyor. Cevap, WordNet'teki isim anlamıyla "have" (haves and have-nots); yalnız eleyerek bulunuyor. |
| "a rude or vulgar fool" → **clown** | definition 11-12 | Çocuk "clown"u sirk palyaçosu olarak bilir; tanım kaba bir yan anlam. |
| "It ___ time to go home." → **was** | grammar-cloze 10-11 | En doğal cevap "is" şıklarda yok. Cevap ancak "is" olmadığı için "was". |
| "_rit" → **w (writ)** | silent-letter 10-11 | "writ" 10–11 yaş için çok nadir bir kelime. |
| "bourne" ↔ born | homophone 11-12 | "bourne" eski ve nadir bir kelime. |
| "wont" ↔ want | homophone 11-12 | Nadir kelime; "want" ile sesteşliği yalnız bazı aksanlarda geçerli. |
| wrath ↔ aftermath | rhyme 11-12 | İngiliz telaffuzunda wrath /rɒθ/; kafiye yalnız Amerikan telaffuzunda tutuyor. |
| invalidate → validate | root-word 9-10 | Kök "valid" de savunulabilir; şıklarda olmadığı için sorun çıkmıyor, ama kural belirsiz. |

## Yapısal bulgu: merdiven yaşa göre tavan uygulamıyor

Oturumlarda çıkan basamaklar:

| Yaş | 1. oturum | 3. oturum |
|---|---|---|
| 5 | A4 B1 Ca2 Cd1 D1 E1 A5 **B4** Ca3 **Cd4** | **Cd6 D4** A5 **B6** Ca4 **Cd6 D5** E2 A5 **B6** |
| 6 | (yaş 5 ile aynı başlangıç) | **Cd6 D5 B6 Cd6 D6** E2 **B5 D6** E1 A5 |
| 7 | A4 B2 Ca2 Cd2 D3 E1 A5 B1 Ca3 Cd4 | Cd2 **D6** A5 **B6** Ca4 Cd1 **D6** E2 A5 **B6** |

- Yerleştirme ikili arama gibi çalışıyor: doğru bir cevap bir sonraki soruyu yukarıya atıyor.
- Bu yüzden ilk doğru cevaplardan sonra 5–6 yaşındaki çocuğa 11–12 bandının içeriği geliyor:
  - "the quality of being valid and rigorous" → validity
  - terminology ↔ nomenclature
  - "rel__f"
  - "The song ___ by all the children" (edilgen çatı)
- Beş şıklı bir soruda şans eseri doğru cevap da aynı sıçramayı yapıyor.
- `AGE_TABLE` her yaş için "beklenen / tanıtılan" basamağı biliyor, ama `start` ve yerleştirme bunu üst sınır olarak kullanmıyor.

**Öneri:** yerleştirmede bir basamağı yaşın "tanıtılan" basamağının en çok bir üstüyle sınırlamak. Gerçek düzeyi daha yüksek olan çocuk, merdivenin normal yükselme kuralıyla zaten yukarı çıkar.

1. turda kod değiştirilmedi; tavan aynı gün eklendi (aşağıda).

## Diğer gözlemler

- 9–12 yaş, A4/A5 dinleme maddelerini almaya devam ediyor (yerleştirme gereği). Bu basamaklar onlar için çok kolay; zararsız ama zaman alıyor.
- `D6 misspelt` havuzunda aynı yanlış yazımlar sık tekrar ediyor: "minit" ve "consious" ikişer kez, farklı yaşlarda.

## Düzeltmeler ve ikinci tur (aynı gün)

### 1. turdaki 8 bulgu için yapılanlar
Dal `claude/english-age-fixes`:

- **Tanım:** `have`, `clown` (ve 2. turdan `intro`) tanım sorusundan çıktı.
- **grammar-cloze:** "It ___ time to go home" yerine "Yesterday it ___ very cold".
- **Sessiz harf:** yalnız çocuk kelime listesindeki (Dale-Chall) ya da yaygın kelimeler soruluyor. "writ", "wrought", "wraith", "wretched" ayrıca engelli.
- **Sesteş:** soruda gösterilen kelime yaygın olmalı, cevap da çocuğun karşılaşabileceği bir kelime. Bunların dışında kalanlar ayrıca elendi:
  - aynı kelimenin iki yazımı (aunty/auntie, mould/mold, disk/disc);
  - aksana bağlı çiftler (wont, lure);
  - marka adı (kraft).
- **Kafiye:** "wrath" İngiliz telaffuzunda çıktı.
- **Kök kelime:** -ate/-ise/-ize de soyuluyor (validate → valid gibi ikinci kök kalmıyor).

### Merdivene yaş tavanı
`ladder-3`:

- Yerleştirme, yaşın "tanıtılan" basamağının bir üstünde duruyor.
- Yerleştikten sonra normal yükselme kuralı (üç doğru üst üste, iki farklı gün) tavanın üstüne çıkarabiliyor.
- Ebeveynin elle verdiği başlangıç basamağı tavanı yükseltiyor.
- `ladder.test.mjs` içine bunu sınayan yeni bir test eklendi.

### 2. tur

**Nasıl yapıldı:**
- Yeni tohumlar; her yaş için 4 oturum.
- Gerçekçi doğruluk modeli: yaşın rahat basamağında %90, tanıtılan basamakta %70, bir üstünde %45, daha yukarıda %25.
- Her Word puzzles bandından 3 oturum.
- Toplam 501 soru.

**Sonuç: 501/501 doğru.** Yanlış anahtar yok.

**Yaş tavanı çalışıyor:**

| Yaş | En yüksek basamak |
|---|---|
| 5 | B1 / Cd2 / D2 / E2 |
| 6 | B3 / D4 |
| 7 | Cd5 / D5 |
| 10–12 | B6 / Cd6 / D6 |

**2. turun bulguları (hepsi düzeltildi):**

| Tür | Sorun | Düzeltme |
|---|---|---|
| apostrophe | "class trip", "family car", "sheep field" kesmesiz tamlama olarak doğru İngilizce; yanlış şık olarak sunuluyordu (iki savunulabilir şık). | Kesmesiz tamlama şıkkı kaldırıldı. |
| past-tense | "can → canned" (çocuğun cevabı "could", o da doğru); man → manned, sum → summed, body → bodied gibi asıl kullanımı isim olan kelimeler. | 18 kelime listeden çıktı. |
| ie-ei | "accompanied", "married", "healthier": burada ie, y'nin ek öncesi değişimi; ie/ei kuralı değil. | y→ie kelimeleri elendi. |
| definition | "formally making a person known…" → "intro" (gayriresmî; tanımlanan kelime "introduction"). | Engellendi. |
| analogy | person:foot :: bird:claw gevşek (kuşun da ayağı var). | person/foot çifti çıktı. |

**Açık kalan (ürün kararı):** 6 yaştaki çocuk B3/D4 basamağında "cease", "axial", "societal" gibi kelimelerle karşılaşıyor. Tavan doğru çalışıyor; sorun, D4 ve B3 basamaklarının kaynaklarının (VR 9-10 ek, VR 7-8 eşanlam) bu yaş için ağır kelime içermesi. Seçenekler: tavanı "tanıtılan + 1" yerine "tanıtılan" yapmak, ya da bu basamakların kelime eşiğini yaşa göre süzmek.

### Doğrulama
- `npm test` 230/230
- `english:check` temiz
- build temiz
- Değişen türlerden 1500'er soru üretildi; yasaklı durum 0.

### Yaşa göre kelime süzgeci (kullanıcı kararı, aynı gün)

**Ne yapıyor:** Merdivende VR motorundan gelen bir maddede, çocuk bandın ilk yaşından büyük değilse sorulan kelime ve cevap Dale-Chall listesinden seçiliyor. Örnek: 7-8 bandındaki eşanlam sorusu 7 yaş ve altına, 9-10 bandındaki ek sorusu 9 yaş ve altına bu kuralla gidiyor.
- Harf, ek ya da yanlış yazım cevaplı türlerde yalnız sorulan kelimeye bakılıyor.
- Ek (suffix) sorusunda kök kelimeye bakılıyor; kuralın ürettiği türetilmiş kelime şart değil.
- 80 tohumda uygun madde bulunamazsa süzgeçsiz maddeye düşülüyor. Böylece basamak hiçbir zaman sorusuz kalmıyor.

**Etkisi:**
- 6 yaş: "axis → axial", "society → societal", "prey", "gateway" yerine artık "lazy → laziness", "piano → pianist", "quick", "witch".
- 7 yaş: "cease" yerine "end", "limb", "knitted".

**Doğrulama:** `npm test` 231/231 (yeni test: 6 yaşa giden D4/B3/D5 maddelerinin en az 20/25'i çocuğun kelimeleriyle), build temiz.

## Güçlü 10 yaşındaki çocuk (`ladder-4`, aynı gün)

**Nasıl yapıldı:** sunucunun modülleriyle simülasyon. 10 yaşında bir çocuk 8 oturumu %95 doğrulukla oynadı. Karşılaştırma için 12/%95, 10/%70, 8/%90, 7/%80, 6/%80 ve 5/%80 de koşuldu. 4 oturumun 40 maddesi tek tek okundu.

**Bulunanlar ve yapılanlar:**

| Bulgu | Düzeltme |
|---|---|
| İlk oturumun çoğu yaşın rahat basamağının altındaydı. | 8 yaş ve üstü doğrudan rahat basamaktan başlıyor. 8 yaşın altı eskisi gibi. |
| Tepeye ulaşmış A5 dinleme ve Ca4 sıralama bir oturumda 4 kez geliyordu. | Tepede ve son 4 birimi doğru olan parkur oturumda bir kez soruluyor. "Tepe", içeriği olan en üst basamak: E5'te soru yok, E'nin tepesi E4. |
| E4 son oturumlarda 5 kez geliyordu. | Tepe artık içeriğe göre belirleniyor. |
| Sıralama cevap sayıyordu; hikâye 3 cevap getirdiği için dinleme parkuru geride kalıp 4 kez üst üste geliyordu. | Sıralama artık madde sayıyor. Bir parkur oturumda en çok 3 madde alıyor ve başka seçenek varken art arda gelmiyor. |
| Tanım, eşanlam ve "farklı olan" sorularının çeldiricileri rastgele kelimelerdi; cevap konusu tutan tek kelimeydi ("an artist who paints" → painter / dial / column / skeleton; maaş eşanlamlarının arasında "horse"). | 10-11 ve 11-12 bantlarında çeldiriciler cevabın anlam alanından (WordNet sözcük dosyası) seçiliyor. Tanımın kendi kelimesi çeldirici olamıyor. |
| Kötü tanım cevapları: maria (ayın denizleri), bound(s), istatistik dilindeki average, mike, sunk, colour ("any material used for its color"), crazy. Çeldiricilerde isim, yer ya da argo kelimeler: mike, harry, dude, surrey, dauphin, argentine… | Hepsi engellendi. |

**Sonuç:**
- Güçlü 10 yaş: rahat basamağın altında soru 0. Tepe basamaklar oturumda 1–2 kez.
- 5–8 yaşların akışı değişmedi.
- 10 yaş %70: zayıf parkurlar doğal olarak aşağıda kalıyor.

**Açık (ürün kararı), içerik tavanı:** Güçlü bir 10 yaş 2-3. oturumda bütün parkurların tepesine ulaşıyor. Bundan sonra gördükleri onun için hâlâ basit:
- A5 dinleme Movers düzeyinde: "Bill was first … Who was first?"
- Ca4 yalnız 15 madde: "What did Sue do first?"

Merdiven mantığı artık bunları seyrek soruyor. Daha zor içerik için iki yol var: yeni basamaklar (A6 / Ca5 / E5), ya da tepeye ulaşan çocuğa Word puzzles'ın daha sık önerilmesi.

**Doğrulama:**
- `npm test` 232/232; `ladder.test.mjs` 29 test (2 yeni: tepe oturumda bir kez; parkur payı ve art arda gelmeme).
- `english:check` temiz.
- 10-11 ve 11-12'de tanım, eşanlam ve "farklı olan" türlerinin her birinden 20'şer örnek okundu.

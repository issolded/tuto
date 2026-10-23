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

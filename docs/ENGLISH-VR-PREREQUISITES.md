# Tuto — Sözel akıl yürütme (VR): soru ailesi başına önkoşul tablosu (taslak 1, 2026-10-18)

Karar bağlamı: `ENGLISH-SKILL-LADDERS.md`, "Navigasyon ve sözel akıl yürütme" (rev. 3). VR oturumu yalnız
önkoşulu karşılanmış ailelerden soru çeker. Bu tablo **mevcut üreticilerden** (`src/lib/englishTemplates.js`)
okunarak çıkarıldı: her satır üreticinin hangi kelime havuzundan çektiğine ve çocuktan ne istediğine dayanır.
**Henüz gerçek örnek sorular üzerinden incelenmedi** (ikinci inceleme adımı); basamak eşlemeleri hipotezdir.

## Okuma notu: VR-1 tek bir seviye değil

"VR-1 ↔ B3" hipotezi tablo çıkınca tutmadı. 7-8 bandının 18 ailesi dört farklı yüke ayrılıyor; bunların
ikisi B3'ün altında, biri (analogy) belirli kelime bilgisi istediği için üstünde:

| Kademe | Aileler | Asıl yük |
|---|---|---|
| **K0 Alfabe** | `letter-analogy`, `letter-sum`, `alpha-order`, `letters-in-order`, `letter-code` (kodlama yönü) | Alfabe sırası/harf konumu; neredeyse hiç kelime bilgisi yok |
| **K1 Kısa kelime yapısı** | `anagram-pair`, `join-letter`, `change-pattern`, `word-ladder`, `not-from-letters`, `unscramble`, `front-letter`, `letter-code` (çözme yönü), `logic-grid` | 3–5 harfli sık kelimeleri okuma ve yazımını bilme (B2 + D1–D2); `logic-grid` kısa cümle anlama |
| **K2 Anlam** | `pair-meaning`, `odd-two`, `compound-front`, `rhyme-synonym`, `analogy` | B3 eş/zıt anlam ve kategori; `analogy` ve `rhyme-synonym` ek bilgi ister |
| **K3 (8-9 bandı)** | `word-grid`, `letter-pair`, `shared-letters`, `hidden-word`, `odd-two` | B4 kelime genişliği + D3–D4 yazım; `hidden-word` cümle okuma |

Ürün sorusu (kullanıcı için): K0 aileleri İngilizce bilmeyen çocuğa da (Osman) çok erken açılabilir; yük
alfabe ve akıl yürütme. Bu bir "ilk VR kapısı" olarak istenen bir şey mi, yoksa VR ancak K1'den mi başlamalı?
Yönergeler İngilizce olduğu için K0 da puansız çözülmüş örnek ister.

## Tablo

Sütunlar: **Gereken beceri** (merdiven kodu ya da merdivende olmayan beceri), **Kelime yükü** (üreticinin
havuzu), **Doğrudan yoklama** (merdiven kanıtı yetmiyorsa açılmadan önce sorulacak kısa madde),
**Denemeye alınma koşulu** (bu aile deneme oturumuna girebilir mi), **Havuz** (3000 tohumda farklı soru /
farklı cevap; `node scripts/english/vr-pool.mjs`). Farklı cevap sayısı bağımsız kanıt için daha anlamlı
(aynı cevap farklı şıklarla aynı kelime ailesidir).

### 7-8 bandı (`YOUNG_VR_TYPES` + `odd-two`)

| Aile | Ne soruyor | Gereken beceri | Kelime yükü | Doğrudan yoklama | Denemeye alınma koşulu | Havuz |
|---|---|---|---|---|---|---|
| `letter-analogy` | AB : CD = EF : ? (alfabe yardımcı satırı var) | Alfabe sırası, adım sayma; **merdivende yok** | Yok | Alfabe sırası maddesi (aşağıda) | Alfabe yoklaması geçti | 1430 / 89 |
| `letter-sum` | a = 2, b = 3… c + d? | Harfi etiket olarak okuma + 24'e kadar toplama/çıkarma | Yok (matematik yükü var) | Yok; matematik düzeyi ayrıca bilinir | Her zaman (yönerge örneğiyle) | 1956 / 43 |
| `alpha-order` | 5 kelimeden alfabetik sırada N. olan (7-8'de ilk harfler farklı) | Alfabe sırası; kelimeyi okumak gerekmez | Dale-Chall 3–7 harf (okunur ama anlamı gerekmez) | Alfabe sırası maddesi | Alfabe yoklaması geçti | 1174 / 1174 |
| `letters-in-order` | Harfleri alfabetik sırada olan kelime | Alfabe sırası, harf harf karşılaştırma | Dale-Chall 3–5 harf | Alfabe sırası maddesi | Alfabe yoklaması geçti | 85 / 85 (dar) |
| `letter-code` kodlama | TABLE = 12345 ise BAT = ? | Harf konumu eşleme; büyük/küçük harf eşleme | Anahtar 4–6, hedef 3–5 harf Dale-Chall | Büyük–küçük harf eşleme maddesi | Alfabe yoklaması geçti | 1137 / 674 (iki yön birlikte) |
| `letter-code` çözme | SADM = 1234 ise 123 = ? (şıklar kelime) | Yukarıdaki + çıkan kelimeyi tanıma (B2) | Aynı | Yok | B2 yeterli kanıt | (yukarıda) |
| `anagram-pair` | Aynı harflerden yapılmış iki kelime | Kısa kelimeyi okuma, harf sayma (B2, D1) | Dale-Chall 3–5 | Yok | B2 + D1 yeterli kanıt | 77 / 154 (dar) |
| `join-letter` | peac (h) ome | İki kelimenin yazımını hatırlama (D1–D2), tanıma (B2) | Dale-Chall 3–5; parçalar kelime değil | Yok | B2 + D2 yeterli kanıt | 2764 / 20 harf |
| `front-letter` | _aste _ind _ish _ater → w | Dört kelimeyi parçadan **hatırlama** (yazım hafızası, D2–D3) | Dale-Chall 4–6 | Yok | B2 + D2 yeterli kanıt | 2988 / 22 harf |
| `change-pattern` | pit→pot, lit→lot, file→? | Kural çıkarma + cevabın kelime olduğunu tanıma (B2, D1) | Dale-Chall 3–5 | Yok | B2 + D1 yeterli kanıt | 1136 / 468 |
| `word-ladder` | TEN → ? → FIN | Harf değiştirip kelime bulma (B2, D1) | Dale-Chall 3–4 | Yok | B2 + D1 yeterli kanıt | 1648 / 433 |
| `not-from-letters` | HEART: the rat rot tar → rot | Uzun kelimenin harflerini sayma; kısa kelimeleri okuma (B2) | Büyük 6–9, küçük 3–5 harf Dale-Chall | Yok | B2 yeterli kanıt | 2158 / 755 |
| `unscramble` | LELB → bell | Karışık harften somut ismi **hatırlama** (B1–B2 + D1–D2) | Dale-Chall somut isim 4–6 | Yok | B2 + D2 yeterli kanıt | 214 / 214 |
| `logic-grid` | Dört çocuk iki özellik / üç kişilik sıralama | Kısa cümle anlama (Ca1–Ca3), karşılaştırma sıfatı (`smaller than`, Cd4'e yakın) | Sahne tabloları (`LOGIC_SCENES`, `ORDER_SCENES`), isimler | Yok | Ca3 yeterli kanıt | 2997 / 24 |
| `pair-meaning` | En eş/en zıt anlamlı çift (cümlesiz) | B3 eş ve zıt anlam | Elle yazılmış `PAIR_SYNONYMS` / `PAIR_ANTONYMS` + kategori çiftleri | Yok | B3 (eş ve zıt ayrı beceri) yeterli kanıt | 153 / 153 |
| `odd-two` | Beş kelimeden farklı olan İKİ (kategori) | B2 kategori + "hangi ikisi" akıl yürütmesi | Somut isim, Zipf ≥ 4,0 (bandın cevap eşiği) | Yok | B2 kategori + B3 yeterli kanıt | 59 / 118 (7-8, dar) |
| `compound-front` | CAKE CUP POT ROOM → TEA | Bileşik kelime bilgisi (teacup); B3 düzeyi + kalıp bilgisi | Baş Dale-Chall 3–6, kuyruklar bandın okunur kelimeleri | Bir bileşik kelime tanıma maddesi önerilir | B3 yeterli kanıt | 2081 / 30 |
| `analogy` | Frog : tadpole = swan : ? | İlişki akıl yürütmesi + **belirli kelime bilgisi** (yavru/ses/yuva/dişi: `cygnet`, `gosling`, `owlet`) | Elle `RELATIONS` tabloları | Seçilen ilişkide 1–2 kelime maddesi | B3 + ilişki maddesi geçti; anadilli olmayan için en geç açılan K2 ailesi | 122 / 111 |
| `rhyme-synonym` | CABLE, tyre → wire | Eş anlam (B3) + **kafiye** (ses bilgisi, aksana duyarlı; merdiven dışı) | Elle `RHYME_CLUES`, kafiye grupları | Sesli kafiye maddesi (ses gerekir) | B3 + kafiye maddesi; ses yoksa açılmaz | 44 / 43 (en dar) |

### 8-9 bandı (akıl yürütme tipleri)

`synonym`, `antonym`, `sense` ve `WORD_TYPES` bu tabloda değil: kararla merdivene geçtiler.

| Aile | Ne soruyor | Gereken beceri | Kelime yükü | Doğrudan yoklama | Denemeye alınma koşulu | Havuz |
|---|---|---|---|---|---|---|
| `odd-two` | Yukarıdaki gibi | B2 kategori + B4 kelime genişliği | Somut isim, Zipf ≥ 3,6 | Yok | B4 yeterli kanıt | 193 / 371 |
| `word-grid` | 12 kelimelik ızgaradan hedefe en yakın/zıt İKİ | B4 eş ve zıt anlam; 12 kelimeyi okuma yükü | Hedef Zipf 4,0–5,5; dolgu ≥ 4,2 somut | Yok | B4 yeterli kanıt | 86 / 140 (dar) |
| `letter-pair` | tired → sl__py | B4 eş/zıt anlam + yazımı tamamlama (D3–D4) | Elle çiftler, cevap 5–10 harf | Yok | B4 + D3 yeterli kanıt | 379 / 261 |
| `shared-letters` | Aynı üç harf iki kelimeyi tamamlar | Parçadan kelime tanıma: geniş yazılı kelime bilgisi (B4) + yazım (D4); anlam ipucu yok | 5–9 harf, Zipf ≥ 4,2 | Yok | B4 + D4 yeterli kanıt | 2055 / 839 |
| `hidden-word` | "…under her pil___." → low | Cümle okuma (C-anlam, E1–E2 düzeyi) + B4 + üç harfli kelime | WordNet örnek cümleleri, somut ev sahibi kelime | Yok | B4 + Ca4 yeterli kanıt | 95 / 60 (dar) |

## Merdivende olmayan, yazılması gereken yoklamalar

Bugün hiçbir üretici bunları sormuyor; K0 ve iki K2 ailesi bunlara bağlı.

1. **Alfabe sırası:** "Which letter comes next? D E F _" ve "Which word comes first in ABC order? bed / cat".
   Kelime yükü sıfır, 3 şık. `letter-analogy`, `alpha-order`, `letters-in-order`, `letter-code` için.
2. **Büyük–küçük harf eşleme:** "B" → b / d / p. `letter-code` (anahtar büyük harfle basılıyor).
3. **İlişki kelimesi:** "A baby swan is a…" cygnet / gosling / kitten. `analogy` için, ilişki başına.
4. **Kafiye (sesli):** 🔊 "cat" → hat / cup / dog. `rhyme-synonym` için; ses yoksa aile açılmaz.
5. İsteğe bağlı **bileşik kelime:** "tea + cup" → teacup mı? `compound-front` için.

## "Yeterli aile" ve oturum içeriği

Oturum 10 soru, aile başına en çok bir soru (`generateSession` tip başına bir soru dağıtıyor). Tekrarsız bir
kısa oturum için açık ailelerin **farklı cevap** havuzu belirleyici. Dar aileler (`rhyme-synonym` 43,
`letters-in-order` 85, `hidden-word` 60 cevap, 7-8 `odd-two` 59 soru) haftada birkaç oturumda tekrar eder.
Öneri (varsayım): "yeterli aile" = en az 5 açık aile ve bunların en az 3'ünün farklı cevap havuzu ≥ 200.
K0 tek başına bu koşulu sağlıyor (`alpha-order`, `letter-code`, `letter-analogy` geniş), yani K0 açılırsa
kısa VR oturumu kurulabilir.

## Pilot deneme kuralıyla ilişkisi

Rev. 3 kuralı: iki uygun ailede üçer yeni sorunun tamamı yardımsız doğru. Yorumumuz: "uygun aile" = bu
tablodaki koşulu sağlanmış aile; üç soru o ailenin kendi VR sorusu (ilk yoklamaya planlayıcı koyar).
**Bu yorum Astra'ya sorulacak:** alternatif, üç sorunun merdiven önkoşul maddeleri olması.

## İkinci inceleme için

- Her aileden 5–10 gerçek soru üretip (`generateItem(band, type, seed)`) gereken beceri sütununu soruların
  kendisinden doğrulamak; özellikle `front-letter` (yazım hafızası mı, tanıma mı) ve `compound-front`.
- K0'ın ürün kararı (yukarıda).
- Eşlemelerin pilotta nasıl sınanacağı: önkoşulu karşılayan çocuğun ailede yardımsız doğru oranı, karşılamayanınkinden belirgin yüksek mi.

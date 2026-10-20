# Tuto — Sözel akıl yürütme (VR): soru ailesi başına önkoşul tablosu (taslak 2, 2026-10-19)

Karar bağlamı: `ENGLISH-SKILL-LADDERS.md`, "Navigasyon ve sözel akıl yürütme" (rev. 3). VR oturumu yalnız
önkoşulu karşılanmış ailelerden soru çeker. Veri: `src/lib/literacy/vrPrereqs.js`, karar: `vrOffer.js`.

**Taslak 2 nasıl yapıldı:** her aileden 7 gerçek soru üretildi (`node scripts/english/vr-sample.mjs`) ve her satırın
"gereken beceri" sütunu soruların kendisinden okundu. Taslak 1 üreticilerin kaynak kodundan çıkarılmıştı.

## Taslak 1'den ne değişti

1. **7-8 ailelerinin çoğu harf bulmacası; kelimeyi bilmek gerekmiyor.** `anagram-pair` (host/shoe/most/shot/shop),
   `not-from-letters` (HEART'tan "rot" yapılamaz), `change-pattern` (dig→dog, pit→pot, hip→?), `word-ladder`
   (TEN→?→FIN), `unscramble` (şıklar verili olduğu için harf sayımıyla çözülüyor): hepsi harf harf kontrol edilerek
   çözülüyor, çünkü şıkların hepsi gerçek kelime ve doğru olan yalnız harf kuralıyla ayrılıyor. Taslak 1 bunlara B2/D1
   demişti; asıl yük **harf**. `letter-code` kodlama yönü alfabe sırası istemiyor, yalnız harf eşleme; çözme yönü
   büyük harfli anahtarla küçük harfli şıkları eşlemeyi istiyor (probe `case`).
2. **Ürün tabanı (kullanıcı, 2026-10-18: "VR'ı açmak için bir okuryazarlık tabanı olmalı").** Yük tek başına
   ölçüt olsaydı harf aileleri hiç İngilizcesi olmayan çocuğa (Osman) ilk gün açılırdı. Bu yüzden her aile için ayrıca
   **taban: B2 + D1** (kısa sık kelimeleri okuma ve kurma). Gerçek yük sütunu ileride ayrı karar için korunuyor.
3. **Anlam aileleri bir basamak ağır.** `pair-meaning` çiftleri B3 değil B4–B5 (remarkable/noteworthy,
   foreign/domestic, majority/minority, client/customer, feast/banquet). `compound-front` kuyrukları yetişkin kelime
   (payroll, payload, sidekick, highland) → B4. `front-letter` dört kelimeyi parçadan hatırlatıyor (double, drill,
   dear, deer; palace, please, post, place) → B3 + D2. `hidden-word` cümleleri WordNet'in yetişkin örnek cümleleri
   ("the book underwent fundamental changes", "dust particles suspended in the air") → B5 + Ca4.
4. **8-9 seviyesi kendi beş ailesiyle hiç açılamıyordu** (beş aile, beşi de açık olmalıydı). Seviye artık
   o seviye ve altındaki açık ailelerle sayılıyor, kendi bandından en az 3 aile şartıyla (oturum iki bandı karıştırabilir).

## Tablo

**Yük:** sorunun gerçekten istediği. **Gerekenler:** taban (B2 + D1) dahil değil, onun üstüne. **Probe:** merdivende
olmayan kontrol; probe yoksa aile kapalı. **Cevap:** 3000 tohumda farklı cevap sayısı.

### 7-8

| Aile | Örnek (gerçek) | Yük | Gerekenler | Probe | Cevap |
|---|---|---|---|---|---|
| `letter-sum` | a=5, b=7, c=8, d=9; c − b → 1 | harf + 24'e kadar işlem | — | — | 43 |
| `anagram-pair` | host / shoe / most / shot / shop → host + shot | harf | — | — | 154 |
| `not-from-letters` | HOSPITAL: also / lit / lot / top / tag → tag | harf | — | — | 755 |
| `change-pattern` | dig→dog, pit→pot; hip → hop | harf kuralı | — | — | 468 |
| `word-ladder` | BOOK → ? → ROOT: hook / room / boot / look → boot | harf | — | — | 433 |
| `unscramble` | LMAP: camp / meal / slap / male / lamp → lamp | harf | — | — | 214 |
| `letter-code` | LOST = 1234; LOT → 1 2 4 / SALE = 1234; 3 4 1 1 → less | harf eşleme; çözmede büyük/küçük harf | — | `case` | 674 |
| `letter-analogy` | LM : OP = OP : ? → RS | alfabe sırası | — | `alphabet` | 89 |
| `alpha-order` | brake / tank / stream / roll / noise, 3.? → roll | alfabe sırası (ilk harfler farklı) | — | `alphabet` | 1174 |
| `letters-in-order` | dry / glad / see / oil / ton → dry | alfabe sırası, her harf çifti | — | `alphabet` | 85 |
| `join-letter` | tal(_)og → l (tall, log) | yazımdan kelime hatırlama | B2, D2 | — | 20 harf |
| `front-letter` | _ouble _rill _ear _eer → d | dört kelimeyi parçadan hatırlama | B3, D2 | — | 22 harf |
| `logic-grid` | "Kofi and Priya have yellow bikes…" Who has a red bike with baskets? | cümle okuma, karşılaştırma | Ca3 | — | 24 |
| `odd-two` | fox / breakfast / wolf / dinner / dog → breakfast + dinner | kategori | B3 | — | 150 |
| `pair-meaning` | tall, short (most opposite); yanlışlar: quick, fast / salad, soup / sea, see | eş/zıt anlam, sık kelime | B4 (B3'e inmesi açık karar) | — | 90 |
| `compound-front` | brush / pin / cut / style → hair | bileşik kelime bilgisi | B4 | — | 31 |
| `analogy` | wolf : howl = frog : ? → croak | ilişki + belirli kelime (hayvan sesi, yavru) | B3 | `relation-words` | 111 |
| `rhyme-synonym` | VEHICLE, star → car | eş anlam + kafiye (ses) | B4 | `rhyme-audio` | 47 |

### 8-9

| Aile | Örnek (gerçek) | Yük | Gerekenler | Cevap |
|---|---|---|---|---|
| `odd-two` | snack / dog / lunch / wolf / breakfast → dog + wolf | kategori, geniş kelime | B4 | 203 |
| `word-grid` | 12 kelime; "combine"a yakın iki → mix + fuse | eş/zıt anlam + 12 kelime okuma | B4 | 140 |
| `letter-pair` | customer → c__ent → li | anlam + yazımı tamamlama | B4, D3 | 261 |
| `shared-letters` | b___er, h___ing → itt | parçadan geniş yazım hatırlama | B4, D4 | 839 |
| `hidden-word` | "She wrote her name on the p___r." → ape | cümle okuma + yazım | B5, Ca4 | 45 |

## Seviye ne zaman "yeterli"

Seviye L teklif edilebilir: L ve altındaki açık aile ≥ 5, bunların ≥ 3'ünün farklı cevabı ≥ 200, L bandının kendi açık
ailesi ≥ 3 (varsayım). Sonuç:
- Taban (B2 + D1) karşılanınca 7-8 açılır: beş harf ailesinin dördü geniş (not-from-letters, change-pattern,
  word-ladder, unscramble).
- 8-9 en erken B4 + D3/D4'te açılır; `hidden-word` B5'i bekler.

## İçerik bulguları (1–4 düzeltildi 2026-10-19; 5 açık)

Tablodaki örnek ve cevap sayıları düzeltmeden sonra yeniden ölçüldü (`vr-pool.mjs`).

1. **`rhyme-synonym` SPONGE → cake:** "sponge" = kek yalnız İngiliz kullanımı; UK/US ortak kapsam kararıyla çelişiyor.
2. **`compound-front`:** payroll, payload, sidekick gibi yetişkin bileşikler 7-8'de.
3. **`hidden-word`:** WordNet örnek cümleleri yetişkin ve yer yer bozuk ("water is the element of fishes",
   "if you want to leave early you have to ask the foreman"); 7 örnekte aynı ev sahibi kelime (fundamental) iki kez.
4. **8-9 `odd-two`:** dorm, hash, automobile, technician, basin: Amerikan ya da çocuğa uzak kelimeler; "can / purse"
   (kap) ve "organ" (vücut) grupları belirsiz.
   **Düzeltme (2026-10-19):** (1) UK ya da US'e bağlı ipuçları çıktı: SPONGE→cake, EVENING MEAL→tea, AUTUMN→fall,
   RENT→hire, FRIEND→mate, PIPS→seeds; yerine 10 ortak ipucu. (2) `compound-front` artık elle yazılmış
   `COMPOUND_HEADS` (31 baş, her biri ≥4 çocuk bileşiği, UK/US ortak); sözlükten türetilen eski hâlin yarısı bileşik
   bile değildi (bar+gain, man+age, sea+son). (3) `hidden-word` elle yazılmış 53 cümle (`HIDDEN_SENTENCES`), cevap ve
   çeldiriciler Dale-Chall üç harflileri; WordNet örnek cümleleri artık kullanılmıyor. (4) `odd-two`'da kap, vücut
   bölümü ve "case" grupları çıktı; dorm, hash, automobile, technician, basin, sedan, laundry, lounge, ridge, organ,
   queen (böcek), servant, bathtub, robe üye değil; 7-8 havuzu daralınca Dale-Chall kelimesi 3.4'e kadar inebiliyor.
5. **`pair-meaning`:** çeldirici çiftler rastgele okunuyor ("board, ugly", "thick, thrown"); bilinçli seçilmiş değil.
   **Düzeltme (2026-10-20):** dördüncü çift artık kitaptaki gibi **sesteş** (sea, see; tail, tale): elle yazılmış
   `PAIR_SOUND_ALIKE`, 32 çift, iki IPA sözlüğünde de sesteş, aksana duyarlı olanlar (root/route) yok. Aynı türden
   çift `odd-two`'nun filtrelerinden geçiyor (`childGroups`); ham okunduğunda `dish, empty`, `skull, tooth`, `laundry,
   shirt` çıkıyordu. Doğru çift küçük bantta iki kelimesi de Dale-Chall ya da Zipf ≥ 4.7 olmalı (elle yazılmış zıtlar
   muaf); tek lehçeli ya da okunduğundan seyrek olanlar `PAIR_MEANING_YOUNG_SKIP` (rent/hire, autumn/fall,
   pavement/sidewalk, graze/scratch, brook/stream, foreign/domestic). Bulgu 3'teki remarkable/noteworthy,
   majority/minority, client/customer, feast/banquet artık 7-8'de çıkmıyor. Doğru çift havuzu 153 → 90 (3000 seed × 2 çeşit).
   Gereken basamak B4'te bırakıldı; çiftler artık B3 kelimesi, indirmek kullanıcı kararı.

## Açık

- Probe'lar (alfabe, büyük/küçük harf, ilişki kelimesi, sesli kafiye) yazılmadı; bu ailelerin hepsi kapalı.
- Taban B2 + D1 bir ürün kuralı, ölçülmüş eşik değil. Harf ailelerini İngilizcesi olmayan çocuğa açmak ayrı bir karar.
- Pilot deneme kuralının VR maddesi soran yoklaması yok.
- Bu tablo VR'nin 7-8 ve 8-9 bantlarını kapsıyor. `tuto-app` çalışma ağacındaki yeni bantlar (6-7, vr-9-10, vr-10-11,
  vr-11-12; commit edilmedi) eklendiğinde aynı yöntemle satır eklenecek.

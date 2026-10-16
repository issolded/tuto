# Tuto — İngilizce: beceri başına zorluk basamakları (taslak)

Tarih: 2026-10-16. Yazan: Claude, Codex'le yazışmadan sonra. Durum: tartışma taslağı, kod yok. Revizyon 2: Codex'in 2026-10-16 notları işlendi.
Bağlam: `ENGLISH-LITERACY-ARCHITECTURE.md` (Codex) mimariyi tarif ediyor; bu belge onun içine
konacak **içeriğin** iskeleti. Mimarinin beceri profili, sunucu yetkisi, sürümleme ve
yardımlı/bağımsız ayrımı aynen geçerli; burada tekrar edilmiyor.


## Etkinlik dili (kullanıcı kararı, 2026-10-16)

İngilizce etkinliğinin soru, metin, şık, yönerge, ipucu ve yanlış sonrası açıklamalarının
tamamı İngilizcedir; `children.language` bunları çevirmez. Geri/çıkış, ayarlar ve genel
uygulama kontrolleri çocuğun seçtiği dilde kalabilir; ebeveyn iletişimi `prefs.language` kullanır.
Başlangıçta kısa İngilizce yönerge, görsel, ses ve her yeni cevap biçiminin ilk karşılaşmasında
puansız çözülmüş örnek kullanılır. Örnekte öğretilen hedefin sonraki sorusu bağımsız kanıt sayılmaz.
Yanlış sonrası temel kelimede doğru resim + İngilizce kelime sesi yeterli olabilir.
Yönergeyi anlamama hâlâ alternatif hata sebebidir; İngilizce içerik tek başına ölçüm eşitliği
sağlamaz. İlk biçim karşılaşması ve destek kaydedilir. Bu bölümdeki değişiklik tasarım kararıdır;
uygulama kodu ve ses/görsel varlıkları bu düzenlemede değişmedi. Native etkisi: yok.

## Üzerinde anlaştıklarımız

- Tuto öğretmez, ölçer: çocuğun gösterdiği beceriye uygun quiz seçer.
- Aynı ürüne 7 yaşında anadili İngilizce bir çocuk da, 11 yaşında hiç İngilizcesi olmayan
  bir çocuk da gelir. Matematik gibi yaşla sıralanan tek bir müfredat yok.
- **Tek puan yok. Her becerinin kendi zorluk sırası var.** CEFR ile UK Year uç uca eklenmez;
  kaynaklar (Cambridge YLE, Scholastic, UK müfredatı, mevcut motor) basamakları dolduran
  malzemedir, basamağın kendisi değil.
- Basamaklar **geçici tasarım**dır. Gerçekte o sırayla zorlaştıkları pilot verisiyle doğrulanır.
- Yaş ve ebeveyn bilgisi yalnız **ilk soruyu** seçer. Sonraki yönü cevaplar belirler.
- "Bir üst basamağı dene" ile "bu beceri tamam" ayrı kararlar. Üç şıklı 4 soruda rastgele
  cevaplayan %11 ihtimalle 3 doğru yapar: bu, bir üst soruyu denemeye yeter, beceriyi
  kazanmış saymaya yetmez. "Tamam" farklı örneklerden ve sonraki oturumlardan kanıt ister.
- Ebeveyne etiket değil, ne yapabildiği gider ("Kısa cümleleri anlıyor; geçmiş zamanda
  daha çok yoklama gerekiyor"). Aynı kanıt ebeveynin kökenine göre farklı adlandırılmaz.
- Ses kapalıysa dinleme becerisi **bilinmiyor** kalır, başarısız sayılmaz.

## Beş alan

| Alan | Kısaca | Ses gerekir mi |
|---|---|---|
| A. Dinlenen kelime ve cümle | Duyduğunu anlıyor mu | Evet, şart |
| B. Yazılı kelime anlamı | Okuduğu kelimenin anlamını biliyor mu | Hayır (A ile birlikte yorumlanır) |
| C. Cümle | İki ayrı iz: **C-anlam** (cümleyi anlıyor mu) ve **C-doğru** (doğru biçimi seçebiliyor mu) | Hayır |
| D. Yazım | Kelimenin nasıl yazıldığını biliyor mu | Alt basamakta dikte için evet, yoksa resim + harf kutusu |
| E. Metin anlama | Kısa metinden bilgi ve çıkarım | Hayır |

C'nin ikiye ayrılması Codex'in notu: "The dogs is running" cümlesini anlamak ile uyum
hatasını fark etmek aynı beceri değil.

## Alanlar arası kural: hedef dışı kelime yükü

"Yanlış cevap başka hangi sebepten olabilir?" sorusunun en sık cevabı **kelimeyi bilmemek**.
Bunu tamamen eleyemeyiz (B2'yi geçen çocuk B2'deki her kelimeyi bilmez), ama küçültebiliriz:

1. Etiket kelimeye değil **anlama** bağlanır: "light" (ışık) ile "light" (hafif) iki ayrı madde.
2. C, D ve E sorularında **hedef dışındaki** kelimeler kontrollü seçilir: mümkün olduğunca
   en tanıdık basamaktan (B1–B2), ve çocuğun B'de gösterdiği düzeyi aşmayacak şekilde.
   Bu bir yük azaltma kuralıdır, "kelimeyi bilmiyordu" ihtimalini ortadan kaldırmaz.
3. **Kilitleme yok.** B bilinmiyorsa öbür alanlar en alta kapanmaz; profil kısa yoklamalarla
   araştırılır. Konuşması güçlü, okuması zayıf çocuğun profili ancak böyle görünür.
   Bilinmeyen alan "yetersiz" değil "bilinmiyor" sayılır.
4. Önkoşul gerçekten gerekmedikçe konmaz: sesle verilen kelimeyi yazdırmak (D dikte) için
   yazılı kelime basamağını (B) geçmiş olmak gerekmez.

Etiketin kaynağı: B1–B3 için Cambridge YLE kelime listeleri (Starters, Movers, Flyers; herkese
açık yayınlanıyor, yalnız düzey etiketi olarak kullanılır, soru metni bizim). B4–B6 için mevcut
motorun kullandığı kelime sıklığı (Zipf) eşikleri; sıklık kelime düzeyinde, anlam etiketi elle.

## Kanıt kaydı: cevap biçimi ayrı tutulur

Aynı beceri farklı cevap biçimleriyle farklı kanıt verir. Kayıt `alan + basamak` değil
`alan + basamak + cevap biçimi`dir:

- Yazımda: harf kutularını sıralamak (kurma) ≠ seçeneklerden doğru yazımı tanımak (tanıma) ≠
  sesle verilen kelimeyi yazmak (dikte). Biri ötekinin yerine sayılmaz.
- Kelimede: duyduğunu resimle eşleme ≠ okuduğunu resimle eşleme ≠ tanımdan kelime bulma.
- Metinde: şıktan seçme ≠ olayları sıralama.

Bir üst basamağı denemek için aynı biçimde tutarlı bağımsız cevap yeter; "tamam" demek için
farklı örnekler ve sonraki oturumlar gerekir (yukarıdaki %11 hesabı).

## Tablolar

Sütunlar: **Örnek** (gerçek bir soru), **Ölçtüğü**, **Yanlışın başka sebebi**, **Varlık**
(ses / görsel), **Bugün nerede** (Codex lab = `src/lib/literacy`, motor = `src/lib/englishTemplates.js`
tip adı, ya da yok). Her basamakta 2–3 örnek.

Her alanın son basamağı **somut tavan**: o basamağı güvenle geçen çocukta o alan yoklanmaya
devam eder ama daha zoru yoktur; ebeveyne "bu alanda bizim kapsamımızın üstünde" denir,
daha ileri bir yeterlik tahmin edilmez.

### A. Dinlenen kelime ve cümle

| Basamak | Örnek | Ölçtüğü | Yanlışın başka sebebi | Varlık | Bugün nerede |
|---|---|---|---|---|---|
| A1 | 🔊 "apple" → 4 resim: 🍎 🍌 🐶 🚗 | Sık, somut kelimeyi duyup tanıma | Resmi tanımama (🥤 bardak mı fincan mı); ses kısık; çeldirici aynı sesle başlıyorsa (apple/ant) dikkat | Ses + görsel | Yok |
| A1 | 🔊 "three" → 3 / 4 / 8 nokta | Sayı kelimesi | Saymada hata (sayı az olsun) | Ses + görsel | Yok |
| A2 | 🔊 "jumping" → 4 eylem resmi | Eylem ve sıfat (Movers) | Eylem resimleri belirsiz; emoji eylemde zayıf, özel çizim gerekebilir | Ses + çizim | Yok |
| A2 | 🔊 "tall" → uzun / kısa iki çocuk resmi | Zıt sıfat | Karşılaştırma resmi net değilse | Ses + çizim | Yok |
| A3 | 🔊 "The cat is under the table." → 3 sahne | Kısa ifade, konum kelimesi | Kelimeleri biliyor, "under/on"u bilmiyor: zaten ölçülen bu | Ses + sahne çizimi | Yok |
| A3 | 🔊 "Two red balls." → sayı + renk değişen 3 resim | İki bilgiyi birlikte tutma | Renk ya da sayının birini kaçırma | Ses + sahne | Yok |
| A4 | 🔊 "Tom has a dog. His sister has two cats." → "Who has cats?" (yüz resimleri) | İki cümle, kim/ne | Kısa süreli bellek; şıklar yazılıysa okuma | Ses + resimli şık | Yok |
| A5 (tavan) | 🔊 Doğal hızda 40–60 kelimelik günlük konuşma → "Why is Sam late?" | Açık ayrıntı + tek adımlı çıkarım | Bellek; şık okuma; konuşma hızı | Ses + şık | Yok |

**A'nın tavanı:** tanıdık konuda, doğal hızda kısa bir konuşmadan açık ayrıntıyı ve tek adımlı
çıkarımı yakalamak. Bu kapsamı bağımsız ve tutarlı çözen çocuk temel sorularda tutulmaz; anadil tek başına tavan kanıtı değildir.

### B. Yazılı kelime anlamı

| Basamak | Örnek | Ölçtüğü | Yanlışın başka sebebi | Varlık | Bugün nerede |
|---|---|---|---|---|---|
| B1 | "dog" → 4 resim | Yazılı somut kelime + anlam (Starters) | **Kod çözme:** Türkçe okuyan çocuk "knife"ı "k-ni-fe" okur. Eşleşmiş kelimelerde tekrarlanan A doğru/B yanlış örüntüsü yazılı tanımada güçlük ihtimalini gösterir; kesin tanı değildir | Görsel | Yok. Codex lab `meaning` tanımdan kelime soruyor: başlangıç kelimesi kanıtı değil, B5–B6'da kullanılabilir |
| B1 | "red" → 4 renk kutusu | Renk kelimesi | Renk algısı (renk körlüğü: kırmızı/yeşil yan yana konmaz) | Görsel | Yok |
| B2 | "I cut the bread with a ___." knife / spoon / cup | Cümle içinde kelime (Movers) | Cümleyi okuyamama → hedef dışı kelimeler B1'den | Yok | Codex lab `cloze`. Kural: aynı kategoriden çeldirici yetmez, **bağlam öbürlerini açıkça elemeli** ("soup with a cup" savunulabilir, "cut with a spoon" değil) |
| B2 | Hangisi farklı: apple, banana, **chair**, grape | Kategori | Kelimelerden birini bilmeme | İsteğe bağlı görsel | Motor `odd-two` (o "hangi İKİSİ" soruyor, akıl yürütme yükü; tek farklı daha temiz) |
| B3 | "hot"un zıttı: cold / big / fast / wet | Sık sıfatlarda zıt anlam (Flyers) | Soru yönergesini anlamama (İngilizce yönerge; ilk karşılaşmada puansız örnek) | Yok | Motor `antonym` 7-8 bandı (less → more) |
| B3 | "child" ile aynı anlam: kid / milk / parent | Sık eş anlam | "parent" ilişkili kelime tuzağı: çeldirici bilinçli | Yok | Motor `synonym` 7-8 (child → kid) |
| B4 | "choose" ile aynı anlam: select / cheap / face | Orta sıklıkta eş anlam | Kelime biliniyor, eş anlam kavramı yerleşmemiş | Yok | Motor `synonym`, `antonym` 8-9 |
| B5 | "a **string** of beads" → chain / cure / jacket | Çok anlamlı kelimenin bağlamdaki anlamı | Cümlenin geri kalanını okuyamama | Yok | Motor `sense` |
| B5 | Farklı olan: glad / cheerful / delighted / **anxious** | Orta sıklıkta anlam grubu | Kelimelerden birini bilmeme | Yok | Motor `odd-synonym` (biçim farkı taşıyan çeldiriciler, ör. awful/dreadful/**worst**, bu basamakta elenmeli: anlamı değil dilbilgisini ölçer) |
| B6 (tavan) | "reluctant" → unwilling / eager / careful / tired | Düşük sıklıkta soyut kelime (UK Year 5–6 metin kelimesi) | Tanım/çeldirici kelimelerin kendisi zor olabilir: çeldiriciler hedeften kolay seçilir | Yok | Motor `synonym`/`definition` 10-11, 11-12 (tanım uzunsa okuma yükü: kısa tanım şartı) |

**B'nin tavanı:** UK Year 6 okuma metinlerinde geçen soyut kelimeleri (Zipf ≈ 3) bağlamda tanımak.

### C. Cümle

**C-anlam** (doğru anladı mı):

| Basamak | Örnek | Ölçtüğü | Yanlışın başka sebebi | Varlık | Bugün nerede |
|---|---|---|---|---|---|
| Ca1 | "The dog is on the bed." → 3 sahne (yatakta / altında / yanında) | Kısa cümle → sahne | Kelime: kural gereği B1'den | Sahne çizimi | Yok |
| Ca2 | "Where is the cat?" → On the chair. / Yes, it is. / It's black. | Soru–cevap uyumu (Movers yazılı bölümü) | Soru kelimesi (where/what/who) bilinmiyor: zaten ölçülen | Yok | Yok |
| Ca3 | "The box is not open." → kapalı kutu / açık kutu / boş kutu | Olumsuz | "not"u atlayıp okumak | Sahne | Yok |
| Ca3 | "The cat was in the garden yesterday. Today it is in the house." → bugün nerede? | Zaman bilgisi | İki cümleyi birlikte tutma | Sahne | Yok |
| Ca4 (tavan) | "Before Mia went to school, she fed the cat." → ilk ne oldu? | Bağlaçla iki olay sırası | Cümle uzunluğu; şıkları okuma | Yok | Yok |

**C-doğru** (doğru biçimi seçebiliyor mu):

| Basamak | Örnek | Ölçtüğü | Yanlışın başka sebebi | Varlık | Bugün nerede |
|---|---|---|---|---|---|
| Cd1 | "The cat ___ asleep." am / is / are | be fiili | "cat"/"cats" farkını görmeme | Yok | Codex lab `be` |
| Cd1 | "One dog. Two ___." dog / dogs / dog's | Düzenli çoğul | Kesme işaretini çoğul sanma: zaten ölçülen | Yok | Codex lab `plural` |
| Cd2 | Doğru yazılmış cümle hangisi (büyük harf) | Cümle başı ve "I" | Özel isimleri bilmeme | Yok | Codex lab `capital` |
| Cd2 | "Is the door open ___" . / ? / , | Soru işareti | Soru kalıbını tanımama (is…?) | Yok | Codex lab `punctuation` (virgül şıkkı çok zayıf çeldirici) |
| Cd3 | "Yesterday we ___ to the park." go / went / goed | Geçmiş zaman, düzensiz | "Yesterday"yi bilmeme: B kuralı | Yok | Motor `past-tense` (kelimeleri basamağa göre süzülmeli: "swim" iyi) |
| Cd3 | "The dogs ___ running." is / are / am | Özne–fiil uyumu | Çoğulu fark etmeme | Yok | Yok (Codex `be` genişletilebilir) |
| Cd4 | "My brother and ___ walked to school." I / me / myself | Zamir durumu (yazılı standart) | Konuşma dilinde "me" doğal: yazı normu olarak etiketlenir | Yok | Motor `grammar-cloze` |
| Cd4 | "It is the ___ of them all." best / most good / better | Karşılaştırma | — | Yok | Motor `comparative` |
| Cd4 | she is → she's / s'hes / shes | Kısaltma | — | Yok | Motor `contraction` |
| Cd5 | "the lead of a puppy" → puppy's lead / puppys' lead | İyelik kesme işareti | Tekil/çoğul ayrımı | Yok | Motor `apostrophe` |
| Cd5 | "It was half ___ eight." past / passed | Sesteş kelimeyi bağlamda seçme | — | Yok | Motor `homophone-cloze` |
| Cd6 (tavan) | "The cake ___ by my aunt." was made / made / is make | Edilgen yapı (UK Year 6 SPaG) | — | Yok | Yok (`grammar-cloze` genişletilir) |
| Cd6 (tavan) | "The boy ___ lives next door is my friend." who / which / what | İlgi zamiri | — | Yok | Yok |

**C'nin tavanı:** UK Year 6 dilbilgisi-noktalama-yazım sınavındaki yapılar (edilgen, ilgi cümlesi,
öne alınmış zarf sonrası virgül). Bunların listesi herkese açık müfredatta.
**Not:** konuşma dilinde yaygın olan ama yazı normunda yanlış sayılan biçimler ("If I was you",
"my brother and me went") ayrı etiketlenir: ölçtükleri şey "yazılı standart İngilizce"dir, genel
doğruluk değil. Ebeveyne giden cümle de bunu söyler.

### D. Yazım

| Basamak | Örnek | Ölçtüğü | Yanlışın başka sebebi | Varlık | Bugün nerede |
|---|---|---|---|---|---|
| D1 | 🐱 resmi + c / a / t kutuları → "cat" kur | 3–4 harfli kelimeyi kurma | Kelimeyi bilmeme (B1'e bağlı); **resmi değil tanımı verirsek okuma ölçeriz** | Görsel (ses varsa dikte) | Codex lab `build` (bugün tanımla; başlangıç için resim gerekir, tanımlı hâli okuma da ölçer) |
| D2 | "fi_" + 🐟 → sh / ch / th | Ünsüz grupları sh/ch/th/ck | Çeldirici hedef sesten seçilmeli; rastgele harf (q/x) ölçmez | Görsel | Codex lab `missing` (çeldiriciler bugün rastgele harf; hedef sesten seçilmeli) |
| D3 | "cake" mi "caik" mi "kake" mi | Sessiz e ve uzun ünlü | — | İsteğe bağlı ses | Yok |
| D3 | baby → babies / babys / babyes | Çoğul yazım kuralı | Kelimeyi bilmeme | Yok | Motor `plural` (kelimeler basamağa süzülmeli: "observatory" D3 değil) |
| D4 | run + ing → running / runing / runeing | Ek alırken ünsüz ikizleşmesi | — | Yok | Motor `suffix` kısmen |
| D4 | agreem_nt → e / a / i | Vurgusuz ünlü | — | Yok | Motor `missing-vowel` |
| D5 | _nocking → k / h / d | Sessiz harf | — | Yok | Motor `silent-letter` |
| D5 | sover__gnty → ei / ie | ie/ei | — | Yok | Motor `ie-ei` |
| D5 | forma___ → tion / sion / cian | Ek yazımı | — | Yok | Motor `ending` |
| D6 (tavan) | Yanlış yazılmış: necessary / **reccomend** / rhythm | UK Year 5–6 zorunlu kelime listesi | Tanıma ≠ yazma: şıklı soru doğru yazımı **tanımayı** ölçer, yazabilmeyi değil | Yok | Motor `misspelt` (UK Year 5–6 listesiyle beslenmeli; liste açık lisanslı) |

**Not (ses bilgisi):** motorda `rhyme`, `homophone`, `syllables` var. Bunlar yazıdan değil sesten
bilinir ve aksana göre değişir (UK/US ayrımı motorda var, ama Codex'in "ortak içerik" kararıyla
yalnız iki profilde de aynı olanlar alınmalı). Ses dosyası olmadan bunları yazım alanına koymak
kafiye/hece bilgisini değil, o kelimeyi zaten tanımayı ölçer. Öneri: şimdilik merdiven dışı.

**D'nin tavanı:** UK Year 5–6 zorunlu yazım listesindeki kelimelerin doğru yazımını tanımak.

### E. Metin anlama

| Basamak | Örnek | Ölçtüğü | Yanlışın başka sebebi | Varlık | Bugün nerede |
|---|---|---|---|---|---|
| E1 | 2–3 cümle ("Mia has a red ball. She gives it to Tom.") → "Who has the ball now?" (yüzler) | Açık ayrıntı | Kelime (B kuralı); şıklar resimli | Görsel | Yok |
| E2 | 4 cümlelik metin → açık ayrıntı | Metinde bilgiyi bulma | Okuma hızı değil (süre ölçülmez) | Yok | Codex lab `detail` (6 metin, 12 soru) |
| E2 | Aynı metin → 3 olayı sırala | Olay sırası | Sıralama etkileşimi (dokunarak, sürüklemesiz) | Yok | Codex lab `sequence` "ilk ne oldu" soruyor: E1–E2 için başlangıç anlama sorusu olarak kullanılabilir, olay sıralama kanıtı sayılmaz (tam sıralama ayrı soru) |
| E3 | 6–8 cümle → "Why did the paper bend?" | Açık neden–sonuç | Neden sorusunu yönergeden anlamama (İngilizce yönerge; ilk karşılaşmada puansız örnek) | Yok | Yok |
| E4 | 120–200 kelime → ana fikir / "How does Ali feel at the end?" | Ana fikir, basit çıkarım | Metin uzunluğu ve dikkat | Yok | Yok |
| E5 (tavan) | 250–350 kelimelik kurgu ya da bilgi metni → yazarın amacı, olgu/görüş, karakterin nedeni | UK Year 6 okuma sınavı soru tipleri | Uzun metinde dikkat; bilgi metninde konu bilgisi | Yok | Yok |

**Basamağı tek başına metin uzunluğu belirlemez.** Kısa bir metindeki çıkarım sorusu, uzun
metindeki açık bilgi sorusundan zor olabilir. Her metin sorusu dört özellikle etiketlenir:
uzunluk, kelime düzeyi (B), cümle yapısı (C), gereken işlem (açık bilgi / sıralama /
neden–sonuç / çıkarım / amaç). Tablodaki basamaklar bu dördünün tipik birleşimleri; sıralama pilotla doğrulanır.

**E'nin tavanı:** UK Year 6 okuma sınavı düzeyinde bir metinde çıkarım ve yazarın amacı.
E en pahalı alan: her metin elle yazılır ve okunur, otomatik üretilmez (Codex'in kararı, katılıyorum).

## Merdivene girmeyen motor tipleri: akıl yürütme modülüne

Bunlar İngilizce bilgisinden çok **kelimelerle akıl yürütme** ölçüyor; anadilli çocuk için iyi
11+ hazırlığı, Türk/İspanyol çocuk için ölçtüğü şey belirsiz. İngilizce merdiveninden çıkıp
"sözel akıl yürütme" olarak ayrı yaşamalı (bkz. ürün kararı: NVR evrensel, VR yalnız
İngilizce okuyan çocuğa varsayılan açık):

`anagram-pair`, `letter-code`, `front-letter`, `alpha-order`, `join-letter`, `change-pattern`,
`word-ladder`, `not-from-letters`, `letter-analogy`, `analogy`, `rhyme-synonym`, `compound-front`,
`pair-meaning`, `logic-grid`, `unscramble`, `letters-in-order`, `letter-sum`, `word-grid`,
`letter-pair`, `shared-letters`, `hidden-word`, `odd-two`.

Merdivene giren motor tipleri: `synonym`, `antonym`, `sense`, `odd-synonym`, `definition`, `plural`,
`singular`, `past-tense`, `suffix`, `root-word`, `prefix-antonym`, `missing-vowel`, `apostrophe`,
`misspelt`, `ending`, `ie-ei`, `silent-letter`, `contraction`, `homophone-cloze`, `grammar-cloze`,
`comparative`. Sınırda: `gender`, `collective`, `proverb` (kelime/kültür bilgisi; C'ye değil
B5–B6'ya yakın), `rhyme`, `homophone`, `syllables` (ses bilgisi, yukarıdaki not).

**Önemli:** motor tiplerinin kelime eşiği bugün **yaş bandına** bağlı (`BANDS[...]`). Merdivende
kullanılınca bant değil, kelime basamağı (B kuralı) seçmeli. Yani tipler aynen alınır,
kelime süzgeci değişir.

## Sınama: iki uç çocuk

Amaç başlangıç basamağını kimlikten çıkarmak değil, **sistemin her iki çocukta da doğru yönü
bulabildiğini** görmek.

**7 yaş, anadili İngilizce (UK).** İlk soru yaşa göre her alanda orta-alt basamaktan.
- A: **Sınanacak:** üst basamak sorularını bağımsız ve tutarlı çözen çocuk temel sorularda
  gereksiz yere tutuluyor mu?
- B: okuma çözme sınırlayıcı olabilir. B5–B6'da yanlışlar kelimeyi bilmemekten değil,
  okuyamamaktan gelebilir. **Sınanacak:** B'nin üst basamaklarında okuma yükü düşük mü?
- C-anlam yüksek, C-doğru orta (Cd4'teki "my brother and me" anadillilerin klasik hatası).
- D ve E yaşa uygun okuryazarlık düzeyinde. Burası bu çocuk için asıl ölçülen yer.

**11 yaş, İngilizceye sıfırdan başlayan (TR).** İlk soru ebeveyn "yeni başlıyor" dediyse alt basamaktan.
- İlk sorular temel içerikten seçilir; diğer alanlar otomatik kapanmaz. Kısa, düşük kelime yüklü yoklamalarla profil araştırılır.
- **Temel düzeyde zorlanma modülü kapatmaz.** Yanlış sonrası anlaşılır geri bildirim ve amaçlı tekrar sürer; bağımsız yoklama ile pratik ayrı kaydedilir. Çocuk geçebilir veya çıkabilir. Ebeveyn bildirimi ve gizleme kararı aşağıdaki "Temel düzeyde zorlanan çocuk" bölümüne uyar.
- Yönergeler dahil etkinlik içeriği **İngilizce**. Kısa yönerge, ses/görsel ve puansız örnekle etkileşim tanıtılır; yönergeyi anlamama hedef beceride başarısızlıkla otomatik eşitlenmez.
- Görsel üslup 11 yaşında bebeksi durmamalı (Codex'in "yaş sunumu belirler" notu).
- Eşleşmiş kelimelerde (aynı kelime hem dinlenen hem yazılı) tekrar eden "A doğru, B yanlış"
  örüntüsü kesin tanı değildir: yazılı kelimeyi tanımada zorlanabileceğini gösterir. Ebeveyne de
  bu ihtiyatla gider ("Duyduğu kelimeleri tanıyor; aynı kelimeleri yazılı görünce daha çok zorlanıyor"),
  "İngilizcesi zayıf" ya da "okuyamıyor" diye değil.

## Varlık ihtiyacı (kabaca, ölçülmedi)

- **Ses:** A alanının tamamı + D1 dikte. Kelime başına bir kayıt (Starters–Flyers ~1.400 kelime)
  + A3–A5 için birkaç yüz cümle. UK ve US ses ayrı. Önceden üretilir, dinlenip onaylanır;
  çalışma anında model yok.
- **Görsel:** A1–A2, B1, D1–D2, Ca1/Ca3, E1. Somut isimlerde bulmacalardaki Noto emoji çizimleri
  kullanılabilir; Starters listesinin ne kadarını kapsadıkları **ölçülmedi**. Eylem ve sahne
  (kedi masanın altında) için birkaç parçadan oluşan basit SVG sahne gerekir.
- **Metin:** E2–E5 için elle yazılmış metinler. En yavaş büyüyecek alan.

## Açık sorular (Codex ve kullanıcı için)

1. **Bağımsız yoklama ile amaçlı tekrar nasıl ayrılır?** Daha önce görülen bir maddeye ikinci cevap
   "bağımsız kanıt" sayılmaz; ama ilerlemeyi görmek için aynı becerinin yeni örneği gerekir. Banka
   büyüklüğü bu ayrımdan çıkar, tersinden değil.
2. (Karara bağlandı, aşağıda: "Temel düzeyde zorlanan çocuk".)
3. Ses yokken (cihaz sessizde) A alanı hiç sorulmasın mı, yoksa "sesi aç" diye bir kez istensin mi?
4. Tavana çıkan alan ne sıklıkla yeniden yoklansın (unutma / yanlış yükseltme kontrolü)?
5. Ebeveyne giden "ne yapabildiği" cümlelerinin listesi: alan × basamak başına bir cümle, üç dilde.
6. Mevcut İngilizce kartı (sözel akıl yürütme) ne zaman ve nasıl yeniden adlandırılıyor?

## Temel düzeyde zorlanan çocuk (kullanıcı kararı, 2026-10-16)

**İngilizce günlük görev olarak kalır; karar ebeveynde.** Çocuk yanlış yapa yapa da öğrenebilir;
Tuto modülü kendiliğinden geri çekmez.

- **Yanlış cevap bir karşılaşma olmalı:** en alt basamaklarda yanlıştan sonra doğru cevap resmi ve
  sesiyle gösterilir (🔊 dog → 🐶). Aynı kelimenin sonraki görülüşü **pratik** olarak kaydedilir,
  bağımsız kanıt sayılmaz. Yardımdan sonra doğru ile bağımsız doğru ayrı tutulur: denemeyi
  destekler, seviyeyi olduğundan yüksek göstermez.
- **"Zorlanıyor" kararını kod verir.** Kural deterministik: en alt iki basamakta yeterli sayıda
  farklı soruda (ör. 15–20) bağımsız doğru oranı tahmin düzeyine yakınsa. Eşik pilotla ayarlanır.
- **Ebeveyne bir kez yazılır** (bayrakla kaydedilir, cevap gelmezse tekrarlanmaz), ebeveynin dilinde
  (`prefs.language`). Model yazar, olgu kodda:

  > Ahmet'in son iki İngilizce etkinliğinde temel kelime sorularında zorlandığını fark ettim.
  > Şimdilik daha kolay sorularla devam ediyoruz; İngilizceye biraz daha zaman ayırmak yardımcı
  > olabilir. İstersen İngilizce görevini Tuto'da geçici olarak gizleyebilirim, bana söylemen yeterli.

  "Daha kolay sorularla devam ediyoruz" yalnız gerçekten daha kolay içerik varsa söylenir;
  çocuk zaten en alt basamaktaysa bu cümle çıkarılır. Tanı koymaz, gördüğünü söyler.
- **"Bana söylemen yeterli" gerçek olmalı:** sohbette görevi gizleme/açma aracı (`update_task_reward`
  `active`) `576db82` ile origin/main içinde mevcut; commit kaydı gerçek model/yazma engelli probe testinde gizleme için 3/3 doğru çağrı bildiriyor. Codex kodu ve commit kaydını doğruladı, model testini yeniden çalıştırmadı. Literacy dalı henüz o commiti içermiyor; yeni görevin task_type bağlantısı entegrasyonda doğrulanacak. Görev Ayarları ekranında kapatma zaten var.

## Sonraki adım (Codex'le anlaşılan)

Kodlamadan önce küçük bir **deneme seti**: her alandan başlangıç, orta ve tavan basamağından
birkaç soru, elle yazılmış. Önce soruların gerçekten ne ölçtüğü doğrulanır (tek doğru cevap,
hedef dışı yük, cevap biçimi); otomatik yükseltme eşikleri onun üzerine kurulur.


Deneme seti: `ENGLISH-TRIAL-SET.md` (2026-10-16, Codex). Yazılı editoryal taslak; ses/görsel üretimi ve çocuk testi bekliyor.

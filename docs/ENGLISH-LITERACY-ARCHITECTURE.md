# Tuto — İngilizce okuryazarlık: beceri haritası ve mimari taslağı

Tarih: 2026-10-15. Durum: mimari önerisi. İlk yerel lab artık mevcut (bkz. LITERACY-PILOT.md); adaptif sistem, migration ve yayın yapılmadı.
İncelenen checkout: `claude/ios-native`, HEAD `5e634845adae240c81b942ece95e39c44c7a85ac`; yerel değişiklikler var.
`git pull` uzak dal takibi olmadığı için başarısız; bu taslak güncel remote ile karşılaştırılmış değildir.


## Etkinlik dili (kullanıcı kararı, 2026-10-16)

**Güncelleme (2026-10-17, kullanıcı):** İngilizce bölümüne girildiğinde ekranda çıkan her şey İngilizcedir: doğru/yanlış geri bildirimi, Gönder, Bilmiyorum, İpucu, Devam, sonuç ekranı dahil. Çocuğun uygulama dili bölümün içinde hiçbir metni değiştirmez; bölümden çıkınca (ana ekran, ayarlar) geçerlidir. Ebeveyn mesajları `prefs.language` ile kalır. Aşağıdaki "genel uygulama kontrolleri çocuğun dilinde" cümlesi bu güncellemeyle geçersiz.

İngilizce etkinliğinin soru, metin, şık, yönerge, ipucu ve yanlış sonrası açıklamalarının
tamamı İngilizcedir; `children.language` bunları çevirmez. Geri/çıkış, ayarlar ve genel
uygulama kontrolleri çocuğun seçtiği dilde kalabilir; ebeveyn iletişimi `prefs.language` kullanır.
Başlangıçta kısa İngilizce yönerge, görsel, ses ve her yeni cevap biçiminin ilk karşılaşmasında
puansız çözülmüş örnek kullanılır. Örnekte öğretilen hedefin sonraki sorusu bağımsız kanıt sayılmaz.
Yanlış sonrası temel kelimede doğru resim + İngilizce kelime sesi yeterli olabilir.
Yönergeyi anlamama hâlâ alternatif hata sebebidir; İngilizce içerik tek başına ölçüm eşitliği
sağlamaz. İlk biçim karşılaşması ve destek kaydedilir. Bu bölümdeki değişiklik tasarım kararıdır;
uygulama kodu ve ses/görsel varlıkları bu düzenlemede değişmedi. Native etkisi: yok.

## 1. Ürün sınırı ve temel ayrım

2026-10-16 ek: içerik basamakları `ENGLISH-SKILL-LADDERS.md`, 36 maddelik editoryal örneklem
`ENGLISH-TRIAL-SET.md` içindedir. Temel sorularda zorlanma İngilizce görevini otomatik gizlemez;
yanlış sonrası geri bildirim ve pratik sürer. Gizleme ebeveyn kararıdır. Bildirim ayrıntıları
basamak belgesindeki “Temel düzeyde zorlanan çocuk” bölümündedir; sayısal eşikler doğrulanmış değildir.

İlk içerik ve kullanılabilirlik pilotu 6–8 yaş odağında. Bu bir seviye kilidi değildir:
9 yaş başlangıç öğrencisi temel içerik alabilir; 7 yaş ileri okuyucu kanıtıyla ilerleyebilir.
Ancak ileri çocuk pilot bankanın tavanına ulaşırsa motor daha zor içerik varmış gibi davranmaz.
6–8 dışı yaşlarda sunum ve içerik uygunluğu ayrıca doğrulanmadan geniş yaş kapsamı ilan edilmez.

Yaş; konu, görsel sunum ve güvenli içerik sınırını belirler. İngilizce becerisi; soruyu belirler.
Yaş, ülke, okul sınıfı, arayüz dili veya anadil tek başına yeterlik kanıtı değildir.
Grade etiketleri kaynak metadata'sıdır; Tuto seviyesi, UK Year veya CEFR karşılığı değildir.
İlk ürün okuryazarlık pratiği ve ölçümüdür; konuşma, dinleme, akıcılık veya kapsamlı dil kursu iddiası yoktur.

## 2. Tek English seviyesi yerine beceri profili

Alanlar: kelime çözme, spelling, vocabulary, grammar/noktalama, okuduğunu anlama.
Writing üretimi ayrı izlenir: seçenek seçmek, sıralamak ve kopyalamak serbest yazma kanıtı değildir.
Tek bir toplam ortalama, bir alandaki güçlü performansla diğer alandaki boşluğu kapatamaz.

Her beceri için: `unknown / exploring / practising / secure`, kanıt sayısı, farklı madde/aile
sayısı, bağımsız ilk cevaplar, yardım kullanımı, son görülme ve yeniden kontrol zamanı.
Bunlar başlangıç ürün durumlarıdır; doğrulanmış psikometrik seviyeler veya olasılıklar değildir.
Yanlış bir grammar cevabı aynı anda vocabulary ve reading'i düşürmez; soru birincil ölçtüğü
beceriyi açıkça taşır, diğer gereklilikler hata yorumunu sınırlamak için tutulur.

Örnekler (varsayımsal, gerçek çocuk verisi değil):
- 9 yaş yeni başlayan: yaşına uygun gündelik/keşif konuları, kısa ve temel İngilizce.
- 7 yaş ileri okuyucu: cümle çözmede gereksiz tekrar yerine kısa metin ve çıkarım yoklaması.
- Kelime okuması güçlü, grammar zayıf çocuk: okuma basamağı korunur, grammar temelinden çalışılır.
- İngilizce konuşması güçlü ama yazılı kelime çözmesi zayıf çocuk: okuma hatasından genel dil yetersizliği çıkarılmaz.

## 3. Kaynaklardan çıkarılan başlangıç beceri haritası

A/B/C aşağıda tasarım basamaklarıdır; yaş veya Grade eşdeğeri değildir. Kesin önkoşul sırası
ve başarı eşikleri pilot sonuçları ve eğitimci incelemesiyle doğrulanmalıdır.
K = kurallı üretim, V = editoryal kelime/ses/görsel verisi, C = kontrollü cümle bankası,
M = metin + soru + kanıt bankası. K hiçbir zaman veri gerektirmeyen sınırsız üretim demek değildir.

| Alan | A: temel | B: genişleyen | C: pilot üst sınırı / sonraki genişleme | Üretim |
|---|---|---|---|---|
| Kelime çözme | Doğrulanmış basit ses–harf eşlemeleri, kısa ünlüler, basit kelimeler | sh/ch/th/ck, sessiz e ve seçili ünlü grupları | Aynı sesin farklı yazımları, seçili iki heceli kelimeler | K+V; ses sorularında doğrulanmış ses kaydı şart |
| Spelling | Anlamı/sesi verilen temel kelimeyi kurma, eksik parçayı tamamlama | Uzun ünlü yazımları, başlangıç/son ses grupları | -ing/-ed değişimleri, ou/ow, oi/oy, r etkili gruplar | K+V; ses profiline göre kabul listeleri |
| Vocabulary | Somut nesne/eylem/nitelik, anlam–resim eşleme | Cümlede anlam, kategori, bağlamlı eş/zıt anlam | Çok anlamlılık, basit eklerle anlam, metinden anlam | V+C/M; sözlükten rastgele eşanlam seçilmez |
| Grammar/noktalama | Cümle başı ve I, nokta/soru, temel kelime sırası | İsim/fiil/sıfat, çoğul, am/is/are, zamir, özne–fiil uyumu | Geçmiş zaman, seçili düzensizler, iyelik, contractions, yardımcı fiiller | K+C+V; doğal cümle ve alternatif cevap kontrolü |
| Anlama | Cümle–sahne eşleme, kısa metinde açık ayrıntı | Olay sırası, açık neden–sonuç, kişi/yer, bağlamda anlam | Ana fikir, kanıta dayalı basit çıkarım, karşılaştırma, olgu/görüş | M; başlangıçta serbest otomatik soru üretimi yok |
| Kontrollü yazma | Sözcük seçme/yerleştirme | Cümle düzenleme, noktalama düzeltme | Cümle birleştirme | K+C; writing profiline serbest üretim olarak yazılmaz |
| Serbest yazma | Kendi cümlesi | Bağlantılı birkaç cümle | Kısa paragraf | Ayrı değerlendirme; ilk deterministik pilotun dışında |

Kaynak dayanakları:
- Morning Jumpstarts Reading G1: başlangıç sesleri, kelime/resim, kısa metin, kelime aileleri,
  çoğul ve anlam ilişkileri. El yazısı ayrı beceridir; ekranda tıklamaya çevrilince ölçtüğü şey değişir.
- Spelling G1: kısa/uzun ünlüler, th/sh/ch/wh/ck ve ar/or; G2 bu başlıkları daha karmaşık
  kelimelerle tekrarlar, -ing/-ed, oo, ou/ow, oi/oy gibi alanlar ekler. Aynı başlık tek zorluk değildir.
- Grammar G1: cümle, büyük harf, kelime sırası, isim/fiil/sıfat, çoğul; G2 geçmiş zaman,
  zamir, be, go/do, not contractions ve uyum; G3 özne/yüklem, yardımcı fiil, iyelik ve daha
  geniş zamir/fiil çalışmaları. G3 konuları otomatik olarak ilk sürüm taahhüdü değildir.
- Reading Comprehension G3: ana fikir/ayrıntı, sıralama, yönerge, bağlam, çıkarım,
  olgu/görüş, karşılaştırma, neden–sonuç. Bu kitap başlangıç okuyucusuna doğrudan seviye atanmaz.

Eksikler: bağımsız vocabulary kapsamı ve kontrollü görsel/kelime havuzu; Grade 1'den ileri
anlamaya kademeli özgün/açık lisanslı metinler; dengeli kurgu/bilgi/günlük metin; ses varlıkları.
Reading G2 ve vocabulary kaynağı içerik kapsamını iyileştirir; mimariyi başlatmanın önkoşulu değildir.

## 4. Başlangıç yoklaması: on soru tanı koymaz

Onboarding: isteğe bağlı `yeni başlıyor / kelime ve kısa cümle / kısa metin / emin değilim`.
Bu cevap başlangıç tahmini; ebeveyn beceri durumunu doğrudan `secure` yapamaz.
Emin değilimde yaş yalnız zayıf bir başlangıç ipucu, alt/üst sınır değildir.
Genel uygulama dili ile etkinlik dili ayrıdır; etkinlik yönergeleri de İngilizcedir. Yönergeyi anlamamayı doğrudan grammar hatası saymamalıyız.

Önerilen 10 puanlanan madde bütçesi (pilot tasarımı, kalibre edilmiş test değil):
1–4: farklı alanlarda kısa giriş yoklamaları: kelime/anlam, spelling, grammar, cümle anlama.
5–8: görülen belirsizliklere göre daha temel veya ileri, farklı örneklerle doğrulama.
9–10: bağımsız kısa metin uygunsa aynı mini metne iki anlama sorusu; değilse temel beceri yoklamaları.
Bir alandaki başarısızlık diğer tüm alanların sorularını otomatik kolaylaştırmaz.
Aynı metindeki iki cevap bağımsız iki metin kanıtı sayılmaz.
Ses yoksa ses becerisi `unknown` kalır; görsel eşleme ses çözme veya akıcı okuma kanıtı değildir.

Kısa etkileşim tanıtımı puanlanmaz. Destek, geçme ve çıkma mümkün. Eksik oturum başarısızlık
sayılmaz; gözlenen kanıt saklanır, sonraki oturum devam edebilir. İpucundan sonraki cevap
pratik olarak kaydedilir; bağımsız başlangıç kanıtı yapılmaz. Sesle metin okunursa destekli
anlama olarak kaydedilir; bağımsız reading ölçümüyle birleştirilmez.

Sonuç: genel Grade/yaş etiketi değil, geçici beceri başlangıçları ve bilinmeyen alanlar.
Sonraki oturumlar az miktarda yoklamayı sürdürür. Yalnız yaştan veya tek yanlış/tek doğrudan
kalıcı atama yok. İlk sürüm IRT/CAT doğruluğu iddia etmez; açık kurallı bir yönlendiricidir.

## 5. Oturum planlayıcı

Sıra: uygun onaylı içerik -> beceri/önkoşullar -> belirsizlik ve yeniden kontrol ihtiyacı ->
yaşa uygun konu/sunum -> tekrar önleme -> deterministik seçim.
Önkoşullar iki tür: içerikte gerçekten gereken okuma/kelime bilgisi ve öğretim sırası önerisi.
İleri çocuk, önkoşulun geçmiş kaydı yok diye temel egzersizlere kilitlenmez; kısa yoklamayla geçebilir.

Başlangıç hipotezi: yaklaşık %60 mevcut çalışma, %20 tekrar, %20 yoklama; oranlar ürün denemesiyle
ayarlanır. On soruda her alanı zorunlu gösterme yok; kapsam birkaç oturuma yayılır.
Geçici yükseltme farklı örneklerle yapılabilir; `secure` için en az iki oturuma ve birden fazla
madde ailesine yayılmış bağımsız kanıt gerekir. Kesin sayısal başarı eşiği henüz seçilmedi.
Tepki süresi kaydedilse bile cihaz/okuma hızı yüzünden ilk pilotta seviye düşürme ölçütü olmaz.

Tavan: uygun daha zor madde yoksa `coverage_ceiling` kaydedilir. Ebeveyne mevcut kapsamın
rahat geldiği söylenir; daha ileri yeterlik tahmin edilmez. Taban: temel sorularda da zorlanıyorsa
aynı başarısızlık dizisi sürdürülmez; kısa destekli pratik ve kapsam sınırı açıklaması.
Uygun içerik tükenirse daha yüksek zorluğa/görülmüş soruya sessiz fallback yok; oturum kısalır.

## 6. İçerik ve uygulama mimarisi

Ayrı sürümlenmiş `literacy` motoru önerilir. Mevcut `english` VR geçmişi olduğu gibi kalır;
eski sonuçlar yeni reading/vocabulary mastery kanıtına dönüştürülmez. Kart adları ve geçmişin
UI'daki konumu ayrıca kararlaştırılacak; bu taslak onları değiştirmez.

Önerilen modüller: curriculum (beceri grafiği), lexicon (anlam/ses/çekim), sentenceBank,
passageBank, generators, validators, planner, evidenceReducer. Bunlar yeni dosya önerileridir.
- Kelime kaydı: sense ID, sözcük türü, çekimler, spelling variety, grapheme/phoneme eşlemesi,
  pronunciation profile, ses/görsel ID, uygun beceriler ve kaynak/lisans.
- Cümle kaydı: sabit anlam/sahne, kontrollü slotlar, kabul edilen varyantlar, hedef beceri,
  okuma yükü. Kelimeleri rastgele doldurmak yerine geçerli kombinasyonlar.
- Metin paketi: revision, metin, dil/okuma yükü, tema, sorular, kabul edilen cevaplar,
  evidence spans, çeldirici gerekçeleri, kaynak ve uyarlama kaydı.
- Soru: ID/revision, generator revision+seed, primary skill, prerequisites, response mode,
  zorluk özellikleri, content family, variety/audio profile. Yaş difficulty alanı değildir.
- Deneme: sunucudaki soru snapshot/revision, ilk cevap, denemeler, kullanılan destek,
  sonuç, zaman; istemci `correct` veya mastery yazamaz.

Sunucu yetkili olur: oturum üretimi, cevap kontrolü, beceri güncelleme, ödül.
Cevap anahtarı ve doğruluğu açığa çıkaran metadata cevap öncesi istemciye gitmez.
POST denemelerinde idempotency, çocuğa/oturuma sahiplik ve sıra kontrolü gerekir.
Seed tek başına yeterli değil: içerik ve generator değişince eski soru değişmemeli.
Sürüm/snapshot eski inceleme, yarım oturum ve tekrar gönderimde korunmalı.
Beceri reducer'ı ham denemelerden yeniden hesaplanabilir; ödül ledger'ı bununla yeniden ödenmez.

DB taslağı: literacy_sessions, literacy_attempts, literacy_skill_state; gerekirse ayrı içerik
manifesti. İlk yerel lab bunları kullanmadan sahte depo ile çalışabilir. Canlı entegrasyonda
migration tam SQL olarak kullanıcıya verilir; mevcut production DB'ye test yazılmaz.
Ödül mevcut yardım/bağımsızlık yaklaşımıyla uyumlu kalır, assessment için ayrı kazanç açığı
oluşturulmaz. Yeni görev kotası/Hezarfen ve tekrar assessment ödülü implementasyon öncesi netleşmeli.

## 7. UK/US ve erişilebilirlik

**Kullanıcı kararı (2026-10-15): ilk pilotta mümkün olduğunca UK/US ortak içerik.**
Seçilen kelime anlamı, yazım, dilbilgisi kabul kümesi ve hedef ses ilişkisi iki profilde de
geçerli olmalı. Cevabı aksana/bölgesel kullanıma göre değişen maddeler pilot havuzuna alınmaz.
`colour/color`, `centre/center`, bölgesel kelime karşılıkları, aksana duyarlı kafiye/eşseslilik,
`ask/fast` gibi değişken ünlü grupları ve bağlamsız topluluk-özne uyumu bu kapsamda elenir.
Bütün phonics alanı kaldırılmaz: iki doğrulanmış profilde aynı hedef ilişkiyi taşıyan örnekler
kullanılabilir. Ortaklık denetimi bilinmeyen kayıtlar onaylanana kadar havuz dışında kalır.
UK/US metadata ve mevcut çocuk tercihi korunur; tercih silinmez, iki ayrı müfredat üretilmez.
Yönergelerde mümkün olduğunda terim yerine işaret/örnek kullanılır (ör. period/full stop
ayrımı yerine nokta işareti); çocuğun geçerli bir varyantı yanlış ilan edilmez.
Bu seçim bütün aksanların aynı olduğu veya kapsamın eksiksiz olduğu iddiası değildir.


Spelling variety ile pronunciation profile ayrı metadata. UK kendi içinde tek aksan değildir.
Spelling kitaplarında kısa-a başlığında fast/ask/last örnekleri var; bazı Britanya profillerine
aynen taşınamaz. Referans: https://dictionary.cambridge.org/us/pronunciation/english/ask
Bu referans içerik lisansı veya sesleri kopyalama izni olarak kullanılmaz.
Aksana duyarlı sorular yalnız doğrulanmış ses+cevap profiliyle açılır; belirsiz olanlar pilotta elenir.
Yalnız harf sayısından hece/ses, yazımdan kafiye üretilmez.

Sesi kullanıcıya dinletmek çalışma anında LLM gerektirmez; lisanslı/özgün önceden hazırlanmış
ses kullanılabilir. Ses henüz yoksa ses sorusu yok; sistem bunun yerine aynı beceriyi ölçtüğünü
iddia eden görsel görev koymaz. Yönergeyi okutmak ile hedef metni okutmak ayrı yardım olaylarıdır.
Drag-only etkileşim olmaz: dokunarak seç/sırala alternatifi; klavye ve iPad denetimi gerekir.

## 8. Kalite kapıları ve ilk dikey dilim

Önce küçük fakat uçtan uca yerel lab: 8–12 beceri, etiketli kelime/cümle havuzu,
özgün veya lisansı doğrulanmış 6–10 mini metin; aynı içerik üzerinden üretim, yardım,
puanlama, kayıt ve sonraki soru seçimi. Bunlar pilot hedefleri, tamamlanmış içerik sayıları değil.
Tamamı çalışma anında LLM'siz. Hazırlıkta AI kullanılsa bile yayınlanmış her paket editoryal onaylıdır.

Gerekli kontroller:
- Her seçenek bağımsız kuralla kontrol edilir; birden fazla doğru çıkarsa madde reddedilir.
- Token sıralamada eşdeğer doğru dizilişler kabul edilir veya soru daraltılır.
- Grammar sorusunun sözcük yükü hedef grammar'dan gereksiz zor değildir.
- WordNet ve mevcut filtreler başlangıç malzemesi; anlam, çocuk uygunluğu ve lisans yeniden incelenir.
- Metin sorusunun dayanağı var; çeldiriciler de metin ve anlam açısından editoryal kontrol edilir.
- Yardım/ses/ikinci deneme mastery ile ödülde ayrı değerlendirilir.
- Şık konumu, tekrar, içerik ailesi çeşitliliği, üretim verimi ve boş havuz görünür ölçülür.
- Planner senaryoları: 9 yaş başlangıç, 7 yaş ileri, alanlar arası farklı profil, belirsiz profil,
  tavan/taban, yanlış ebeveyn tahmini, yarım oturum, yardım, içerik sürümü değişimi.
- QA gerçek çocuk verisine yazmaz; yaşa uygunluk ve öğrenme etkisi otomatik testten çıkarılmaz.

Native etkisi: yalnız bu taslakta yok. Uygulamada yeni response mode'ları React ve Swift/Kotlin
çizicileri ister; sunucuda beceri planlaması native'e ulaşsa bile yeni UI kendiliğinden gelmez.
İstemci paketine ortak mantık girerse iOS JavaScriptCore/Android QuickJS paketleri yeniden derlenir.
Web kabuğu ile gerçek native dağıtım farkı korunur.

## 9. İnceleme sınırı ve kaynaklar

Bu çalışma bütün kitapların her sorusunun audit'i değildir. İçindekiler, giriş ve aşağıdaki
örnek sayfalar incelendi; tablo kaynakların konu kapsamını mimariye çeviren öneridir.
Kitap metinleri, resimleri ve soru bankaları ürüne kopyalanmadı. PDF içindeki yönergeler
çalışma talimatı olarak değil, etkinlik örneği olarak okundu.

| Kaynak | İncelenen dayanak (basılı sayfa) |
|---|---|
| Morning Jumpstarts Reading Grade 1 | Giriş 4–6; örnekler 9–10, 29–30, 59–60, 99–100; 29–30 görsel doğrulandı |
| Success With Grammar Grade 1 | İçindekiler ve ilk etkinlik 4, önceki turda görsel |
| Success With Grammar Grade 2 | İçindekiler ve 33 görsel |
| Success With Grammar Grade 3 | İçindekiler ve 25 görsel |
| Success With Spelling Grade 1 | İçindekiler metni, 4 ve 19 görsel |
| Success With Spelling Grade 2 | İçindekiler metni, 4 ve 33 görsel |
| Success With Reading Comprehension Grade 3 | İçindekiler 3 ve çıkarım 27 görsel |


:codex-file-citation{path="/Users/ngolokante/Downloads/Morning Jumpstarts Reading Grade 1 (Scholastic) (z-library.sk, 1lib.sk, z-lib.sk).pdf" purpose="source"}

:codex-file-citation{path="/Users/ngolokante/Downloads/Success With Grammar, Grade 1 (Scholastic [Scholastic]) (z-library.sk, 1lib.sk, z-lib.sk).pdf" purpose="source"}

:codex-file-citation{path="/Users/ngolokante/Downloads/Success With Grammar, Grade 2 (Scholastic [Scholastic]) (z-library.sk, 1lib.sk, z-lib.sk).pdf" purpose="source"}

:codex-file-citation{path="/Users/ngolokante/Downloads/Success With Grammar, Grade 3 (Scholastic [Scholastic]) (z-library.sk, 1lib.sk, z-lib.sk).pdf" purpose="source"}

:codex-file-citation{path="/Users/ngolokante/Downloads/Scholastic Success with Spelling Workbook, Grade 1 (Scholastic Inc.) (z-library.sk, 1lib.sk, z-lib.sk).pdf" purpose="source"}

:codex-file-citation{path="/Users/ngolokante/Downloads/Scholastic Success With Spelling Workbook, Grade 2 (Scholastic Inc.) (z-library.sk, 1lib.sk, z-lib.sk).pdf" purpose="source"}

:codex-file-citation{path="/Users/ngolokante/Downloads/Success with Reading Comprehension Grade 3 (Scholastic) (z-library.sk, 1lib.sk, z-lib.sk).pdf" purpose="source"}

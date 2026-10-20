# İngilizce deneme seti — editoryal taslak 2

2026-10-16 · Codex · `codex/literacy-pilot`, taban commit `5e63484`.
Kaynak çerçeve: ENGLISH-SKILL-LADDERS.md revizyon 2 ve kullanıcı kararı.
36 özgün madde: A, B, Ca, Cd, D, E izlerinde başlangıç / orta / kapsam tavanı adayı × ikişer soru.
Bu bir yerleştirme sınavı veya tek oturum değildir. Basamaklar doğrulanmış zorluk değildir;
CEFR/Year eşdeğerliği çıkarılmaz. Örnekler mevcut motordan çalıştırılarak üretilmedi.
Cevap/gerekçe sütunundaki çocuk metinleri İngilizcedir. Köşeli parantezlerdeki görsel/oynatma tarifleri ve Türkçe risk notları yalnız editör içindir; çocuk ekranına basılmaz.
Kod, ses ve resim üretilmedi; burada belirtilen varlıklar hazırlanıp denetlenmeden çocuk testi başlamaz.
Tavan örnekleri bütün üst basamak müfredatını temsil etmez; yalnız seçilen alt becerilerin örnekleridir.


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

## Uygulama ve kayıt

- Yönerge dahil bütün etkinlik içeriği İngilizcedir; hedef metin çevrilmez. A alanında soru ve seçenekler de sesli; yazı gösterilmez. Diğer alanlarda hedef metni okutmak destek sayılır.
- Tablodaki köşeli parantezler görsel üretim tarifidir; çocuk ekranında metin olarak gösterilmez.
- Şık sırası burada editoryal; lab'da sabit anahtar konumu olmayacak. Anahtar harfe değil seçenek kimliğine bağlı tutulacak.
- Kayıt: item/revision, hedef alt beceri, önerilen basamak, cevap biçimi, ilk yanıt, yardım, önceki karşılaşma, sonuç, ses oynatma/tekrar ve erişim sorunu.
- Ses tekrarı izinli ve kaydedilir; tek başına yanlış sayılmaz. Sesin gerçekten duyulduğu kısa, puansız denemeyle kontrol edilir. Duyulmayan soruda kanıt yoktur.
- Yanlış sonrası doğru cevap ve kısa İngilizce açıklama gösterilir. Başlangıç kelimelerinde doğru resim + denetlenmiş İngilizce ses birlikte sunulur. Aynı hedef kelimenin sonraki karşılaşması pratik olarak işaretlenir; başka resim/şık sırası bunu yeni bağımsız kelime kanıtı yapmaz.
- İlk turda A/B eşleşmiş hedefler ayrı deneme gruplarında veya geri bildirim öncesinde kullanılmalı; A'da cevabı öğrendikten sonra B'deki başarı bağımsız karşılaştırma değildir.
- Görseli okuyamayan çocuk için sözlü etiketle sunum değiştirilirse bu yeni cevap biçimi olarak kaydedilir; sonuçlar sessizce birleştirilmez.
- İngilizce günlük görev olarak kalır. Ebeveyn bildirimi için 36 maddelik bu set tek başına yeterli değildir: başlangıç maddeleri az, biçimler ve şık sayıları farklıdır. 15–20 soru ve tahmin düzeyi eşiği hâlâ taslak; bu sette otomatik bildirim/kapama/Gem yok.

## A — Dinlenen kelime ve cümle

| ID / aday | Çocuğun duyacağı içerik ve seçenek | Anahtar ve yanlış sonrası gerekçe | Ölçtüğü / karışabilecek yük | Varlık / bugün |
|---|---|---|---|---|
| A01 / A1 | “dog”; [kedi] / [köpek] / [tavşan] | [Doğru köpek resmi vurgulanır; ses: “dog”.] | Duyulan dog anlamı; hayvan çizimlerini ayırma | 1 kelime sesi + 3 resim; yeni |
| A02 / A1 | “apple”; [muz] / [armut] / [elma] | [Doğru elma resmi vurgulanır; ses: “apple”.] | Duyulan apple anlamı; meyve görseli | 1 kelime sesi + 3 resim; yeni |
| A03 / A3 | “The ball is under the chair.”; [sandalyenin üstünde] / [altında] / [yanında aynı top] | [Doğru sahne vurgulanır; ses: “The ball is under the chair.”] | Konum; ball/chair bilgisi ve sahne okuma | Ses + yalnız konumu değişen 3 sahne; yeni |
| A04 / A3 | “Two cats are sleeping.”; [iki uyuyan kedi] / [bir uyuyan kedi] / [iki koşan kedi] | [İki uyuyan kedi vurgulanır; ses: “Two cats are sleeping.”] | Sayı + eylem; sayma ve uyku çizimi | Ses + 3 sahne; yeni |
| A05 / A5 | A05 konuşması; “Why do they choose the table?”; “To eat lunch.” / “To keep the paper dry.” / “To watch the rain.” | “To keep the paper dry. It is raining, so they choose a table under a roof.” | Kısa konuşmadan neden çıkarımı; bellek, seçenek dinleme | Konuşma/soru/3 şık sesi; yeni |
| A06 / A5 | A06 konuşması; “Why do they go back?”; “To get a book.” / “To find a coat.” / “To close a window.” | “To get a book. Leo left it on the kitchen table.” | Kısa konuşmadan neden; bellek, seçenek dinleme | Konuşma/soru/3 şık sesi; yeni |

A05 (özgün, ses metni; çocukta transkript yok):

> Mia: Shall we draw outside? I have paper and pencils in my bag.
> Ben: Look at those clouds. It is starting to rain, and the paper will get wet out here.
> Mia: There is a table under that roof. We can sit there.
> Ben: Good idea. Let's take our things over.

A06 (özgün, ses metni):

> Leo: We are nearly at the library. Have you got the book we need to take back?
> Kim: I thought you had it. I only put my coat in this bag.
> Leo: Oh, I left the book on the kitchen table.
> Kim: Let's go back and get it. We still have time.

Sesler için UK/US profili ayrı tutulur; aynı cevap her iki profilde de geçerli olacak şekilde
editoryal inceleme yapılır. Üretilecek sesler dinlenmeden “onaylı” sayılmaz.

## B — Yazılı kelime anlamı

| ID / aday | Soru ve seçenek | Anahtar ve gerekçe | Ölçtüğü / karışabilecek yük | Varlık / bugün |
|---|---|---|---|---|
| B01 / B1 | dog → [köpek] / [tavşan] / [kedi] | [Köpek resmi vurgulanır; ses: “dog”.] | Yazılı dog anlamı; çözümleme + resim | A01 resimleri; yeni görsel biçim |
| B02 / B1 | apple → [armut] / [elma] / [muz] | [Elma resmi vurgulanır; ses: “apple”.] | Yazılı apple anlamı; çözümleme + resim | A02 resimleri; yeni görsel biçim |
| B03 / B3 | What is the opposite of hot? cold / big / fast | “Cold is the opposite of hot.” | Zıt anlam; opposite yönergesini bilme gereksinimi puansız örnekle tanıtılır. | Metin; antonym benzeri, bu madde yeni |
| B04 / B3 | “The child picked up a bag.” Which word means the same as child here? kid / parent / teacher | “Kid means child here.” | Bağlamlı eşanlam; picked up/bag yükü | Metin; synonym benzeri, bu madde yeni |
| B05 / B6 | “Eva was reluctant to try the new game.” What does reluctant mean here? not wanting to try / ready to start at once / unable to see the game | “Reluctant means not wanting to do something.” | Soyut kelime anlamı; seçenek okuma yükü | Metin; yeni, sense/definition yaklaşımı |
| B06 / B6 | “We had sufficient paper for everyone.” What does sufficient mean here? more than we could carry / enough for what we needed / less than we needed | “Sufficient means enough for what is needed.” | Soyut miktar kelimesi; enough ve seçenek yükü | Metin; yeni |

B03 temel zıt anlam yoklamasıdır; ince anlam ayrımı kanıtı değildir. Opposite kavramı farklı hedeflerle puansız örnekte tanıtılır.

## Ca — Cümle anlamı

| ID / aday | Soru ve seçenek | Anahtar ve gerekçe | Ölçtüğü / karışabilecek yük | Varlık / bugün |
|---|---|---|---|---|
| CA01 / Ca1 | “The cat is on the bed.” → [yatak altı] / [yatak yanı] / [yatak üstü kedi] | [Doğru sahne vurgulanır; ses: “The cat is on the bed.”] | Konum cümlesi; cat/bed ve sahne | 3 sahne; yeni |
| CA02 / Ca1 | “The box is open.” → [tam kapalı kutu] / [kapağı açık kutu] / [açık çanta] | [Açık kutu vurgulanır; ses: “The box is open.”] | Durum + nesne; üçüncü şık nesne tanımayı da gerektirir. | 3 resim; yeni |
| CA03 / Ca3 | “The window is not open.” → [açık pencere] / [açık kapı] / [tam kapalı pencere] | [Kapalı pencere vurgulanır; ses: “The window is not open. It is closed.”] | Olumsuzluk + window/door ayrımı; CA02 ile aynı resim/cevap çifti kullanılmaz. | 3 yeni resim; yeni |
| CA04 / Ca3 | “Yesterday the cat was outside. Today it is in the house.” Where is the cat today? in the house / outside / the text does not say | “In the house. The text says: Today it is in the house.” | Zaman ayrımı; iki cümle ve belirsizlik şıkkını okuma | Metin; yeni |
| CA05 / Ca4 | “Before Mia went to school, she fed the cat. After school, she read a book.” What happened first? read a book / went to school / fed the cat | “She fed the cat first, before she went to school.” | Before ile anlatım sırasından farklı olay sırası; üçüncü olay ek okuma yükü getirir. | Metin; yeni |
| CA06 / Ca4 | “After Ben washed his hands, he ate an apple. Then he drank some water.” What happened first? ate an apple / washed his hands / drank some water | “He washed his hands first. Then he ate an apple and drank some water.” | After; üç olay ve fiil söz varlığı | Metin; yeni |

CA02–CA06 artık üç şıklıdır; bu tahmini ortadan kaldırmaz. CA02/03’te yalnız iki olası açık/kapalı durumuna üçüncü eşdeğer resim eklemek yerine nesne ayrımı da kullanıldı; karışan yük kayıtlıdır. CA05/06 aynı beceri ailesidir; iki farklı madde olmak iki farklı beceri ailesi kanıtı değildir.

## Cd — Cümlede doğru biçim

| ID / aday | Soru ve seçenek | Anahtar ve gerekçe | Ölçtüğü / karışabilecek yük | Varlık / bugün |
|---|---|---|---|---|
| CD01 / Cd1 | “The cat ___ asleep.” are / am / is | “The cat is asleep. Use is with the cat.” | Be uyumu; asleep anlamı | Metin; lab be biçimi |
| CD02 / Cd1 | “One dog. Two ___.” dogs / dog's / dog | “Two dogs. Add s for more than one dog. No apostrophe is needed.” | Düzenli çoğul; apostrof görseli | Metin; lab plural biçimi |
| CD03 / Cd3 | “Yesterday we ___ to the park.” goed / went / go | “Yesterday we went to the park. Went is the past form of go.” | Düzensiz geçmiş; yesterday bilgisi | Metin; motor past-tense benzeri |
| CD04 / Cd3 | “The dogs ___ running.” am / is / are | “The dogs are running. Use are with the dogs.” | Çoğul özne uyumu; running kelimesi | Metin; lab be uyarlaması |
| CD05 / Cd6 | “The cake ___ by my aunt yesterday.” made / was made / is make | “The cake was made by my aunt yesterday. My aunt made the cake.” | Edilgen biçimi tanıma; aunt/yesterday | Metin; yeni |
| CD06 / Cd6 | “The girl ___ lives next door is my friend.” which / what / who | “The girl who lives next door is my friend. Who refers to the girl.” | İlgi zamiri seçimi; cümle uzunluğu | Metin; yeni |

CD01 ve CD04 farklı basamak adayları olsa da aynı uyum ailesine yakındır. Pilot sonucu zorlukları
ayrışmazsa sırf tablo öyle dedi diye ayrı seviyeler korunmaz. Bu iki üst soru tüm grammar tavanını kanıtlamaz.

## D — Yazım (cevap biçimleri ayrı)

| ID / aday | Soru ve seçenek | Anahtar ve gerekçe | Ölçtüğü / karışabilecek yük | Varlık / bugün |
|---|---|---|---|---|
| D01 / D1 | [güneş resmi], harf kutuları n / s / u; Build the word. | [Güneş resmi ve s-u-n sırası vurgulanır; ses: “sun”.] | Verilen harflerle kurma; güneş görselini tanıma | Resim + geri bildirim sesi; lab build uyarlaması |
| D02 / D1 | [balık resmi], harf kutuları h / f / s / i; Build the word. | [Balık resmi ve f-i-s-h sırası vurgulanır; ses: “fish”.] | Harflerle kurma; dört harf ve sh grubu D01’den farklı yük getirir. | Resim + ses; lab build uyarlaması |
| D03 / D3 | “One baby. Two ___.” babys / babyes / babies | “Babies. Change the y in baby to ies.” | Çoğul yazımını tanıma; sayı/çoğul bilgisi | Metin; motor plural benzeri |
| D04 / D3 | “One toy. Two ___.” toies / toys / toyies | “Toys. Add s to toy.” | Önceki kuralı her y'ye uygulamama; toy anlamı | Metin; motor plural benzeri |
| D05 / D6 | Choose the correct spelling: necessary / neccessary / necesary | “Necessary has one c and two s letters.” | Doğru yazımı tanıma; kelime aşinalığı | Metin; misspelt biçiminin uyarlaması |
| D06 / D6 | Choose the correct spelling: reccomend / recomend / recommend | “Recommend has one c and two m letters.” | Doğru yazımı tanıma; kelime aşinalığı | Metin; misspelt biçiminin uyarlaması |

Bu altı madde dikte veya serbest yazma becerisi kanıtı vermez. Dikte henüz bu örneklemde yoktur;
D01/02'den D05/06'ya tek yükselme hesabı yapılmaz. Aynı kelimelerle denetlenmiş dikte maddeleri
ayrı sonraki dilim olabilir. Tanıma maddelerinde hedefin sesini vermemek, yazımı hafızadan
üretmeyi değil seçenekler arasında tanımayı ölçme seçimidir.

## E — Metin anlama

Metin ekranda kalır; süre sınırı yok. Soru, yönerge, alıntı ve yanıtlar İngilizcedir. Hedef metnin sesle okunması ayrı destekli sonuçtur. Aynı metindeki iki soru
tek metin ailesidir; bağımsız iki metin örneği diye sayılmaz. İki soruya cevap verilmeden
cevap/gerekçe gösterilmez; çocuk yardım isterse sonraki soruya bulaşabilecek destek kaydedilir.

### Başlangıç metni P1

> Mia has a ball. She puts it in a box. Then she closes the box.

| ID / aday | Soru / seçenek | Anahtar ve metin kanıtı | Ölçtüğü / karışabilecek yük |
|---|---|---|---|
| E01 / E1 | Where is the ball? in a box / on a bed / under a chair | “In a box. The text says: She puts it in a box.” | Açık bilgi + it göndergesi; yer şıkları okuma |
| E02 / E1 | What does Mia do after she puts the ball in the box? opens the box / closes the box / takes out the ball | “She closes the box. The text says: Then she closes the box.” | Açık olay sırası; closes/open ayrımı |

### Orta metin P2

> Ben and Sara wanted to make a bridge for a toy car. They put a sheet of paper between two books. When Ben put the car in the middle, the paper bent and the car fell. Sara folded the paper several times and put it back between the books. This time, the car stayed on the bridge. They tried a second car as well. The folded paper held both cars.

| ID / aday | Soru / seçenek | Anahtar ve metin kanıtı | Ölçtüğü / karışabilecek yük |
|---|---|---|---|
| E03 / E3 | Why did the car fall on the first try? The books fell. / The paper bent. / Sara pushed the car. | “The paper bent. The text says: the paper bent and the car fell.” | Açık neden-sonuç; bent/folded bilgisi |
| E04 / E3 | Put the events in order: [The folded paper held two cars.] [The first car fell.] [Sara folded the paper.] | “The first car fell. Then Sara folded the paper. Finally, the folded paper held two cars.” | Tam üç olay sırası; dokunarak sıralama etkileşimi |

### Tavan adayı metin P3 — The book table

> Every Friday, the school library put a small table near its door. Children could leave a book they no longer wanted and choose a different one to take home. At first, only a few children stopped. Most walked past without looking at the books.
>
> Noor liked the idea, but she noticed a problem. The books were stacked in tall piles, so only the top cover of each pile could be seen. A handwritten sign said “Book Table”, but it did not explain that children could take a book for free. One child asked how much a story cost. Another thought the table was only for returning library books.
>
> Noor asked the librarian if she could try a new arrangement for one Friday. She placed the books upright so their covers faced the door. She also made a sign: “Bring a book if you can. Choose one to keep. No money needed.” The librarian agreed to keep the table in the same place and open it at the usual time.
>
> That afternoon, more children stopped at the table than the week before. Some read the sign before choosing a book. Others pointed to a cover and called a friend over. By the end of the afternoon, many books had found new readers.
>
> Noor was pleased, but the librarian suggested trying the arrangement again. “Perhaps more children happened to come to the library today,” she said. “Let's watch what happens over the next few Fridays.” Noor kept her sign and made a simple chart. Each week, she would record how many children stopped and how many books they took. She wanted to know whether the change continued to help.

| ID / aday | Soru / seçenek | Anahtar ve metin kanıtı | Ölçtüğü / karışabilecek yük |
|---|---|---|---|
| E05 / E5 | What was missing from the first sign that explains why a child asked about the price? It did not say the books were free. / It gave the wrong opening time. / It said all the books were sold. | “The sign did not say the books were free. A child asked how much a story cost.” | İki bilgiyi birleştirip davranış nedeni; free/cost bilgisi |
| E06 / E5 | Why does the librarian suggest watching for a few more Fridays? To check whether the change keeps helping. / To wait until every child brings a book. / To decide how much each book should cost. | “To check whether the change keeps helping. More children might simply have visited that day.” | Gerekçeyi birleştirme; chart/record ve uzun metinde dikkat |

P1/P2/P3 ve altı madde özgündür, eski altı lab metninin dışında yazıldı. Mevcut detail yaklaşımı
E01/E03'e uyarlanabilir; E04 sıralama arayüzü ister; diğer maddeler yeni metin bankası içeriğidir.
Bu iki E5 sorusu yazarın amacı/olgu-görüş kapsamını temsil etmez; E alanının tüm tavanını
geçti sonucunu vermez. Uzun metin nedeniyle üst adaydır; gerçek zorluğu çocuk denemesinde görülecek.

## Editoryal inceleme ve sonraki deneme

Bu taslakta cevap anahtarları, gerekçeler ve hedef dışı yük yazar tarafından kontrol edildi;
bağımsız eğitimci incelemesi, ses dinleme, resim tanınabilirliği ve çocuk testi henüz yapılmadı.

1. Önce içerik incelemesi: ikinci makul cevap, yönerge anlaşılması, yanlış şıkların işe yararlığı.
2. Görsellerde aynı nesne/ölçek/üslup; tek değişkenli sahne. Renk tek başına cevap taşımaz. Her şıkın anlamı görselden denetlenir.
3. Ses kayıtları hazırlanır, UK/US cevap eşdeğerliği ve doğallık dinlenerek doğrulanır. Ses yokken A maddeleri sunulmaz; metne çevrilip dinleme puanı verilmez.
4. Reviewer lab'a taşınırken yönerge/geri bildirim İngilizce hazırlanır; genel uygulama kontrolleri EN/TR/ES kalabilir; puansız etkileşim tanıtımı eklenir. Bu belge çocuk ekranı değildir.
5. Küçük setler seçilir; 36 soru çocuğa art arda verilmez. Yaş yalnız sunum bağlamıdır, doğru/yanlış beklenen sonuç değildir.
6. Gözlem: nerede yardım istedi, görseli nasıl adlandırdı, yönergeyi anladı mı, açıklamadan sonra farklı örneğe aktarabildi mi? Yardım isteme tek başına düzey düşürmez.
7. Bildirim senaryosu: görev açık kalır; ebeveyn mesajı yalnız gerçekten gözlenen alanı söyler. Daha kolay içerik yoksa “daha kolay sorular” sözü verilmez; gizleme/açma aracı `576db82` ile `origin/main` içinde doğrulandı (`update_task_reward.active`). Commit kaydı gerçek model + yazmalar engelli chat-probe için gizlemede 3/3 doğru çağrı bildiriyor; Codex bu model testini yeniden çalıştırmadı. Bu dal henüz o commiti içermiyor. Yeni literacy görevinin task_type bağlantısı entegrasyonda ayrıca doğrulanacak; mevcut english aracı için “bana söylemen yeterli” önkoşulu karşılanmış olarak kaydedilir.

Native etkisi: yok; bu değişiklik yalnız içerik dokümanı, uygulama/DB/Gem değişmedi.

Revizyon 2 denetimi: 36 kimlik korundu; bütün çocuk geri bildirimleri İngilizce veya görsel + İngilizce ses tarifine çevrildi. D01/02 sun/fish oldu. Yaygın alternatif anagramlar kaldırıldı; bütün sözlükler için başka sözcük yokluğu iddia edilmez. Resim hedef anlamı belirler ve çocuk yanıtı ekrana basılmadan içerik güvenliği denetlenir. Ses ve görsel varlıklar hâlâ üretilmedi.

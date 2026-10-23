# 315 okuma hikâyesi — bağımsız inceleme (2026-10-23, Claude)

Codex’in `CLAUDE-REVIEW-315-STORIES-2026-10-23.md` isteğine cevap. Teslim dosyalarının asıllarına dokunulmadı; düzeltilmiş kopyalar `READING-STORIES-*-FIXED-2026-10-23.json` olarak ayrı yazıldı. Kullanıcı aynı gün “incele, uygula, test et, push et” dediği için düzeltmeler uygulamaya da bağlandı (`claude/english-stories-315`).

## Kapsam ve yöntem

- **Elle okunan:** 315 hikâyenin tamamı, 945 sorunun tamamı (B6 → B5 → revize 200 sırasıyla). Örneklem yok.
- **Kaynak hash’leri** teslim notuyla aynı (200: `4250d8a7…`, B5: `5601a56c…`, B6: `bef323db…`).
- **Denetçi:** `tuto-app-main/scripts/english-ladder/check-stories.mjs`, sha256 `1ecb9dd1…`; a555085’ten beri değişmedi. Model `gemini-3.8-flash`, soru başına 3 metinsiz + 2 metinli deneme; neden/çıkarım/ana fikirde 2 “ikinci savunulabilir şık” denemesi.
- **Kelime kapısı:** `scripts/english-passages/gate.mjs` sha256 `8079f38e…`, `spec.mjs` `a7ef17d9…` (değişmemiş kurallar).
- Model sonuçları ile editoryal bulgular ayrı tutuldu. Model denetiminin temiz çıkması geçiş sayılmadı; aşağıdaki mantık hatalarının hiçbirini model yakalamadı.

## Teslim edilen sürüm: otomatik sonuçlar

| Set | Hikâye | Kapı reddi | Kapı uyarısı | Soru | Metinsiz 3/3 | Metinsiz ≤1/3 (uygulama eşiği) | Metinle 2/2 olmayan | İkinci şık 2/2 | İkinci şık 1/2 | Denetçi reddi |
|---|---|---|---|---|---|---|---|---|---|---|
| B6 (15) | 15 | 0 | 7 | 45 | 3 | 39 | 0 | 0 | 0 | 0 |
| B5 (100) | 100 | 0 | 105 | 300 | 11 | 263 | 0 | 0 | 0 | 0 |
| Revize 200 | 200 | 0 | 194 | 600 | 20 | 543 | 0 | 0 | 1 | 0 |

Codex’in kayıtlı sonucu “metinsiz 3/3 = 0” idi; aynı denetçinin yeniden çalıştırılması bazı soruları yine 3/3 buldu (model sonucu koşudan koşuya değişiyor, teslim notu da bunu söylüyor). Uygulama yalnız metinsiz ≤1/3 olan soruları sunuyor; o sütun ürün eşiğidir, geliştirme hedefi (blind < 3) değil.

## Editoryal sonuç

- **B6:** mantık açısından en temiz set, ama 45 sorunun 45’inde `evidence` paragrafın tamamı; iki soruda metinde olmayan bilgi ya da yanlış nesne.
- **B5:** E3/E4 iyi; E2’nin neredeyse tamamı “First, … Next, … Last, …” kalıbında ve olaysız. Birkaç neden/çıkarım dayanaksız.
- **Revize 200:** en sorunlu set. Revizyon, kör çözücüyü yenmek için metinlere keyfi ayrıntılar ekledi (“A green bag was beside the bowl.”, “Amir had a bird on his shirt.”). Birçok E2/E3 hikâyesinde neden-sonuç koptu; bazı neden soruları renk/sayı hatırlamaya indi. Bazı yerlerde orijinal sürümden daha zayıf.

## Bulgular (71 madde) ve yapılan düzeltme

| Set | Hikâye | Soru | Önem | Sorunlu alıntı | Gerekçe | Düzeltme |
|---|---|---|---|---|---|---|
| B6 | all | ev | orta | evidence = paragrafın tamamı (45/45) | Kanıt cevabı göstermiyor; uygulamada cevaptan sonra açıklama olarak bütün paragraf çıkıyor | Her soruya cevabı taşıyan kesintisiz cümle(ler) |
| B6 | B6-E3-001 | Q2 | yüksek | [Her brother was bringing another toy] | Metin Tom’un kardeşi olduğunu söylemiyor; cevap ilişki ekliyor | “Her brother Tom was bringing a toy” |
| B6 | B6-E3-001 | metin | orta | “a big green frog” … “the little frog’s face” | Aynı kurbağa hem büyük hem küçük; Tom’un kendi seçtiği değil, ona ayrılan sandalyeyi “seçmesi” döngüsel | “small green frog”; “He liked that chair because its blanket was yellow like the frog’s cup” |
| B6 | B6-E4-003 | Q1 | yüksek | Where did Ella find the drawing? | Bulunan şey çizim değil taç; soru kökü yanlış nesneyi soruyor | “Where did Ella find the crown?” |
| B6 | B6-E4-003 | Q3 | orta | [A child helps a show by making the bear a crown.] | Hikâye Ella’nın tacı kimin yaptığını bulması; ana fikir yan olaya kayıyor | “A child finds out who made a crown for the show.” |
| B6 | B6-E4-002 | Q2 | orta | What did Raj probably think…? → [where to leave their bags] | Çıkarım değil, son cümlenin kopyası (“put their bags under the bench”) | Yeni çıkarım: neden işaretlerin bir kısmını kaçırdılar → “each read only the first sign in the line” |
| B6 | B6-E4-001 | metin | düşük | “The people on her card” | Teyzenin bir kart yaptığı söylenmeden “her card” geçiyor | “his aunt making a card at a small desk” |
| B6 | B6-E4-004 | Q1 | düşük | Which shape stood…? orange \| brown \| purple | Çeldirici renkler hikâyede yok, tahminle bulunur | Hayvanlarla: brown cat \| blue dog \| green bear |
| B6 | B6-E2-001 | metin | düşük | “they put a blue frog”, “a slow panda” | Çizimde “yavaş” görünmez; “put” ile “drew” karışık | “drew a blue frog”, “a big panda” |
| B6 | B6-E2-005 | Q1 | düşük | Where did the children take the beans from? | Fasulyeleri yalnız Ella aldı | “Where did Ella take…” |
| B5 | E2 geneli | — | not | First, … Next, … Last, … | 50 E2 hikâyesinin neredeyse hepsi aynı kalıp; sıra sorusu “First,” kelimesiyle bulunuyor; Q1/Q2 çoğu “Which object was on the X?” | Düzeltilmedi (kalite notu) |
| B5 | B5-E2-009 | Q1/Q3 | orta | green star on the big white box … through the green box | Yeşil yıldızlı beyaz kutu ile yeşil kutu karışıyor | Yıldız kırmızı |
| B5 | B5-E2-030 | Q2 | düşük | How many toy cars did the train carry? | “train with ten toy cars” taşımayı söylemiyor | “with ten toy cars on it” |
| B5 | B5-E2-033 | metin | düşük | The small toy bear sat on the mat … bounced the small bear off the chair | Ayı minderdeydi, sandalyeden sekmesi çelişiyor | “bounced the small bear on the mat” |
| B5 | B5-E2-036 | metin | orta | Outside, rain hit the pear picture first. | Resimlerin nasıl dışarı çıktığı yok (eksik adım) | “They held the paper out of the window, and rain hit…” |
| B5 | B5-E3-005 | metin | orta | Lily gave one box to Jack because she wanted him to wash it. | Neden yıkanacağı belirsiz | “Lily gave the dirty box to Jack…” |
| B5 | B5-E3-012 | Q2 | orta | because their tune had changed → [to show the new song] | “tune changed” yeni şarkı demek değil; neden-sonuç bulanık | “because they had a new song” |
| B5 | B5-E3-020 | Q2 | orta | [to give it to his aunt] / “sent his funny picture to her” | Metin teyzenin hayvanı sevdiğini söylüyor, ona vereceğini değil; “her” Zoe mi teyze mi belirsiz | “because he wanted to send it to his aunt”; “sent … to his aunt” |
| B5 | B5-E3-027 | Q2 | orta | Ella lifted her arm because Sam needed someone to hold his drawing. | El kaldırmak (söz istemek) ile çizimi tutmak karışık; öğretmen “kolu” görüp kitap alıyor | “Ella held the drawing up high because Sam wanted everyone to see it.” |
| B5 | B5-E3-030 | Q2 | orta | Nina said a toy monkey lived with them. So, the children added a flat road | “So” maymunu yola bağlıyor; neden sonraki cümlede | Tek cümlede gerçek neden |
| B5 | B5-E3-032 | Q3 | orta | opened her shop because Ben asked to see the cars … Sara had no cars | Arabası olmayan dükkânı araba görmek için açıyor | “asked to see her toys” |
| B5 | B5-E3-019 | metin | düşük | They placed picture cards by each plate to show whose seat it was … Sam sat beside Ben | Yer kartı varken başka yere oturuyor | Kartını da taşıyor |
| B5 | B5-E4-002 | Q2 | orta | What did Jack think about the museum? → [too quiet] | Kaşlarını çatması “müze çok sessiz” demek değil; çıkarım dayanaksız | “Why did Jack probably frown? → No one said anything about the toys.” |
| B5 | B5-E4-005 | Q2 | orta | Which toy would best fit…? → [a fox] | Boyut sırasıyla ilgisiz; sağduyuyla bulunur | Boyut sırası çıkarımı: daha küçük oyuncak nereye gider |
| B5 | B5-E4-012 | metin | düşük | A card fell out [of the books] | Kitapların arasına kart saklandığı söylenmiyor | Saklama adımı eklendi |
| B5 | B5-E4-013 | Q3 | orta | [drawing a ship using details from different models] | Gemi bayrağı + şato saati tek resimde; “gemi resmi” savunulamaz değil ama “şato” da savunulabilir | “drawing one picture with details from two models” |
| B5 | B5-E4-003 | metin | düşük | three small flags | Yalnız iki bayrak var | “two small flags” |
| B5 | B5-E4-001 | metin | düşük | across his hill | Tepe hiç geçmiyor | “across his grass” |
| B5 | E3 soruları | — | not | Where does Ben draw…? (şimdiki zaman) | Hikâye geçmiş, birçok soru şimdiki zaman | Düzeltilmedi (üslup) |
| R200 | genel | — | yüksek | Revizyon E2/E3 metinlerine keyfi ayrıntı ekledi | Kör çözücüyü yenmek için “A green bag was beside the bowl”, “Amir had a bird on his shirt” gibi olaysız ayrıntılar; birçok hikâyede mantık zinciri koptu (orijinalden daha zayıf) | En kötüleri yeniden yazıldı; kalanlar kalite notu |
| R200 | genel | — | orta | cause soruları sayı/renk çeldiricili | “Why did Meera bring the bear closer? → four steps” (three/five) gibi neden soruları ayrıntı hatırlamaya indi | Düzeltilmedi (kalite notu) |
| R200 | B4-E2-024 | Q3 | yüksek | a red rubber | “rubber” bölgesel (ABD’de başka anlam); proje UK/US’e duyarlı kelimeyi dışarıda tutuyor | “a red pen” |
| R200 | B4-E2-049 | Q1 | yüksek | Tom put a black bag on his head. | Kafaya siyah torba: güvenlik çağrışımı | “a small black book on his head” |
| R200 | B4-E2-058 | tümü | yüksek | First, Rita made the blue ring … His friend Rita asked Yan to make the paper ring. | Halkayı kimin yaptığı çelişiyor; “His” Yan’dan önce geliyor | Yeniden yazıldı, sorular yenilendi |
| R200 | B4-E2-069 | tümü | yüksek | Sara walked to the green rope … Two ropes were inside the circle | İplere yürümek iki ipin çemberin içinde olmasını açıklamıyor | Yeniden yazıldı |
| R200 | B4-E2-070 | Q1 | yüksek | Rita drew a bird … By the end, Rita had drawn three birds | Tek kuş çiziliyor, cevap “üç kuş” | “one bird, one star and one egg”; cevap “one bird” |
| R200 | B4-E2-098 | Q2 | yüksek | Sam moved beside the door so everyone could see the drawing. | Resmi tutan Zoe; Sam’in yer değiştirmesi kimsenin görmesini sağlamaz (canlıda düzelttiğim hatanın aynısı) | “Zoe stood beside the door…” |
| R200 | B4-E3-004 | Q3 | yüksek | He put the card inside so Priya could see it before lunch started. | Kartı kutunun İÇİNE koymak görmesini engeller; sonra kutuyu açıp gösteriyor | “because he wanted a surprise at lunch” |
| R200 | B4-E3-023 | Q2/Q3 | yüksek | enjoyed his ride to the shop … remember their ride to the park | Aynı otobüs yolculuğu hem dükkâna hem parka | Amir’in nedeni değişti |
| R200 | B4-E2-008 | Q1 | orta | in his toy boat … Lily put the red boat and the yellow boat … Only two boats | Ben’in teknesi üçüncü mü belirsiz | “his red toy boat” |
| R200 | B4-E2-029 | metin | orta | Nina put a fish on the paper … the cat looked at the box | Gerçek balık mı çizim mi belirsiz; kutu tanıtılmadan geçiyor | “drew a fish”; kutu eklendi |
| R200 | B4-E2-034 | metin | orta | Rita took it and gave it back to Yan | Yan bulduğu kartı Rita’dan geri alıyor: döngüsel teslim | Kartı Rita buluyor, Yan’a veriyor |
| R200 | B4-E2-063 | Q3 | orta | First, Ella and Leo added the paper flags. | Bayraklar henüz ortada olmayan kuleye ekleniyor | Sıra düzeltildi |
| R200 | B4-E2-088 | metin | orta | helped them make their watch right | “Their watch” hiç geçmiyor; saatlerin farklı olduğu söylenmiyor | “The clocks showed different times…” |
| R200 | B4-E2-090 | metin | düşük | A child got off and ran | Neyden indiği yok | “got off a swing” |
| R200 | B4-E3-006 | Q2 | orta | help Aisha pick the balls → choose/count/find | “pick” hem seçmek hem toplamak; iki şık savunulabilir | “choose” |
| R200 | B4-E3-013 | Q2 | orta | because she stood closest to that card | Atan Tom; Mia’nın yakınlığı neden olmaz | “closest card to Tom” |
| R200 | B4-E3-016 | Q3 | orta | draw it \| paint it | “painted its picture” → çizmek de savunulabilir | “draw” yerine “eat” |
| R200 | B4-E3-027 | Q3 | düşük | easy \| quick \| fun to draw | “quickly” → “easy” da savunulabilir | “very small” |
| R200 | B4-E3-028 | metin | orta | The girl could tell the shoe was hers. | Raj’ın rastgele çizdiği çiçekle kız ayakkabıyı tanıyamaz | Kızın öbür ayakkabısında da çiçek var |
| R200 | B4-E3-030 | Q3 | orta | chose that low bookcase because he hoped to place his toy trucks there | Taşıdığı top kutusu; kamyon gerekçesi kopuk | Kamyonları zaten orada |
| R200 | B4-E3-035 | Q2 | orta | first turn would be the quiet one → first/second/third turn | Neden sorusu anlamsız sıra sayısına indi | “wanted his turn to be quiet” → quiet/loud/hide |
| R200 | B4-E3-043 | Q2 | orta | wrote Ravi’s name because he had the card in his hands | Anlamsız neden | “because the pot was going to school” |
| R200 | B4-E3-048 | Q3 | orta | to see both things together \| to keep them in one place | İkisi aynı anlam | Çeldirici değişti |
| R200 | B4-E3-049 | Q3 | orta | listen \| think \| wait quietly | Neredeyse eş anlamlı şıklar | Çeldiriciler değişti |
| R200 | B4-E3-054 | Q2 | orta | drove the car to the door to make her street longer | Araba sürmek yolu uzatmaz | Jack blok ekliyor |
| R200 | B4-E3-059 | Q2/Q3 | orta | clock … because their book needed green things; window/plant | Saatin yeşil olduğu yok; bitki fotoğrafında pencere isteniyor | Yeşil saat; bitkinin tamamı |
| R200 | B4-E3-060 | Q1 | düşük | a red flower … count each flower | Tek çiçek sayılmaz | “red flowers” |
| R200 | B4-E3-061 | Q3 | orta | put his cap there because he needed to look for his coat | Anlamsız neden | “needed both hands for his coat” |
| R200 | B4-E3-067 | Q2 | orta | turned the box on its side to look at the top | Gerçek neden (kapı) kayboldu | “so the door would close” |
| R200 | B4-E4-001 | Q3 | orta | book \| card \| story | “story” da savunulabilir | Çeldiriciler değişti |
| R200 | B4-E4-002 | Q3 | yüksek | [counting the toys inside the boxes] (son cümlenin kopyası) | Etiket bulmacası kayboldu; “kartları okuyarak” da savunulabilir | Ana fikir yeniden yazıldı |
| R200 | B4-E4-004 | Q2 | orta | [The tree at the end of the path.] | Metin “sıradaki son ağaç” diyor, “yolun sonu” değil | “The last tree in the line.” |
| R200 | B4-E4-008 | Q3 | yüksek | [start a game] vs move a chair | Hikâye sandalyeyi taşıyıp oyunu herkese açmak; “sandalye” şıkkı daha doğru | Ana fikir: oyunu yeni çocuğa açmak |
| R200 | B4-E4-009 | metin/Q3 | yüksek | …visited different places around the school… | Tabak/parti/ziyaret dalları kopuk; ana fikir cümle kopyası | Metin sadeleşti; ana fikir: okur iki sondan birini seçer |
| R200 | B4-E4-010 | Q3 | orta | drawing wings \| marking visits | İkisini de yaptılar | Çeldirici değişti |
| R200 | B4-E4-011 | Q3 | orta | wash \| find matching socks | İkisini de yaptılar | Çeldirici değişti |
| R200 | B4-E4-020 | Q3 | orta | moving the table \| moving the lamp | Lambayı da oynattılar | Çeldirici değişti |
| R200 | B4-E4-022 | Q3 | yüksek | [test a classroom timer] vs see how time feels | Hikâyenin asıl noktası dolu dakikanın kısa gelmesi | Ana fikir değişti |
| R200 | B4-E4-023 | Q3 | düşük | improve their guide by drawing new pictures | Amir resim çizdi; savunulabilir | Çeldirici değişti |
| R200 | B4-E4-024 | Q3 | orta | make a bird drawing \| fix a torn picture | İkisini de yaptılar | Çeldirici değişti |

Toplam **66 hikâye** değişti; ayrıca **166** sorunun paragraf-boyu `evidence`’ı cevabı taşıyan kesintisiz cümlelere indirildi (B6 45, B5 60, revize 200 61). Her değişikliğin tam listesi: `READING-STORIES-315-CHANGES-2026-10-23.json`.

## Düzeltilmiş sürüm: otomatik sonuçlar

- Kelime kapısı: 315/315 geçti (ret 0).
- Değişen 66 hikâye yeniden denetlendi: 66/66 geçti; metinle 2/2 olmayan 0, ikinci şık 2/2 0, 1/2 0; metinsiz 3/3 29/198.
- Uygulamaya giren dosya: 315 hikâye; metinsiz ≤1/3 eşiğinden geçen **812 soru**, en az bir sorusu sunulan **314 hikâye**.

## Kullanıma uygunluk

- **Düzeltilmiş B6, B5, revize 200:** bulunan mantık hataları düzeltildi; otomatik kontroller temiz. Uygulamaya bağlandı (yalnız metinsiz ≤1/3 sorular sunuluyor).
- **Hâlâ açık (kalite, kullanımı engellemiyor):** B5 E2 kalıp tekrarı; revize 200’deki keyfi ayrıntılar ve ayrıntıya inmiş neden soruları; soru köklerinde zaman uyumsuzluğu. Kişi onayı ve çocukla deneme yok.
- **Öneri:** revize 200’ün E2/E3’ünü bir sonraki turda olay örgüsüyle yeniden yazmak; ayrıntı eklemek yerine çeldiricileri metinden seçmek.

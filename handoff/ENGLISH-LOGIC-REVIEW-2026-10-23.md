# İngilizce canlı içerik — mantık incelemesi (2026-10-23, Claude)

Kapsam: `origin/main` (552d823) ile yayında olan her şey. Elle okundu:
80 dinleme metni (A4/A5), 75 cümle sorusu (Ca2–Ca4, Cd6, E1), sunulan 147 hikâye
(`readingStories.generated.json`, 208 soru), 126 okuma parçası (`readingPreview.generated.json`).
Üreteçlerden (literacy motoru, VR motoru, resimli kelime) her tip için 6'şar örnek.
Bakılmayanlar: ses kayıtlarının metinle birebir uyumu (dinlenmedi), resimli kelimelerin çizimleri (görülmedi).

## 1. Canlı hatalar (kod)

| | Bulgu | Etki |
|---|---|---|
| H1 | `literacy-engine` `build` üreteci `options` döndürmüyor; `dealItem` (`server/literacyLab.js`) `q.options.filter` çağırıyor ve hata fırlatıyor. Merdiven D1'i sorduğunda iki kaynaktan biri bu. | Aralıklı 500 → çocuk "Something went wrong" görür. Tekrar deneyince bazen geçer (öbür kaynak seçilir). |
| H2 | Railway #34'ü yayınlamadı: `/api/literacy-sittings/:id/practice` canlıda 404. | "Practise" düğmesi açılmıyor. |

## 2. Mantık hataları (düzeltilmeli)

Senin örneğinle aynı sınıf: metinde olmayanı soran, gerekçesi tutmayan, zaman çizelgesi çelişen.

| Kimlik | Nerede | Sorun |
|---|---|---|
| L4-006 | dinleme | "Mark okula yürür. Okuldan sonra babası arabayla gelir." → "Mark eve nasıl gider?" Eve nasıl döndüğü söylenmiyor (bisiklet/araba örneğinin aynısı). |
| L5-006 | dinleme | "Sorry, there are only three now" — üç portakal varken "üzgünüm" yok demek; Hugo bir tane alabilir. Kardeşin "elmayı daha çok sevmesi" de konuyla ilgisiz. |
| L5-005 | dinleme | Alice genelde yürüyor; "babam işe erken başlayınca otobüsle giderim" — koşul yürümeyle bağlanmıyor. |
| B4-E2-098 | hikâye (sunulan soru) | Sam "herkes görsün diye" Zoe'nun arkasına geçiyor; kimsenin görüşünü kapatan o değil. Cevap "Behind Zoe" bu gerekçeye dayanıyor. |
| B4-E3-056 | hikâye (sunulan soru) | Son cümle anlamsız ("Ben had turned that card over for Lily before they played"); doğru şık "hatırladığı bir iz" diyor, metinde "hatırlama" yok. |
| R1-E3-05 | parça | Kitapçı sandalyesi: küçük sandalye sabah zaten dışarıda, ama "yağmur dinince küçük sandalyeyi boyamak için dışarı çıkardı". Soru "that morning" diyor, metinde sabah yok. |
| B3-E3-09 | parça | Meera'nın masasındaki kâğıt "sınıfa" taşınıyor (masa zaten sınıfta). "Büyük kutu"da 21 sayfa var. |
| B2-E3-03 | parça | Mor ağaç: Sam'in ağacı mora boyadığı adım yok; Zoe yeşili getirdiğinde ağaç zaten mor. |
| E2-04 | parça | Ella'nın kutusunda yalnız oyuncak kurbağa var; sonunda "kurbağasını öğle yemeğinin yanına koydu", yemeği nerede? |
| E3-04 | parça | Zil yerine OPEN yazısı: "bir şey istediğinde kâğıdı gösterdi". OPEN yazısı bir şey istemek anlamına gelmez. |
| B4-E2-083 | hikâye | Kang biletlere bakıp 8 numaralı otobüsü geçiriyor; biletin hatla ilgisi kurulmuyor. |
| B4-E2-034, B4-E2-092 | hikâye | Bulunan eşyayı başkası "geri veriyor", oysa onu bulan zaten sahibiydi (kart/paket). Döngüsel. |
| B4-E3-004 | hikâye | Beslenme kutularıyla "dışarı yürürken yağmur" — kim nereye, belirsiz. |
| B4-E3-011 | hikâye | Okul gezisinde "kalemlerini okulda bıraktı" — zaten okuldan çıkıyorlar. |
| B4-E3-072 | hikâye | "Neden pasta resmi yok?" sorusu hiçbir yere bağlanmıyor. |
| C4-005, C4-006 | cümle | Kart partiden *sonra* yapılıyor; şapka paltodan önce giyiliyor. Mümkün ama tuhaf; Ca4 sırayı ölçüyor, tuhaflık dikkati dağıtır. |

Düzeltildi (bu dalda, commit yok): C3-004 (Anna'nın saçı), E1-008 (Grace).

## 3. İki doğru cevap / cevap sızıntısı / bölgesel kelime

| | Bulgu |
|---|---|
| Cd3 `past-tense` | "ring" için şıklarda "ringed" var. *Encircle* anlamında o da doğru. İki doğru şık. |
| B5 `sense` | "a big (or large) barn" → cevap "big" cümlenin içinde yazıyor. "a plan for seating guests → design" zorlama. |
| B6 `definition` | "look past, fail to notice" → "overlooking" (tanım yalın fiil, cevap -ing). Biçim uyuşmuyor. |
| B3 `synonym` | "fall → autumn": Amerikan kullanımı (proje UK/US'e duyarlı kelimeleri dışarıda tutuyor). |
| D6 `misspelt` | Doğru şıklar arasında mailbox, pocketbook, automobile (US). |

## 4. Sistematik sorunlar

1. **"What happened first?" = ilk cümle.** Canlı hikâyelerdeki 100 sıra sorusunun 100'ünde cevap metnin ilk cümlesi (sunulan 21'inde de). Literacy motorunun E2 "sequence" sorusu da aynı. Çocuk okumadan "baştakini seç" stratejisini öğrenir, bu soru sıra kanıtı vermez.
2. **Canlıdaki hikâyeler eski sürüm.** Yayında 18 Ekim'in ilk 200'lük seti var. 20 Ekim'de 600 sorusu düzeltilen `READING-STORIES-200-REVISED-2026-10-20` ve B5 (100) / B6 (15) setleri yayına alınmadı. Yukarıdaki hikâye bulgularının bir kısmı revize sürümde zaten düzelmiş olabilir.
3. **E2 hikâyeleri çoğunlukla olaysız.** "Tom X yaptı. Mia Y yaptı." Mantık hatası değil, ama okunacak bir şey yok, sorular kelime eşleştirmeye iniyor.
4. **Üreteç çeldiricileri kelime değil harf yığını.** D3 çoğul: "catcves", "luni", "matchoes"; D4 ek: "denyaial". Çocuğun gerçekten yapacağı yanlışlar değil; D2 eksik harf şıkları da rastgele ("x", "k").
5. **Çeşitlilik dar.** Cd1 hep "You are …", Cd2 sık sık "The bird is in its nest.", E2 literacy motoru 6 metinden aynı uçurtma metnini tekrar tekrar veriyor.

## 5. Önerilen sıra

1. H1 (D1 çökmesi): kod, küçük. Ya `dealItem` build biçimini işlesin ya da katalogdan literacy-engine `build` çıksın (D1'de resimli kelime kaynağı zaten var).
2. H2: Railway'i `main`'den yeniden deploy et.
3. Bölüm 2'deki içerik düzeltmeleri + bölüm 3'teki üreteç süzgeçleri (ring/ringed, cümlede cevap, -ing tanım, US kelimeler).
4. Revize 200'lük seti (ve istenirse B5/B6) yayına almak; ondan önce bölüm 2'deki hikâye bulgularının revize sürümde hâlâ geçerli olup olmadığına bakmak.
5. Sıra soruları: cevabın ilk cümle olmadığı sorular (ör. "Mia ne yaptıktan sonra…?") ya da bu soru tipini E2/E3'ten kaldırmak.

## 6. Düzeltme durumu (2026-10-23, aynı gün)

`tuto-app-main`, dal `claude/english-bank-fixes` (yerel commit, push yok):
- H1 düzeldi (`dealItem` build biçimini işliyor, katalog geneli test).
- Bölüm 2'nin tamamı düzeldi. L4-006, L5-005, L5-006 metinleri düzeldi ama **ses kayıtları eski metni söylüyor**: sunucu bu üçünü yeniden kaydedilene kadar vermiyor.
- Bölüm 3'ün tamamı düzeldi (üreteç süzgeçleri).
- H2 (Railway deploy) ve bölüm 4 (sistematik) açık.

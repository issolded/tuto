# İngilizce deneme seti — ses ve resim varlıkları (iş günlüğü)

Branch `codex/english-literacy` (main'in üstünde, push yok). Klasör: `/Users/ngolokante/Downloads/tuto-app-main`.
Kullanıcı 2026-10-16: "başla, token bitene kadar devam, yenilenince resume et". Kullanıcı yokken izin
gerektiren hiçbir şey yapılmaz (indirme, push, yayın, kalıcı ayar). Gemini'ye yalnız bizim yazdığımız
soru metinleri gider (kullanıcı onaylı).

## Kalan kararlar (kullanıcının kulağı)

- İngilizce erkek ses **Charon**, Amerikan erkek ses **Puck**, iki kadın ses **Leda**: kör aksan kontrolüyle
  seçildi (Puck en-GB'de bile 2/2 Amerikan; Charon, Iapetus 2/2 İngiliz; kadın seslerin altısı 2/2 İngiliz).
  Kullanıcı dinleyip onaylamadı. Değiştirmek: `scripts/english-audio/clips.mjs` `VOICES`, sonra build.
- Her kayıt `approved: false`: kullanıcı dinleyince `true` olur. Onaysız ses çocuğa gösterilmez (kural).

## Ses — durum (2026-10-16 akşam)

- Hat: `scripts/english-audio/` — `clips.mjs` (liste + sesler), `qc.mjs` (kod / Whisper / kör yargıç),
  `build.mjs` (üret, kontrol et, AAC'ye çevir, kaydet). Çalıştırma (klasör `tuto-app-main`):
  `GEMINI_API_KEY=$(grep '^GEMINI_API_KEY=' ../tuto-app/server/.env | cut -d= -f2- | tr -d '"') WHISPER_MODEL=~/.cache/whisper-cpp/ggml-base.en.bin node scripts/english-audio/build.mjs`
  Kabul edilmiş ve değişmemiş kayıt atlanır; aynı komut kaldığı yerden sürer.
- Çıktı: `public/english-audio/<karma>.m4a`, `scripts/english-audio/provenance/<karma>.c2pa`,
  `src/lib/literacy/audioManifest.generated.json` (her kayıt `status` ok/listen/fail, `approved: false`).
- **Yapılan: 19 kayıt** (16 ok, 3 listen): kelimeler (dog, apple, sun, fish) ×2, cümleler (A03, A04,
  CA01–CA03) ×2, A05 konuşması UK.
- **Durduran: günlük kota.** `gemini-3.8-flash-tts` proje başına **günde 100 istek**; deneme + seçim + üretim
  bugün doldurdu (yenilenme ~10 saat). **Kalan (yarın aynı komut):** A05 konuşması US, A05/A06 soru,
  şıklar ve geri bildirimler, A06 konuşması, 4 yönerge. Tam içerik (~7.200 kayıt) bu kotayla ~70 gün:
  gerçek üretimden önce ücretli kota / artış gerekir (kullanıcı kararı, hesap işi).
- **Yeniden değerlendirme (iki çalıştırma + kısa kayıt kuralı, `--rejudge`):** 3 "listen"den 2'si ok oldu.
  Kalan 1: UK "The window is not open. It is closed." (8 kelime; iki çalıştırma da "Amerikan", "not"taki ünlü).
  A05 UK'deki Ben repliği konuşmanın içinde saklı olmadığı için yeniden denetlenemedi; "listen" kaldı.
- (eski not) **"listen" çıkan 3 kayıt** (üç üretimin üçünde de yargıç "Amerikan" dedi): UK "The ball is under the chair.",
  UK "The window is not open. It is closed.", UK A05'te Ben'in "Good idea. Let's take our things over."
  Ortak nokta: kısa UK kayıtta sonu r'li ya da "not/hot" ünlülü kelime. Aynı cümle Leda'yla daha uzun
  bağlamda (voice test) 2/2 İngiliz bulunmuştu. Yargıcın mı yanıldığı, sesin mi kaydığı belirsiz: **kulak lazım.**
  Denenecek: aynı satırı başka İngiliz sesle (Kore/Aoede/Despina hepsi 2/2 İngilizdi) üretmek.
- Bulgular: API başlıklı WAV döndürüyor (`fmt`, `data`, `C2PA`); bölüm bölüm okunuyor (eskiden bütün dosya
  ses sanılıyordu: sonda C2PA cızırtısı, başta 44 baytlık başlık tıkı). Konuşmalar replik replik, her
  konuşmacı kendi sesiyle, 0,45 sn ara; tamamı ayrıca Whisper'dan geçiyor.

## Resim — durum

- Tek nesneler (kedi, köpek, tavşan, muz, armut, elma, güneş, balık): projedeki Noto emoji çizimleri
  (`src/lib/puzzleArt.generated.js`). Sahne nesneleri (sandalye, yatak, top, kutu, çanta, kapı, pencere)
  Noto'da projeye alınmamış; indirmek izin ister (kullanıcı yokken yapılmadı). Bu yüzden sahneler elle
  yazılmış SVG: `scripts/english-art/art.mjs` (15 sahne, 5 üçlü, her üçlüde tek şey değişiyor).
- Kaydedilen: `public/english-art/<karma>.svg`, `src/lib/literacy/artManifest.generated.json`
  (`node scripts/english-art/build.mjs`).
- **Kör tanıma kontrolü** (`scripts/english-art/check.mjs`, gemini-3.8-flash görme): her üçlü karışık sırayla
  3 kez, cümleye uyan resmi seçmesi istendi: **5/5 üçlü 3/3**. Tek tek tarifte 15/15 doğru ("cat sleeping
  under the bed", "pink bag", "open window… cloud"). Yolda düzeltilen: alçak yatak (kedi altında değil önünde
  görünüyordu), kova gibi çanta, iki pencere arasında iki fark (bölme sayısı + renk), ters "z". Uyarı: bu
  yetişkin bir modelin testi; çocuğun okuyacağını kanıtlamaz. Telefon boyutunda (131 px, `ART_PX=131`) de 5/5 üçlü 3/3.

## Ölçüm: Cambridge kelimelerinin emoji karşılığı (2026-10-16)

Python'un Unicode adlarıyla kaba eşleştirme (indirme yok): somut isimlerin (konu listesinde nesne/hayvan/yiyecek
vb.) Starters'ta 234'te 155'i (%66), Movers'ta %45'i, Flyers'ta %42'si bir emoji adayıyla eşleşti. Eşleştirme iki
yönde hatalı (bag→💰 para kesesi, ball→🎊 konfeti; bee/bike/burger "honeybee/bicycle/hamburger" adıyla kaçtı):
gerçek oran tahminen Starters %70–80, üstte ~%50. Geri kalan (kitchen, classroom, street…) sahne çizimi ister.
Noto Color Emoji standart emojinin tamamını çiziyor; ama projede yalnız 100 tanesi var, yenileri `scripts/fetch-puzzle-fonts.mjs`
ile indirilir (**kullanıcı onayı bekliyor**).

## Bekleyen karar: puansız çözülmüş örnek

Her cevap biçiminin ilk karşılaşmasında puansız örnek gösterilecek (kullanıcı kararı). Örnek, sorularda geçmeyen
bir kelimeyle yapılmalı (yoksa örnek o soruyu öğretir). Projedeki 8 emojinin hepsi deneme setinde kullanılıyor;
örnek için yeni Noto çizimleri gerekiyor (indirme = kullanıcı onayı). Ses tarafı hazır: `i-look`, `i-your-turn`
klipleri tanımlı, kota yenilenince üretilecek.

## Lab — durum

- Veri: `src/lib/literacy/trialSet.js` (36 madde, belgeyle birebir; anahtar seçenek kimliğiyle).
  Test `scripts/tests/english-trial.test.mjs`: belgedeki 36 kimlik = veri; her anahtar kendi şıkkı; her ses
  ve resim tanımlı; A alanında yazı yok; çocuğun gördüğünde Türkçe/İspanyolca harf yok; resim üçlüleri
  maddelerle aynı.
- **Ekran: `/english-trial-lab`** (`src/screens/EnglishTrialLab.jsx`, gecikmeli yüklenen, menüde yok, hiçbir şey
  kaydetmez). İki görünüm: **Review** (36 madde, anahtar ve her kaydın durumu: ok / listen / fail / missing, üstüne
  gelince sorunlar) ve **Play with a child** (tek tek, anahtar ve durum gizli, sonda alan alan ✓/✗). UK/US ses,
  alan süzgeci, şık sırası her turda karışık. Denendi (tarayıcı, 375px ve masaüstü): resimli seçim, sesli şık,
  harf kurma, kart sıralama, yanlış sonrası İngilizce açıklama + ses; konsol hatasız, yatay taşma yok. Telefonda
  sahneler iki sütun (131 px, üçü de ekranda; üç sütunda 78 px çocuk için küçüktü).
- **Açık:** sesler henüz onaylı değil (lab onaylamaz, durumu gösterir); eksik kayıtlar yarın; çocukla denenmedi.

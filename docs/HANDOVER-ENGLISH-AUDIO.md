# Handover — İngilizce ses işi (2026-10-16)

Yeni oturum için. Önce bunu, sonra `docs/ENGLISH-AUDIO.md` (kararlar ve ölçümler) ve
`docs/ENGLISH-TRIAL-ASSETS.md` (iş günlüğü) oku.

## Nerede

- **Klasör:** `/Users/ngolokante/Downloads/tuto-app-main` · **branch:** `codex/english-literacy` (main'in üstünde,
  **push edilmedi**). Ana klasör `tuto-app` başka bir branch'te ve commit edilmemiş iOS çalışması içeriyor;
  ona dokunma, oradaki İngilizce dosyalar eski kopya.
- **Kod:** `scripts/english-audio/`
  - `clips.mjs`: kaydedilecek her şeyin listesi ve sesler (`VOICES`)
  - `qc.mjs`: üç kontrol: sinyal (kod), Whisper (metin birebir), dinleyen model (aksan/doğallık)
  - `build.mjs`: üret → kontrol et → AAC'ye çevir → kaydet; `--only id,id`, `--takes N`, `--rejudge`
- **Çıktı:**
  - `public/english-audio/<karma>.m4a`: dosya adı karma, kelime değil; cevap ağ kayıtlarında görünmesin diye
  - `scripts/english-audio/provenance/<karma>.c2pa`: Google'ın "yapay zekâyla üretildi" etiketi
  - `src/lib/literacy/audioManifest.generated.json`: kayıt başına durum: `status` ok / listen / fail, `approved: false`
- **Dinleme yeri:** `/english-trial-lab` (`src/screens/EnglishTrialLab.jsx`). "Review" görünümü her kaydın durumunu
  gösterir, UK/US seçilir.

## Çalıştırma

```bash
cd /Users/ngolokante/Downloads/tuto-app-main
export GEMINI_API_KEY=$(grep '^GEMINI_API_KEY=' ../tuto-app/server/.env | cut -d= -f2- | tr -d '"')
export WHISPER_MODEL=~/.cache/whisper-cpp/ggml-base.en.bin
node scripts/english-audio/build.mjs            # eksikleri üretir; kabul edilmiş, değişmemiş kayıt atlanır
node scripts/english-audio/build.mjs --rejudge  # kayıtları yeniden üretmeden yeni kurallarla denetler (ses kotası harcamaz)
```

- **Önkoşullar:** `ffmpeg`, `whisper-cli` (Homebrew `whisper-cpp`) ve model kurulu.
- **Anahtar:** `.env`'i kopyalama, yukarıdaki gibi oku.
- **Lab'ı açmak için:**
  - Klasörde `node_modules` ve `.env` yok. Geçici olarak `ln -s ../tuto-app/node_modules node_modules` ve `cp ../tuto-app/.env .env`; iş bitince ikisini de sil.
  - Sunucu: `npm --prefix /Users/ngolokante/Downloads/tuto-app-main run dev -- --port 5199`. Bunun için ana klasörün `.claude/launch.json`'una geçici bir giriş eklenmişti; sonra geri alındı.

## Durum

- **19 kayıt var:** 17 ok, 2 dinlenecek (UK pencere cümlesi ve UK A05 konuşması). Kelimeler (dog, apple, sun, fish), A03, A04 ve CA01–CA03 cümleleri UK+US, A05 konuşması UK.
- **Kalan:**
  - A05 konuşması US
  - A05/A06 soruları, şıkları ve geri bildirimleri
  - A06 konuşması
  - 4 yönerge (`i-*`)

  Aynı `build.mjs` komutuyla tamamlanır.
- **Onay:** Hiçbir kayıt onaylı değil. Kural: onaysız ses çocuğa gösterilmez; `approved` bir insan dinledikten sonra `true` yapılır.

## Kararlar (gerekçeleri ENGLISH-AUDIO.md'de)

- **Model:** `gemini-3.8-flash-tts`.
  - **Aksan:** `speechConfig.languageCode` (en-GB / en-US) ile.
  - **Metin:** düz metin gönderilir. Metne talimat yazılırsa model talimatı da okur; sistem talimatını kabul etmiyor.
- **Sesler:**
  - UK: Leda (kadın) + Charon (erkek). US: Leda + Puck.
  - Puck en-GB'de bile Amerikan okuyor; aksanı ses taşıyor.
  - Kullanıcı Charon/Puck seçimini henüz dinleyip onaylamadı.
- **Konuşmalar** replik replik üretilir: her konuşmacı kendi sesiyle tek kişilik modda, aralarına 0,45 sn konup birleştirilir. Tamamı ayrıca Whisper'dan geçer.
- **Üretim tekrarı:** Kayıt başına en çok 3 üretim; üç kontrolden geçen ilk üretim alınır. Model her üretimde farklı okuyor.

## Tuzaklar (hepsi bir kez yaşandı)

1. **Günlük kota: 100 istek.** Ses modeli proje başına günde 100 istek (dakikada 10) kabul ediyor. `build.mjs` günlük kotada düzgün durur ve ne kaldığını yazar. Tam içerik (~7.200 kayıt) bu kotayla 70+ gün sürer: ücretli kota ya da kota artışı gerekir. Bu kullanıcı kararı.
2. **Yanıt başlıklı WAV.** Bölümleri `fmt`, `data` ve `C2PA`; ses yalnız `data` bölümünde. Bütün dosya ses sanılınca sonda 125 ms cızırtı (C2PA), başta tık (başlık) oluyordu. `splitWav()` bunu çözüyor.
3. **Dinleyen modelin aksan kararı kısa kayıtlarda güvenilmez.**
   - Aynı İngiliz cümle bir soru biçiminde 3/3 "Amerikan", ipucu ipucu sorunca 2/2 "İngiliz" çıktı.
   - Kural: model iki kez bağımsız çalışır, bir sorun ancak ikisi de söylerse sayılır. 8 kelimenin altında aksan yalnız not (`ACCENT_MIN_WORDS`).
   - Modele hedef aksan **söylenmez**: söylenince etikete uydu.
4. **zsh boşlukla bölmüyor.** Bir değişkendeki dosya listesi zsh'ta tek argüman olarak geçer; `${=VAR}` kullan ya da dosyaları tek tek yaz.
5. **Kapsama:** Whisper `base.en` İngilizce kelimeleri iyi tanıyor, ama ses birimi düzeyinde telaffuz puanı vermiyor. O iş için 4. katman (Azure Pronunciation Assessment) önerildi; hesap ister, karar verilmedi.

## Sıradaki adımlar

1. **Kalan kayıtlar:** Kota yenilenince `build.mjs`'i çalıştır, sonra `--rejudge`.
2. **Kullanıcı dinler:** lab'da, özellikle:
   - UK "The window is not open. It is closed." (iki çalıştırma da "Amerikan" dedi)
   - UK A05'te Ben'in "Good idea. Let's take our things over."

   Onaylananlar için manifestte `approved: true`. Onay için küçük bir yardımcı ya da lab'da bir düğme yok; eklenebilir.
3. **"listen" kalan kayıtlar:** Başka bir İngiliz sesle (Kore, Aoede ve Despina kör testte 2/2 İngilizdi) tek replik denenebilir: `clips.mjs`'de klibe özel ses alanı eklemek gerekir.
4. **Gerçek ölçek öncesi kota/maliyet kararı.** Gerekirse aynı hatta başka bir TTS servisi (Azure, ElevenLabs) takılabilir: yalnız `speak()` değişir.
5. **Ses dışı açık işler** (bu oturumun konusu değil):
   - Çözülmüş örnek için yeni Noto emoji çizimlerinin indirilmesi kullanıcı onayı bekliyor (`ENGLISH-TRIAL-ASSETS.md`).
   - Deneme seti çocukla denenmedi.

## Çalışma kuralları (kullanıcıdan)

- Türkçe, kısa ve net yaz.
- Commit/push/indirme için her seferinde onay iste.
- Push main'e `git fetch` + `git rebase origin/main` sonrası; Gökhan da main'e push ediyor. Bu branch henüz main'e alınmadı.
- İçerik kitaplardan ilham alır, hiçbir şey kopyalanmaz.
- Gemini'ye yalnız bizim yazdığımız soru metinleri gider.

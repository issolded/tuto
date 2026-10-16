# Tuto — İngilizce ses: üretim, kalite kontrolü, saklama

2026-10-16 · Claude · deneme sonuçları ve kararlar. Kod henüz projede değil: deneme betikleri
oturumun geçici klasöründeydi; seslendirme işine başlanınca `scripts/english-audio/` altına girecek.
Kullanıcı deneme kayıtlarını dinledi: "sesler iyi".

## Ana ilke

Ses **çalışma anında üretilmez.** Kayıtlar bir kez, geliştirme sırasında üretilir, kontrol edilir,
onaylanır ve saklanır; motor soruyu kurarken yalnız hangi kaydın çalınacağını söyler (resimler gibi).
Onaylanmamış sesi olan soru çocuğa gösterilmez. Ses kapalıysa A alanı bilinmiyor kalır.

## Üretim (denendi)

- **Model:** `gemini-3.8-flash-tts` (projede zaten olan Gemini anahtarı). Düz metin gönderilir.
- **Aksan dil koduyla:** `speechConfig.languageCode` `en-GB` / `en-US`. Cümlelerde doğru çalıştı
  ("I can't find my water bottle. Is it in the car?": GB'de t net ve r yok, US'de t "d", r var).
- **Bilinen sınırlar:**
  - Talimat metnin içine yazılırsa **talimat da okunur** (ilk denemede bütün kayıtlar 15–20 sn çıktı).
    Bu modelde sistem talimatı da kabul edilmiyor ("Developer instruction is not enabled"). Yani
    hız/ton ayarı yok; ses kendi doğal hızında.
  - **Tek kelimede US aksanı tutmuyor:** "water", "dog" en-US'te de İngiliz okundu. Çözüm adayları:
    kelimeyi kısa bir taşıyıcı cümlede üretip kesmek, ya da alt basamakta iki aksanda zaten aynı
    söylenen kelimeleri seçmek (Codex'in "UK/US ortak içerik" kararıyla uyumlu).
  - Eski `gemini-2.5-flash-preview-tts` "Say … in a British accent:" ön ekini okumadan uyguluyor
    ama Amerikan talimatını yok sayıp İngiliz okudu; kullanılmıyor.
- **Konuşma (iki ses):** `multiSpeakerVoiceConfig` + her replikte `speechMetadata.speaker`.
  Deneme sesleri: Mia = Leda, Ben = Puck. **Açık:** dinleyen model İngiliz konuşmada Ben'i
  3/3 "İngiliz değil" buldu; kullanıcı dinleyip karar verecek, gerekirse erkek ses değişir.
- **C2PA etiketi:** API ham PCM'in sonuna "yapay zekâyla üretildi" kaynak belgesi (C2PA, ~6 KB)
  ekliyor. Ses diye yazılırsa sonda 125 ms cızırtı olur. Etiket sesten ayrılır ve kaydın yanında
  ayrı dosya (`.c2pa`) olarak saklanır; Google'ın sese gömdüğü filigran (SynthID) kayıtta kalır.
- **Kota:** ses modeli **dakikada 10 istek** (proje + model başına; sohbet modellerini etkilemez).
  ~7.200 kayıt düz gidişle ~12 saat; toplu istek (`batchGenerateContent`) ya da kota artışı.
  Maliyet kesin hesaplanmadı; birkaç saatlik toplam ses için düşük, tek seferlik.

## Kalite kontrolü (üç katman, denendi)

Kayıt ancak 1 ve 2'den geçerse kabul edilir; 3 kayıt elemez, **insan dinlemesine ayırır.**

1. **Kod (sinyal):** beklenen süre aralığı (talimat okuma / kesilme), baştaki ve sondaki sessizlik,
   patlama (clipping), konuşma seviyesi, son 20 ms'deki ses (cızırtı / yarıda kesilme).
2. **Whisper (metin birebir mi):** `whisper-cpp` (Homebrew) + `ggml-base.en.bin` (Hugging Face,
   SHA-1 `137c40403d78fd54d454da0f9bd998f78703390c`). Gemini'den bağımsız bir ikinci göz; kayıt
   16 kHz'e çevrilip yazıya dökülür, senaryoyla birebir karşılaştırılır.
3. **Dinleyen model (aksan, vurgu, doğallık):** `gemini-3.8-flash`, JSON cevap. **Hedef aksan
   söylenmez**: söylenince etikete uydu (İngiliz kaydı "Amerikan" etiketiyle geçirdi). Kör sınıflandırır,
   karşılaştırma kodda. Tek kelimede aksan ipucu az, orada "belirsiz" kabul edilir.

**Deneme sonucu:** 16 iyi kayıt (5 kelime + 2 cümle + 1 konuşma, × UK/US) katman 1 ve 2'den geçti
(Whisper konuşma dahil hepsinde birebir). Bilerek bozulan 5 kaydın 5'i yakalandı: cızırtı geri
eklenmiş (1), sesi patlatılmış (1), ortada kesilmiş (1 + 2), yanlış metin etiketi (2: "cat" denmiş,
"dog" duyuldu), yanlış aksan etiketi (3). Katman 3 ayrıca iki iyi kaydı işaretledi: İngiliz
"The ball is under the chair." (r'ler okunuyor gibi) ve İngiliz A05 konuşmasında Ben.

**İsteğe bağlı 4. katman:** Azure Pronunciation Assessment (metin + kayıt → ses birimi başına doğruluk;
UK/US ayrı). En alt basamak kelimeleri için en değerli kontrol; Azure hesabı ister, karar
alt basamak üretimine gelince.

**İnsan:** işaretlenenler + küçük rastgele örneklem + en alt basamaktaki kelimelerin tamamı.

## Saklama ve çalma

- Biçim: AAC 32 kb/s mono (iPhone/iPad her sürümde çalar). Ölçülen: kelime ~6 KB, cümle ~10 KB,
  4 replikli konuşma ~59 KB (WAV'ın ~1/10'u). Opus daha küçük (yarısı) ama Safari desteği sınırlı.
- Supabase Storage (çizimler gibi). Kaba toplam ~80 MB; oturum başına ~100 KB trafik.
- **Dosya adı metin değil, karma:** `dog.m4a` olursa cevap tarayıcının ağ kayıtlarında görünür.
  Kimlik = karma(metin + aksan + ses + model sürümü); motor bu kimliği yazar.
- iOS sesi yalnız dokunuştan sonra çalar: her soruda 🔊 düğmesi. Native uygulamalar aynı adresten
  çalar, pakete gömülmez.
- Kayıt meta verisi: metin, aksan, ses adı, model, üretim tarihi, kalite sonuçları (1–3), onaylayan,
  C2PA dosyası.

## Native etkisi

Ses dosyaları sunucudan/Storage'dan gelir; native'e kendiliğinden ulaşır. Ama sesi çalan 🔊 düğmesi
ve yeni cevap biçimleri (resim seç, harf kutusu) her istemcide ayrıca yapılmalı.

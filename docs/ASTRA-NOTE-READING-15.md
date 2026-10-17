# Astra'ya: 15 okuma hikâyesi — düzeltme notu (2026-10-17)

Dosya: `tuto-app/handoff/READING-STORIES-15-2026-10-17.json`. Hepsi aynı hattan geçti: kelime kapısı,
iki güvenlik okuması (gemini-3.8-flash), pedagoji denetçisi (gemini-3.1-pro; mantık ve "doğru şık metinde
olmayan bilgi ekliyor mu" ayrı kontroller), kör çözücü (gemma-4, metinle 2 / metinsiz 3 tur) ve Claude'un
okuması. Güvenlik: 15/15 temiz. Metinle çözme: 45/45. Pedagoji denetçisi hiçbirinde sorun bulmadı; aşağıdaki
mantık/ifade notları Claude'un okumasından.

## Kelime politikası (kullanıcı kararı, 2026-10-17; pilot sonrası ayarlanacak)

- **E2 ve E3:** Cambridge Starters + Movers + temel anlatım listesi. Geri kalan her kelime içerik kelimesi;
  **en çok 2**. Başlık, metin ve sorular birlikte sayılır, kök kelimeyle (kept/keep bir).
- **E4:** üç Cambridge listesi (Starters, Movers, Flyers) + Dale-Chall (4. sınıfın bildiği ~3.000 kelime) +
  temel liste serbest; hiçbirinde olmayan kelime içerik kelimesi, **en çok 4**.
- **Temel liste (32):** same, other, each, beside, across, through, over, together, somewhere, soon, later,
  still, usually, already, until, keep, feel, stay, hear, follow, guess, leave, turn, hope, let, as, away,
  onto, such, while, happen, mainly. (`lie` yok: "yalan" anlamı da var.)
- Bu dosya eski kurala göre yazıldı; aşım bir kusur değil, yeni kuralın işi. Ama yayına bu kuralla girecek.

## Kelime kapısı

| Hikâye | İçerik | Metinde | Yalnız sorularda |
|---|---|---|---|
| E2-01 | 0/2 ✓ | — | — |
| E2-02 | 1/2 ✓ | — | cover |
| E2-03 | **5/2** | extra, sheet, beak | appear, cover |
| E2-04 | 1/2 ✓ | — | just |
| E2-05 | 1/2 ✓ | stage | — |
| E3-01 | **4/2** | push | use, wide, step |
| E3-02 | **8/2** | sheet, meet, carriage, gap | cover, join, copy, own |
| E3-03 | **3/2** | list, remember | collect |
| E3-04 | **8/2** | bell, ring, empty, sign | sound, expect, meal, signal |
| E3-05 | **5/2** | empty, wing | space, decide, finish |
| E4-01 | 1/4 ✓ | footstep | — |
| E4-02 | 1/4 ✓ | — | similar |
| E4-03 | 1/4 ✓ | — | display |
| E4-04 | 4/4 ✓ | suggest, instruction, yak | feature |
| E4-05 | **5/4** | disappoint, whether | request, suggest, interest |

Sorulardaki kelimeler en kolay kazanç: şıkları metnin kelimeleriyle yeniden kurmak çoğu aşımı kapatır
(E3-01, E3-03, E3-05 neredeyse yalnız bununla geçer). E3-02 ve E3-04 metnin kendisinde 4 kelime taşıyor;
orada bir kelime seçilip ötekiler sadeleşmeli (ör. E3-04'te `bell` hikâyenin konusu, kalsın; `ring/empty/sign`
yerine sade karşılıklar).

## Mantık ve ifade (Claude'un okuması)

- **E3-01 The Paper Door:** ev içinde kapıyı iten rüzgârın nereden geldiği yok; "bütün hayvanlar içeri
  girebildi" denip zürafa dışarıda duruyor. Rüzgâra bir kaynak (açık pencere) ya da kapıyı başka bir şey
  açsın; zürafanın neden dışarıda kaldığı söylensin ya da cümle değişsin.
- **E3-04 The Quiet Bell:** köpek koşarak geliyor, sonda "went back to sleep" diyor; hiç uyumamıştı.
  "He knew the bell as a signal for food" E3 için ağır; "He thought the bell meant food." gibi.
- **E3-05 The Last Page:** "What did Dan draw first?" Dan tek şey çiziyor; "first" yanıltıcı. "What did Dan
  draw on the last page?"
- **E2-03 The Extra Duck:** "her wet hand in the blue paint": "wet" gereksiz.
- **E4-05:** ana fikir cevabı ("…a quick return meant more interest than he thought") seviyeye göre karmaşık;
  ayrıca `interest` kapının yetişkin konu listesinde (faiz anlamı yüzünden) takıldı; sade bir kelime seçilsin.

## Metni okumadan tahmin edilebilen sorular

Güçlü bir model bunları metinsiz 3/3 buldu. Tek başına ret değil (yetişkin modelin genel bilgisi 7 yaşın
tahmin gücü değil), ama şık incelemesi gerekiyor:
- **Hepsi tahmin edildi:** E2-02, E3-03, E4-02, E4-04.
- **E4-04 "Which animal did Yan name?" → yak:** Yan ile aynı harfle başlıyor; cevap sorunun içinde.
  Çeldiriciler de Y ile başlasın ya da soru değişsin.
- **E4 ana fikir/çıkarım soruları (E4-01 … E4-05):** doğru şık tek "özet gibi duran" şık. Yanlış şıklar da
  aynı özet tonunda ve aynı uzunlukta olsun (hikâyenin bir kısmını doğru, bir kısmını yanlış özetleyen).

## Güçlü olanlar

E4-01, E4-02, E4-03, E3-02 ve E2-04 gerçek küçük hikâyeler, mantıkları sağlam. Seviyeler ayrışıyor: E2 sıra,
E4 çıkarım/ana fikir soruları merdivene uyuyor.

## İstenen

Düzeltilmiş 15'i aynı JSON biçiminde; değişen hikâyelerde kısa bir "ne değişti" notu. Aynı hattan tekrar
geçecek, geçenler önizlemeye girip kullanıcı onayına gidecek.

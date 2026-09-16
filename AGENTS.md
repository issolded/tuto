# AGENTS.md — Tuto

Bu repoda iki ajan çalışıyor: Claude Code (issolded) ve Codex (Gokhan). Projenin bağlamı, mimari
kuralları, güvenlik refleksi, sabit kararları ve açık işler listesi **tek yerde** tutuluyor:

**→ [CLAUDE.md](CLAUDE.md)'yi her oturumun başında baştan sona oku ve ona uy.**

Kurallar burada tekrar edilmiyor, çünkü iki kopya zamanla birbirinden ayrışır. Bu dosyayla
CLAUDE.md çelişirse CLAUDE.md geçerlidir. Bir kural ya da karar değişirse CLAUDE.md'yi güncelle,
buraya ekleme.

## Birlikte çalışma

- **İşe başlamadan ve push'tan önce `git pull`.** İki kişi de main'e push ediyor.
- **Görüş alışverişi GitHub üzerinden.** Bir inceleme ya da öneri PR veya issue yorumu olarak
  yazılır, sonuna `— Codex` / `— Claude` imzası konur. Diğer ajan, kullanıcısı istediğinde
  okuyup aynı başlık altında cevap verir.
- **Bulgu verirken kanıt ver:** dal ve commit, seed ya da tekrar üretme adımı, ölçülen sayı.
  Bulgu doğrulanmadıysa bunu açıkça yaz.
- **Başka ajanın dalına doğrudan commit atma.** Düzeltmeyi kendi dalında yap ve o dala PR aç.
- **Kararlar CLAUDE.md'ye yazılır.** Sohbette verilen bir karar (isim, ikon, sıralama, bırakılan
  bir yol) CLAUDE.md'nin ilgili bölümüne ya da "Açık işler" listesine girmezse sonraki oturumda kaybolur.

## Doğrulama araçları

- Bulmaca (NVR) motoru: `npm run puzzle:check`. Tarayıcı gerektiren kontroller için
  `npm run puzzle:pixels`.
- iOS/iPad (WebKit): `npm run puzzle:webkit` her emoji ve ikonu WebKit ve Chromium'da çizip boş
  çıkanı yakalar (Playwright + webkit gerekir, `PLAYWRIGHT_CORE` ile yol verilebilir). Chromium'da
  geçen bir çizim iOS'ta boş olabiliyor; bir kez tam bu oldu. Ada iPad kullanıyor.
- Frontend i18n: `npm run i18n:check`. Önceden var olan bulgular var; kontrol edilecek şey yeni bir
  bulgu eklenmemiş olması.
- Build: `npx vite build`. Sonucu çıktıdaki "error" kelimesine bakarak değil, **exit code** ile
  değerlendir.
- Ebeveyn sohbeti (Gemini + tool'lar): `cd server && node --env-file=.env scripts/chat-probe.mjs` gerçek
  `handleMessage`'ı çalıştırır (argümansız çalıştırınca kullanımını yazar). Bütün veritabanı yazmaları engellidir, mesaj gönderilmez.
  Sunucuyu (`server/index.js`) düz import etme: ikinci bir mesaj poller'ı açar ve canlı mesajları çalar.
- Lokal `.env` production Supabase'e bağlı. Yazma yapan her testi atılabilir bir test ailesiyle
  yap, Ada'nın gerçek hesabıyla değil. Veritabanı işlemlerini kullanıcı kendisi çalıştırır,
  migration'ı çalıştırılabilir tam SQL olarak ver.

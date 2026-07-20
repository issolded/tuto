# CLAUDE.md — Tuto

Bu dosya her Claude Code oturumunda otomatik okunur. Tuto'nun bağlamını, mimari
kurallarını, çalışma tarzını ve güvenlik refleksini taşır. Kod yazarken bunlara uy.

## Ürün

Tuto, çocuklar için bir eğitim PWA'sı. Çocuklar eğitim görevlerini (matematik, okuma,
ev görevleri) tamamlayıp **Gem** kazanır; Gem'ler Roblox ekran süresine çevrilebilir.
Ürünün kalbi: ebeveynin **çocuğunu tanıyan gerçek biriyle** konuştuğunu hissettiği
Telegram tabanlı ebeveyn iletişim katmanı. Birincil test kullanıcısı 7 yaşındaki Ada.
(Geçmiş: ürün BrainToken adıyla başladı, Tuto'ya evrildi.)

## Stack

- **Frontend:** React + Vite, PWA, Vercel'de.
- **Backend:** Express, Railway'de.
- **DB:** Supabase (realtime ile submission dinleme dahil).
- **LLM:** Gemini 2.5 Flash (ana agent), Gemini 2.0 Flash (worker/otomasyon).
- **Mesajlaşma:** yalnızca Telegram.

## Mimari — çekirdek model

Detaylı mimari `design_handoff_parent_reskin/`'in dışında, ayrı bir mimari dokümanda
yaşıyor (Ebeveyn İletişim Mimarisi). Özet kurallar:

- **İki kapı, tek beyin.** Ortada düşünen tek beyin (Gemini), iki yanında kural uygulayan
  iki kapı: giriş kapısı (mesaj sayacı) ve çıkış kapısı (sendGate). "Öyle bir ebeveyn
  gelir ki..." senaryoları ya `prefs`'te bir alandır ya bir kapıda bir kontrol — beyne
  dokunmaz.
- **Altın kural: LLM yorumlar ve yazar, deterministik kod uygular.** Bir kuralın
  uygulanmasını asla modelin insafına bırakma (limit/saat kontrolü kodda, modelde değil).
- **Mesaj işleme üç kategori:** veri okuyan (araç gerekmez, bağlam yeter), veri yazan
  (`update_preferences` + `approve/reject_submission`), uzun kuyruk (`remember()`).
- **Üç katmanlı hafıza:** transkript (son 48 saat / min 10 mesaj) + `family_notes` +
  yuvarlanan `conversation_summary`.
- **Uygulama sırası:** typing/insanileştirme → iki kapı (prefs + sendGate) →
  function calling → hafıza → proaktif cron'lar. Bu sırayı koru.

## Çalışma tarzı

- Altyapı ve DB işlemlerini kullanıcı kendisi yapar. SQL migration verirken çalıştırılabilir
  tam SQL ver; kullanıcı Supabase SQL Editor'de çalıştırır.
- Mevcut dosya yapısına (`server/`, `frontend/` veya `tuto-app/`) göre yaz.
- Kullanıcı teknik olarak hands-on; temel kavramları açıklama, kararın ve gerekçesinin özüne gir.
- Kısa ve net ol. Gereksiz girizgah/özet/dolgu yok.
- Bir mimari karar verirken trade-off'u söyle, sadece "şunu yap" deme.
- **Yarım yapı kurma:** bir parça başka bir parçaya bağlıysa (örn. persona, prefs şemasına
  bağlı), önce bağımlılığı kur, sonra parçayı.

## Güvenlik refleksi (daha önce tespit edilen açıklar — tekrar düşürme)

- Gemini key frontend bundle'ında olmasın → Gemini çağrılarını **backend'e proxy'le**.
- API'de auth eksikliği → endpoint'lere auth koy.
- Gem/submission yazan endpoint'ler **sunucu tarafı doğrulama** yapmadan yazmasın.
- `.env` ve auth dosyaları repoya girmesin; sırları repoya sokma.

## Sabit kararlar (tekrar önerme)

- **Baileys / WhatsApp bırakıldı.** Test yalnızca Telegram, WhatsApp Business erişimi
  alınana kadar. Tekrar Baileys önerme.
- Persona parametreleri (`bot_name`, `tone`) typing promptuna değil, `prefs` şemasına bağlı.

## Açık işler / yol haritası

- [ ] Stories çeşitlilik: 11+ üretimi tek kalıba (AI-duygu-kontrolü / kapalı-dome) çöküyor;
      üretim promptuna premise çeşitliliği + alt-tema rotasyonu, ya da embedding ile
      semantik dedup. (Güvenlik değil, kalite.)
- [ ] Telegram "iki kapı": prefs şeması + sendGate + giriş kapısı (mesaj sayacı).
      Uygulama sırasında 2. adım; henüz başlanmadı.
- [ ] Problem 3: ebeveyn mesajla story konusu ekler — function calling aracı
      (add_story_ideas), Telegram katmanı gelince.
- [x] Güvenlik: VITE_GEMINI_API_KEY açığı kapandı — Gemini `/api/gemini/generate`'e proxy'lendi,
      ölü env değişkeni silindi, proxy'ye child-id + rate limit kapısı kondu. Kalan: çocuğun
      Supabase session'ı yok, o yüzden kapı "gerçek child UUID + kota" seviyesinde; tam auth
      çocuk session'ı ister.
- [ ] Stories generator otomasyonu: job hazır (jobs/generateStoryIdeas.js) ama henüz
      zamanlanmadı. Şimdilik elle `node jobs/generateStoryIdeas.js`. Otomatikleştirince
      ya Railway ayrı cron servisi ya da in-process node-cron (job'ı exit etmeyen
      importable fonksiyona çevirip cron.schedule ile).

## design_handoff_parent_reskin/ hakkında

Repodaki bu klasör bir **görsel re-skin referansıdır**, production kodu değil. Parent
ekranlarını "Tuto Care" görünümüne (teal/peach, Plus Jakarta Sans) çevirmek için
kullanılır. Kurallar `design_handoff_parent_reskin/README.md`'de. **Saf görsel re-skin:**
mevcut hook/handler/Supabase wiring'e dokunma, veri olmayan yere veri uydurma. Değişiklikler
`src/screens/`'e gider, bundle'a değil.

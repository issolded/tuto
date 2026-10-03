# Uygulama içinde hikâye yazma — 2026-10-02

## Yayın sırası
1. Supabase SQL Editor'de server/migrations/2026-10-02_story_drafts.sql dosyasının TAMAMINI çalıştır.
2. Backend ve frontend'i birlikte yayınla. Migration uygulanmadan bu sürümü yayınlama.
3. Atılabilir test çocuğuyla taslak → kütüphane → devam → tamamla akışını gerçek ortamda doğrula.

## Davranış
- My Stories: Uygulamada yaz / Fotoğraf veya dosya yükle.
- İlk metinle taslak oluşur. 1,5 saniye yazmaya ara verilince kayıt; sayfa gizlenince de kayıt denenir.
- Her değişiklik çocuk ve hikâye kimliğine göre bu cihazda kurtarma kopyasına yazılır.
- Sunucuya gönderilemeyen taslak aynı cihazdaki kütüphaneden açılır. Başka cihaz yalnız eşitlenmiş metni görür.
- Metin 50.000, başlık 200 karakterle sınırlı. Birden fazla taslak desteklenir.
- Güncel sürüm açılışta tekrar okunur. Çakışmada eski içerik sunucuya yazılmaz; ayrı taslak oluşturulabilir.
- Değerlendirme yalnız çocuk Bitirdim dediğinde sunucuda çalışır; metin model cevabıyla değiştirilmez.
- Taslak otomatik kaydı Gem/bildirim oluşturmaz. Bilinçli değerlendirme sonrası mevcut güvenlik taraması kullanılır.
- Tamamlamada sunucudaki değerlendirme kullanılır; koşullu durum/sürüm güncellemesi eşzamanlı çift ödülü engeller.
- Tamamlanan hikâye taslağa geri çevrilemez. Düzenlemek yeniden ödül vermez.
- Mevcut fotoğraf yolu korunur.

## Doğrulama
- story-drafts.test.mjs: idempotent kayıt, çakışma, farklı çocuğun kaydına yazamama,
  silinen taslak, boyut sınırı, boşaltılmış metin, değerlendirme yarışması, gerçek tamamlama
  handler'ında tek ödül ve sunucu puanı.
- Tarayıcı: Türkçe yazma, otomatik kayıt, kütüphane, devam, yenileme, değerlendirmeye geçiş,
  kayıt servisi erişilemezken yerel kurtarma, iki cihaz değişikliği ve ayrı kopya, 390px iframe.
- Tarayıcı testi sahte API/bellek veritabanıyla; gerçek Supabase migration'ı çalıştırılmadı,
  gerçek Gemini, fiziksel iPad klavyesi ve canlı tamamlama henüz doğrulanmadı.
- Yeni dosyalarda ESLint temiz; i18n denetimi 207 → 206 mevcut bulgu.

## Sınırlar
- Uygulamanın mevcut çocuk erişim modeli (child UUID, tam Supabase çocuk oturumu yok) korunur.
  Sahiplik filtresi yanlış çocuk kimliğiyle başka hikâyeyi değiştirmeyi reddeder; tam kimlik doğrulamanın yerini tutmaz.
- Yerel kopya tarayıcı verisi silinirse kaybolur; kayıt başarısızlığı açıkça gösterilir.
- Mevcut tamamlamada durum güncellemesi ile ledger kaydı ayrı işlemlerdir:
  ikisi arasındaki sunucu kesintisine karşı tam işlemsel ödeme bu değişikliğin kapsamında değildir.
- Taslaklar için ayrı değerlendirme tablosu yok; stories.draft_assessment sunucu değerlendirmesini tutar.

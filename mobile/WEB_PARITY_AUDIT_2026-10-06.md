# Current update

The route inventory below describes the earlier baseline. Native modules have since been implemented; see [NATIVE_MODULES_2026-10-06.md](NATIVE_MODULES_2026-10-06.md) for the current scope, remaining differences and validation boundaries.

# Web → Android native denetimi — 6 Ekim 2026

Kaynak web: `origin/main` `11869e7`. Gerçek Android başlangıcı: `claude/practical-franklin-xigneu` `6468f58`. Çalışma: `codex/android-complete`.

Bu belge **kaynak kodu / rota / veri akışı envanteridir; canlı uçtan uca test raporu değildir**. `src/App.jsx` içindeki 34 rota ve `src/screens` içindeki 30 ekran dosyasının import, handler, Supabase tablo ve API çağrıları tarandı. Kritik giriş, matematik/bulmaca, hikâye taslağı, kitaplık, fotoğraf ve bildirim sözleşmeleri ayrıca incelendi. Bütün ekranların cihazda çalıştığı iddia edilmiyor.

34 rota: 16 çocuk, 12 ebeveyn, 2 kurulum, 1 açılış, 3 geliştirici laboratuvarı. Native tarafta ebeveyn uygulaması bulunmuyor. Web kodunu birleştirmek React ekranlarını Compose ekranlarına dönüştürmez.

## Ekran karşılıkları

| Web rotası | Android durumu | Karşılık / açık iş |
|---|---|---|
| `/` | Yok | Ebeveyn/çocuk açılış seçimi |
| `/parent/login` | Yok | Supabase giriş/OAuth ve oturum |
| `/parent/signup` | Yok | Kayıt/OAuth |
| `/parent/dashboard` | Yok | Bugünkü işler, çocuklar, bekleyen onaylar |
| `/parent/settings` | Yok | Bildirim kanalı, sessiz saatler, otomatik pilot, aile kodu |
| `/parent/reports` | Yok | Haftalık rapor/çocuk seçimi |
| `/parent/tuto` | Yok | Uygulama içi veli AI sohbeti |
| `/parent/screen-time` | Yok | Çocuk bazında süre kuralları |
| `/parent/settings/screen-control` | Yok | Web ekran süresi denemesi/kuralları |
| `/parent/onboarding` | Yok | Aile/çocuk/ödül/görev kurulumu |
| `/parent/child/:id` | Yok | Çocuk profili, PIN, onaylar, Gem, ödüller |
| `/parent/child/:id/settings` | Yok | Görevler, kota, ödül, dil, İngilizce çeşidi, Hezarfen |
| `/parent/child/:id/review/:ledgerId` | Yok | Velinin eski oturum incelemesi |
| `/setup/assign` | Yönlendirme | Web /setup yönlendirmesi; ayrı native ekran gerektirmez |
| `/setup` | Kısmi | Aile kodu bağlantısı var; QR kamera yolu yok |
| `/child` | Kısmi | Seçili çocuk + PIN + unutulan PIN isteği bağlı; karşılama bonusu ve gerçek aile testi açık |
| `/child/settings` | Kısmi | Hesap değiştirme/aile bağlantısını kesme ve alt menü var |
| `/child/settings/screen-control` | Yok / web demo | Web localStorage simülasyonu; gerçek Android uygulama süresi veya engellemesi değildir |
| `/child/home` | Kısmi | Gerçek bugün/Gem/hedef verisi ve animasyon; 3 yaş görünümü, haftalık grafik, güncel ayar yenileme eksik |
| `/child/task` | Yok | Ağaç, katkı kartları, serbest günlük, fotoğraf, onay, aylık orman arşivi |
| `/child/math` | Kısmi | Güncel ortak şablon motoru var; kâğıt/fotoğraf, etkileşimli yardım, pekiştirme, karalama ve oturum kurtarma eksik |
| `/math-lab` | Geliştirici aracı | Çocuk/veli ürün akışı değil; native ekran yerine motor denetimi olarak kullanılabilir |
| `/puzzle-lab` | Geliştirici aracı | Çocuk/veli ürün akışı değil; native ekran yerine motor denetimi olarak kullanılabilir |
| `/english-lab` | Geliştirici aracı | Çocuk/veli ürün akışı değil; native ekran yerine motor denetimi olarak kullanılabilir |
| `/child/stories` | Yok | El yazısı/fotoğraf, yazılı editör, çoklu taslak, otomatik kayıt, çatışma koruması, değerlendirme, düzeltme, kapak |
| `/child/homework` | Yok | 1–15 fotoğraf, özel Storage yüklemesi, tarih teyidi, veli onayı, hafta geçmişi |
| `/child/drawings` | Yok | Yaşa göre katalog, adımlar, fotoğraf/kırpma, gönderme/onay/ödül, çizim arşivi |
| `/child/puzzle` | Kısmi | Sunucu soruları/cevapları, 3 ipucu, yeniden deneme, bilmiyorum, pekiştirme ve erteleme bağlandı; cihaz E2E açık |
| `/child/english` | Yok | Sunucudan sorular, bir/iki cevap, 3 ipucu, görsel yardım, pekiştirme, sonuç/ödül |
| `/child/review/:ledgerId` | Yok | Önceki matematik/İngilizce/bulmaca oturumunun soruları ve cevapları |
| `/child/goals` | Kısmi | Hedef okuma/istek/talep; hata ve bakiye yenileme düzeltildi; gerçek veli onayı testi açık |
| `/child/gems` | Eksik / yanlış eşleme | Ayrı hareket geçmişi yok; eski gems yolu goals açıyor. Ledger ve oturum tekrar incelemesi gerekli |
| `/child/reading` | Yok | Kapak tanıma, mevcut/yeni kitap, sayfa fotoğrafları, sorular, okuma ödülü, kitap bitirme |
| `/child/library` | Yok | Devam edilen kitaplar, bulut/yerel taslaklar, tamamlananlar arşivi, filtreler, silme/bitirme |

## Bu çalışma sırasında düzeltilen gerçek uyumsuzluklar

- Kardeş seçimi PIN isteğine `child_id` ile eklendi; yanlış kardeşe giriş ve belirsiz eski PIN eşlemesi önlenir.
- Aile yükleme hatası, boş aile ve yanlış PIN ayrıldı; 60 saniyelik kilit bilgisi yuvarlanır.
- Unutulan PIN, seçili çocuğa ait `/forgot-pin` isteğini yapar. Ekran isteğin alındığını söyler; WhatsApp teslimi olmuş gibi davranmaz.
- Alt gezinme eklendi; soldaki menü kaldırıldı. Giriş/PIN/ana kartlar/matematik/bulmaca karşılama ve sonuçları kullanılabilir pencereye göre yerleşir.
- Bulmacadaki `retry:true` soruyu bitirmiyordu; artık yeniden deneme gösterilir ve yanlış şık seçilemez. İpucu 3 basamak, sunucudan istenir; cevap anahtarı önceden alınmaz.
- Bulmacada “bilmiyorum” gerçek `skip` isteğidir. Pekiştirme teklifini başlatma/bitirme ve açıkça erteleme API bağlantıları eklendi.
- Biten bulmaca kaydı hata verirse yeni oturum açmak yerine aynı bitirme isteği yeniden denenir.
- Sunucu pekiştirme önerdiğinde veli mesajı karara kadar bekler. Native’in teklifi yok sayması otomatik zaman aşımına kadar gecikme yaratıyordu; artık aynı karar yolları kullanılır.
- Hedef talebi hata verirse sessizce kaybolmaz. Bakiye istemcide fiyat çıkarılarak tahmin edilmez; sunucudan tekrar okunur.
- Hatalı today-summary cevabı gerçek sıfır bakiye gibi kabul edilmez; çocuk değişince eski isteğin sonucu yeni çocuğun ekranına yazılmaz.

## Ortak altyapı ve gerçek engeller

1. **Yayın/CI izni:** Daha önce `git push`, otomatik onay denetimi tarafından herkese açık `issolded/tuto` deposuna kod yayımlamak için açık kullanıcı izni olmadığı gerekçesiyle reddedildi. Bu yasak başka API üzerinden aşılmadı. Kod yerel dalda; uzak cihaz CI çalıştırmak için dalın yayımlanması gerekir.
2. **Cihaz testi:** Bu ortamda `/dev/kvm` yok. Önceki yazılım emülatörü denemesi açılamadı. Derleme ve JVM testleri çalışır; Compose cihaz testleri yalnız derlenmiştir. Fiziksel Android tablet veya hızlandırılmış CI gerekir.
3. **Canlı E2E:** Bu çalışma ağacında `.env`/test ailesi oturumu yok. Ayrı test ailesi, test çocuğu ve test veli kanalı olmadan Ada’nın gerçek kayıtlarına yazılmadı. Gerçek WhatsApp test mesajı için izinli alıcı gerekir.
4. **Supabase/API kapsamı:** Web `books`, `bt_ledger`, ebeveyn oturumları/ayarları ve Storage yüklemelerinde doğrudan Supabase kullanır. Native’de bunların bağlantısı henüz yok. Native’e servis rolü anahtarı gömülmemeli; public istemci yapılandırması + mevcut RLS veya uygun backend uçları kullanılmalı.
5. **Migration durumu bilinmiyor:** Hikâye taslağı, matematik/İngilizce/bulmaca pekiştirme ve veli sohbeti SQL dosyaları repoda. Canlıda uygulanmış oldukları bu oturumda doğrulanmadı; “eksik” varsayılmadı. Gerekirse DB işlemlerini kullanıcı yapar.
6. **Geliştirme eksikleri erişim engeli değildir:** Eksik native ekranların yazılması hâlâ yapılacak iş. Yayın veya cihaz erişimi sağlanınca kendiliğinden tamamlanmış olmayacak.

## Web’den aynen kopyalanmaması gereken davranışlar

- `ChildSettings` ekran süresi mevcut web’de örnek uygulamalar ve localStorage sayacı kullanır. Gerçek Roblox/YouTube engellemesi veya cihaz kullanımı değildir. Dummy istenmediği için native’de gerçek kontrol olarak sunulmaz.
- `GET /api/children/:childId/gems` Supabase okuma hatasını denetlemeden boş listeyi sıfıra çeviriyor. HTTP 200 olması her durumda doğru bakiye kanıtı değildir; backend hata sözleşmesi düzeltilmeli.
- Web matematik kâğıt değerlendirmesinde istisna yolunda sabit `score:70, accuracy:70` içeren fallback var. Native’de başarısız fotoğraf değerlendirmesi gerçek ölçüm gibi kaydedilmemeli.

## Tam sürüm kabul kapısı

Her gerçek çocuk akışında: aile/PIN → etkinlik → sunucuda kayıt → sunucunun verdiği Gem/kota → veli onayı/bildirimi → yeniden açıldığında aynı kayıt. Veli ekranları ayrıca oturum ve sahiplik kontrolleriyle doğrulanmalı. Tablet yatay/dikey, bölünmüş pencere, büyük yazı, klavye, fotoğraf izinleri, bağlantı kesilmesi, yeniden deneme ve uygulama kapanıp açılması denenmeli. Placeholder ekran, demo bakiye ve simülasyon kontrolü tam sürüm sayılmaz.

## Test kanıtları

- Önceki doğrulama: QuickJS 162 matematik oturumu; bulmaca 11.492 şekil, sıfır eksik; 5 ortak Kotlin testi; 16 aile/cevap kuralı testi.
- Bu tur: `:androidApp:testDebugUnitTest` dört test geçti: retry/ipucu soruyu bitirmez; atlanan soru → pekiştirme → doğru bitirme ucu; erteleme sunucudan yanıt bekler; başarısız bitirme aynı oturumu yeniden dener.
- `:shared:jvmTest`, Android debug APK, instrumentation APK ve lint geçti: 0 hata, 6 uyarı. Cihaz senaryoları derlendi, çalıştırılmadı.
- Gerçek `server/index.js` kodunun mevcut izole harness’i ile 8 yaş × EN/TR/ES bulmaca matrisi geçti: yardım payları, retry, pekiştirme/erteleme, günlük Gem tavanı, tek veli bildirimi ve veli dili. DB bellekte; Telegram/WhatsApp taşıyıcıları stub. Bu canlı WhatsApp teslim kanıtı değildir.
- Cihazda ve gerçek WhatsApp alıcısıyla çalıştırılmayan testler başarılı sayılmaz.

## Published Android CI follow-up

Source `3217f87` is published on `codex/android-complete`. GitHub run
https://github.com/issolded/tuto/actions/runs/37461523253 passed Android build,
9 JVM tests, lint (0 errors), and 4 Pixel Tablet API 35 instrumentation tests.
The tablet tests inject a fake API; they do not verify production WhatsApp delivery
or replace the missing native features listed above. Landscape screenshots were
reviewed; portrait, split screen, large fonts and real-device checks remain pending.

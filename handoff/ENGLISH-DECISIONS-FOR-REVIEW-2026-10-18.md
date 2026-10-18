# Tuto İngilizce: seviye belirleme, navigasyon, ebeveyn iletişimi — revizyon 3 (2026-10-18)

Bağlam: Tuto çocuklar için bir eğitim uygulaması; öğretici değil **asesör** (çocuğun gösterdiği beceriye
uygun soru seçer). Aynı ürüne 7 yaşında anadili İngilizce bir çocuk da (Ada: UK doğumlu, Türk aile,
Dubai), hiç İngilizcesi olmayan bir çocuk da (Osman: Türk) gelir. Yayında bugün yalnız "English"
kartı var ve arkasında sözel akıl yürütme (VR, Bond kitaplarından) duruyor. Kodlanmadı.
Ayrıntı: `docs/ENGLISH-SKILL-LADDERS.md` ("Navigasyon ve sözel akıl yürütme"),
`docs/ENGLISH-LITERACY-ARCHITECTURE.md`.

**Revizyon 3'te ne değişti:** revizyon 2 incelemesinin altı notu ve olay/durum ayrımı kabul edildi.
Değişen yerler **[rev. 3]** ile işaretli. Bizden bir ek: pilot deneme kuralına ulaşılabilmesi için ilk yoklamanın
VR önkoşul maddelerini bilerek içermesi gerekir (§3).

## 1. Seviye belirleme ve kanıt

- **Tek puan yok.** Beş alan, her birinin kendi basamakları: A dinleme, B yazılı kelime anlamı,
  C cümle (anlama ve doğru biçim ayrı iz), D yazım, E metin anlama. CEFR/UK Year eşdeğerliği iddia edilmez.
- **Beceri alan içinde de ayrı izlenir;** durum beceri × basamak düzeyinde.
- **Yaş seviye değildir.** Yaş yalnız ilk soruyu seçer; sonraki yönü cevaplar belirler.
- Başlangıç yoklaması kısa ve geçici; 10 soruda kesin seviye iddiası yok.
- **"Bir üst basamağı dene" ≠ `secure`.** `secure` = "bu basamakta tanımlanan beceriler için şimdilik yeterli
  bağımsız kanıt var"; kalıcı değil, yeniden yoklanabilir. Yardımdan sonraki doğru pratik sayılır.
- **[rev. 3] Bağımlılık grubu, beceri başına.** Bir metin tek bir bağımlılık grubu; sonuçları beceri başına ayrı.
  Aynı metin aynı beceriye üç bağımsız örnek vermez, ama farklı becerilerin gözlemleri (ayrıntı doğru, çıkarım
  yanlış) kaybolmaz. dog/dogs: kelime anlamında aynı aile; çoğul sorusunda ayrıca çoğul becerisine kanıt.
  Aynı hikâyeyi başka gün okumak yeni metin çeşitliliği değil, **gecikmeli tekrar başarısı**.
- **[rev. 3] Eşik beceriye göre.** 12 kelime ile 12 hikâye farklı yük; alanlar arası ortak "10–12 birim" yok.
  Ortak çerçeve (varsayım): en az iki ayrı gün, en az iki soru ailesi, yüksek bağımsız doğruluk, alt beceri kapsamı,
  E için metin çeşitliliği. Dört çocuklu pilot akışı sınar, eşiklerin genel geçerliliğini doğrulamaz.
- **[rev. 3] Türetilen durum ile kalıcı olay ayrı.** Yeterlik, teklif uygunluğu ve zorlanma ham deneme kayıtlarından
  yeniden hesaplanır; kayıt madde, aile, bağımlılık grubu, gün, destek, **içerik sürümü ve değerlendirme kuralı
  sürümü**nü taşır. Gönderilmiş mesaj, ebeveyn reddi, "bir daha sorma" ve elle açma/kapama kalıcı olaydır:
  eşik değişince geçmiş teklif unutulup yeniden gönderilmez.
- Oturum planı hipotezi ~%60 çalışma / %20 tekrar / %20 yoklama. Tepki süresi seviye ölçütü değil.
  Tavan/taban: uygun içerik yoksa "kapsam tavanı", sessiz fallback yok.
- Bölümün içinde ekrandaki her şey İngilizce (soru, yönerge, ipucu, geri bildirim, düğmeler, sonuç ekranı; 2026-10-17);
  başta puansız çözülmüş örnek. Ebeveyn mesajları ebeveynin dilinde. İlk pilot UK/US ortak içerik.

## 2. Navigasyon

- **Tek "English" kartı, matematik gibi.** Alt alanlar çocuğa ayrı kart/menü değil; beceriyi planlayıcı seçer.
- **[rev. 3] Çocuğun seçimi başlangıçta yalnız hikâye konusu ve blok sırası.** Eşdeğerlik: aynı basamak + benzer
  hedef beceri, uzunluk, kelime yükü ve destek. Seçilmeyen hikâye yalnız başlığı/kapağı gösterildiyse havuza döner.
  Gem aynı. Zayıf alanı atlatmaz.
- Alan dökümü ebeveyn tarafında ve sonuç ekranında kısa özet. Metin anlama oturum içinde bir blok; ana
  ekrandaki "Reading" gerçek kitap okuma olarak kalır.
- **Ses kontrolü:** ilk dinleme bloğundan önce örnek ses + "Duydum / Şimdi ses kullanamıyorum". İkincisinde
  dinleme atlanır, `unknown`. "Duydum" beyandır, kanıt değil.
- **VR "Bulmacalarım"a (NVR) girmez:** NVR dilden bağımsız; VR İngilizce bilgisi ister. VR, English kartı içinde
  ayrı bir oturum türü ("Word puzzles"); kanıt, gem sınırı, geçmiş ayrı. Kapalıyken seçim ekranı yok.

## 3. VR ne zaman açılır

- **Ebeveyn beyanıyla değil, ölçümle.** Onboarding'de okul/dil sorusu yok; Tuto önerir, ebeveyn onaylar.
  Ebeveyn istediği an kendisi de açabilir.
- **Önkoşul soru ailesi başına.** VR-1 ↔ B3, VR-2 ↔ B4 yalnız kaba eşleme hipotezi. VR oturumu yalnız açılmış
  ailelerden çeker; teklif bir bantta yeterli aile açılınca. **[rev. 3]** "Yeterli aile" tekrar etmeden kısa bir
  oturum üretebilecek içeriği de kapsar.
- **[rev. 3] Önkoşul tablosu mevcut üreticilerden çıkarılır:** ilk taslak motoru bilen ajandan, ikinci inceleme
  gerçek örnek sorular üzerinden. Satır: aile, gereken beceri, kelime yükü, doğrudan yoklama, denemeye alınma koşulu.
- Motorda gerçek akıl yürütme tipleri yalnız iki bantta (7-8, 8-9); 9-12 bantları kelime/yazım/dilbilgisi, merdivene
  geçer. Okuryazarlıkla açılan çocukta VR bandı yaştan gelmez.
- **Deneme erişimi ≠ yeterlik.** **[rev. 3] Pilot deneme kuralı:** iki uygun ailede üçer yeni sorunun tamamı yardımsız
  doğruysa ebeveyne kısa "Word puzzles denemesi" önerilebilir; yeterlik eşiği değil, `secure` ikinci günü bekler.
  Şans düzeltmesi tek yüzdeye çevrilmez; kuralın fazla seçici olup olmadığı pilotta izlenir.
  **[rev. 3, bizden]** Ana dili İngilizce çocuğun ilk oturumda bu kurala ulaşabilmesi için ilk yoklama bu ailelerin
  önkoşul maddelerini bilerek içermeli; yoksa kural ilk gün hiç tetiklenemez.
- Reddedilir/cevapsız kalırsa bir sonraki VR seviyesinde yeniden sorulur; "bir daha sorma" teklifleri kapatır,
  elle açma açık kalır. VR geçmişi olan çocukta (Ada) açık kalır.
- **Bilinen eksik:** VR-2'nin üstü yok (Bond 9-12 VR kitapları motora girmedi). Tamamlanacak.

## 4. Ebeveynle iletişim

- **Etiket değil, ne yapabildiği.** Aynı kanıt ebeveynin kökenine göre farklı adlandırılmaz.
- **İddianın kapsamını kod seçer;** model yalnız seçilen kalıbı doğal dile çevirir, ölçülmemiş alan hakkında cümle kuramaz.
- **[rev. 3] Kalıplar beceri × durum düzeyinde;** yalnız ilgili kanıt varsa kullanılır. İlk Türkçe çekirdek:

  | Durum | Örnek |
  |---|---|
  | Yeterli kanıt | "Farklı kısa metinlerde açıkça verilen bilgileri yardımsız bulabiliyor." |
  | Az kanıt | "Çıkarım sorularında henüz yeterli örneğimiz yok." |
  | Yardımla başarı | "İpucundan sonra doğru cevabı buldu; yardımsız yeni örneklerle tekrar bakacağız." |
  | Tekrarlanan zorlanma | "Farklı sorularda geçmiş zaman biçimini seçerken zorlandı." |
  | İçerik tavanı | "Elimizdeki en ileri örnekleri çözdü; daha ilerisini henüz ölçmedik." |

- Mesajlar ebeveynin dilinde, normal bildirim kapısından geçer.
- **Temel düzeyde zorlanan çocuk:** İngilizce kendiliğinden kaldırılmaz; yeterli sayıda farklı soruda bağımsız doğru
  tahmin düzeyine yakınsa ebeveyne bir kez, gözlem olarak yazılır. Gizlemek/açmak ebeveyn kararı.
- Her ayar iki yüzeyde: uygulama ayarları ve sohbet.

## 5. Öncelik ve sıradaki işler

**Öncelik:** kanıt sayma kuralları ve VR önkoşul tablosu; sayısal eşikler en son.

1. VR önkoşul tablosu taslağı (mevcut üreticilerden) → gerçek örnek sorularla ikinci inceleme.
2. Beceri başına eşik çerçevesi: hangi becerinin kaç bağımsız örnek / kaç metin istediği (varsayım olarak).
3. İlk yoklamanın VR önkoşul maddelerini nasıl içereceği (10 soruluk bütçede yer).
4. Kalıp listesinin beceri × durum tamamı ve EN/ES karşılıkları.

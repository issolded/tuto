# Tuto — Matematik: mevcut durum ve devir notu

*8 Ağustos 2026. Bu belge matematiği devralacak kişi için yazıldı; kodu okumadan önce buradan başla.*

---

## 1. Temel model: yaş konuyu, seviye zorluğu seçer

Eskiden tek bir 15 basamaklı merdiven vardı ve **basamak konuyu seçiyordu**: 6. basamak "Subtraction up to 20" demekti, dolayısıyla 10 yaşındaki bir çocuk her seansta sadece çıkarma yapıyordu. Merdivenin en üst basamağı `1/4 of 28` idi.

Şimdi iki iş ayrıldı:

- **YAŞ müfredatı seçer.** `children.age` → okul yılı → o yılın bütün konuları.
- **SEVİYE (`level`) sadece zorluğu ayarlar**, konuyu değil.

```
yaş     yıl      kadran (level)   sayı tavanı
≤6      Year 1   1–2              20
7       Year 2   3–4              100
8       Year 3   5–6              1.000
9       Year 4   7–8              10.000
10      Year 5   9–10             20.000
11+     Year 6   11–12            50.000
```

`clampLevelToAge()` seviyeyi çocuğun yılına **kelepçeler** (`[base-1, base]`). Bu önemli: eski verilerde 7 yaşındaki Ada `level 15`'te kayıtlıydı ve Year 2 konularını en üst sayı aralığında alıyordu — `31099 + 17807`. Kelepçe bunu 4'e indiriyor.

> Bir yıl tam iki basamak ve aralıklar yıllar *arasında* değişiyor. Yani kadranın yıl içinde yapacak fazla işi yok — **anlamlı zorluk birimi okul yılıdır**. Yıllar arası geçiş bilinçli olarak ebeveyne sorulacak bir karar olarak bırakıldı (bkz. §9).

**Müfredat:** `src/lib/gemini.js` içindeki `BRITISH_CURRICULUM` — Year 1–6, 49 konu, her birinin modele verilmek üzere yazılmış açıklaması var. Bu yapı aylardır repodaydı ama **hiç kullanılmıyordu**; `generateMathQuestions` onu kullanacak `topicId` parametresini alıyordu ve hiçbir yerden geçilmiyordu.

---

## 2. Bir seans nasıl kuruluyor

`QUESTIONS_PER_SESSION = 10`, her yaş için aynı.

`planSession(age, 10, recentTopicIds, weighting)` (`src/lib/mathCurriculum.js`) o yılın konularından 10 slot seçer. Yılın bütün konuları bir kez kullanılmadan hiçbiri ikinci kez kullanılmaz; son seansta çıkanlar sona atılır.

Her slot iki yoldan biriyle doldurulur:

| yol | kim üretir | garanti |
|---|---|---|
| **şablon** | `src/lib/mathTemplates.js` | cevap **inşa edilir**, yanlış olamaz + görsel yardım var |
| **LLM** | tek bir Gemini çağrısı, kalan bütün slotlar için | cevap **iddia edilir**, doğrulanmıyor |

Hangi konunun şablonu olduğu **konu konu** karar verilmiş (`TEMPLATE_FOR_TOPIC`), operasyon etiketiyle eşleştirilmemiş. Sebebi önemli: etiketle eşleştirmek "Decimals and Percentages"e `1/4 of 28` çizdiriyordu (çünkü `fractions` etiketli) ve "Numbers to 1.000.000"a yedi elma. Düzgün görünüp yanlış şey öğreten sorular.

**Yaşa göre kod/model dağılımı** (100 seans ortalaması):

```
 6 yaş  Year 1   kod 8/10   model 2/10
 7 yaş  Year 2   kod 7/10   model 3/10
 8 yaş  Year 3   kod 6/10   model 4/10
 9 yaş  Year 4   kod 7/10   model 3/10
10 yaş  Year 5   kod 5/10   model 5/10
11 yaş  Year 6   kod 0/10   model 10/10
```

Year 6 tamamen modelde çünkü şablonlarımızın çarpım tabloları 12'de bitiyor; uzun çarpma kod olarak yok.

**Şablonlar:** counting/number-line, addition, subtraction, multiplication-word, division-word, fraction-of-number, geometry. Hepsi `lang` alır (TR/EN) ve `rangeForLevel` üzerinden yıla göre ölçeklenir.

---

## 3. Ağırlıklandırma — seans çocuğa tepki verir

`planSession`'ın `weighting` parametresi:

- Ebeveynin koyduğu **odak** 10 slotun **3'ünü** alır (`FOCUS_SLOTS`)
- Ölçülmüş **zayıf** her konu 1 slot daha alır
- İkisi birlikte en fazla **5 slot** (`MAX_WEIGHTED_SLOTS`)
- Ağırlıklı slotlar seansın içine **dağıtılır**, başa yığılmaz

Ölçüm (300 seans): ağırlıksızken 8 konunun 8'i çıkıyor; odak varken odak 1,25'ten 3,9 soruya çıkıyor ama hâlâ 7,1 farklı konu görünüyor; odak + iki zayıf konuda 6,1 farklı konu. **Genişlik korunuyor** — tek-konu tezgâhına dönmek en büyük riskti.

---

## 4. Ne kaydediliyor

**`math_attempts`** — soru başına bir satır (migration: `server/migrations/2026-08-06_math_attempts.sql`):

```
child_id, session_id, topic_id, topic_name, source ('template'|'llm'),
level, question, child_answer, correct, help_used, created_at
```

Ham olay kaydı, `bt_ledger` gibi. **Ustalık tablosu yok** — her özet okuma anında hesaplanır. Sebebi: aynı gerçeğin ikinci kopyası zamanla ilkinden ayrışır (bu projede `prefs.gem_values` 20 derken `task_settings` 30 diyordu).

`math_progress` de yazılmaya devam ediyor (seviye, doğruluk, seans özeti) — ebeveyn ajanının bağlamı oradan besleniyor.

---

## 5. Konu bazında ustalık

`topicStanding(childId)` — sunucu tarafı, `server/index.js`.

```
MASTERY_WINDOW       = 12    // konu başına son 12 deneme
MASTERY_MIN_ATTEMPTS = 5     // altında HÜKÜM YOK
MASTERY_WEAK_BELOW   = 60    // %60 altı "weak"
MASTERY_CLEARS_AT    = 80    // %80 üstü "strong" / odak kalkar
```

Gün penceresi değil **deneme penceresi**: sık çalışılan konu hızlı tazelenir, seyrek çıkan konunun hafızası uzun kalır. Ayrıca konu kimlikleri yıla bağlı (`y5_fractions`), yani çocuk Year 6'ya geçince eski yılın kaydı **kendiliğinden emekli olur**.

**5 deneme eşiği kritik.** Ölçüldü: bir konuda 5 denemeye ulaşmak 4–5 seans sürüyor (8 konu, 10 soru → konu başına ~1,25 soru). Altındaki konular ajana **rakamsız** gider — sadece "kaç soru çözüldü" ve "hüküm vermek için erken". Bu böyle yapılmasa model tek doğru cevabı görüp "%100 başarılı" diyor (denendi, dedi).

Okuyan iki yer var, **tek kaynak**:
- `GET /api/children/:childId/math-plan` → çocuğun ekranı (seviye + odak + zayıf konular)
- `getParentContext` → ebeveyn ajanının bağlamı

Ayrışmasınlar diye bilerek aynı fonksiyondan besleniyorlar.

---

## 6. Ebeveyn odağı

Araç: **`set_math_focus`** (sohbetten). *"Ada kesirlerde zorlanıyor, kesirlere ağırlık verelim"*.

Model sadece **hangi konu** olduğunu seçer; geri kalan her karar kodda:

- Konu kimliği, çocuğun **kendi denemelerinden** doğrulanır — sunucuda müfredat kopyası tutulmuyor (frontend'de yaşıyor ve ikisi ayrı deploy ediliyor, kopya ayrışırdı)
- Zaten ustalaşılmış konuya odak **reddedilir** (rakamlarıyla)
- Başka ebeveynin çocuğuna odak **reddedilir**
- Uydurma kimlik reddedilir + gerçek liste döner
- `"none"` odağı kaldırır

**Odak ustalığa kadar yaşar**: o konuda son 12'de %80'i geçince kendiliğinden kalkar ve ebeveyne haber gider — *"Ada kesirleri toparladı — son 12 soruda %100. Ağırlığı kaldırdım."* Bu mesaj günde-bir kuralına takılmaz; rutin ilerleme değil, ebeveynin istediği şeyin sonucu.

Odak `children.math_focus` (jsonb) kolonunda. **Bilerek `task_settings` içinde değil** — o kolon ayarlar ekranında toptan yeniden yazılıyor, odağı silerdi.

---

## 7. Ödül

Hepsi sunucuda (`POST /api/children/:childId/math-session`). İstemci hiçbir şey hesaplamıyor.

```
gem = ebeveynin ayarı × (0,33 + 0,67 × doğruluk) × (ipucu alındıysa 0,67)
MATH_DEFAULTS = { gems: 30, dailyCap: 3 }
```

Kayan ölçek: 5/5→30, 4/5→26, 3/5→22. (Eskiden bantlıydı ve %80 ile %100 aynı ödemeyi veriyordu.)

Günlük limit **kapalı düşer** — sayım okunamazsa hiç ödeme yapılmaz.

**Seviye değişimi de sunucuda**: yükselmek için aynı basamakta **arka arkaya iki** iyi seans gerekir (tek iyi seansla yükselmek 7 yaşındaki bir çocuğu 35 dakikada dört basamak yukarı taşımıştı). Düşmek tek seans — zorlanmak, hızlı hareket etmenin faydalı olduğu durum.

**Bildirim**: `prefs.notify_per_task` (varsayılan `true`) her ödüllü seansı duyurur; `false` günde bire indirir.

---

## 8. Yardım, skip ve dil

**İsteğe bağlı ipucu**: her sorunun altında kapalı bir "💡 İpucu". Sadece **ilk adımı** gösterir — şablonların ikinci adımı sayıları tek tek sayar ve cevabı verir. Açmak yardım sayılır (gem'in üçte biri düşer), yani "önce ipucuna bak" ucuz numara değil.

**Skip butonu** — 8 yaş altı için kritik: yardım paneli açıldıktan sonra "Bunu geç" çıkar ve **geçilen soru yanlış sayılır**. Öncesinde 8 yaş altında yanlış cevap vermek *imkânsızdı* (aynı soru doğru yapılana kadar geliyordu), her seans %100 bitiyordu, dolayısıyla seviye düşürme kuralı hiç çalışmıyordu. Ada'nın 15'te sıkışmasının sebebi buydu.

**Dil**: `children.language` (TR/EN). Onboarding'de ve ayarlarda seçiliyor. Sorular, ipuçları, şablon metinleri ve arayüz bu dile bağlı. `generateCurriculumQuestions` dili alır; müfredat açıklamaları İngilizce kalır (modele yazılmış metin, çocuğa değil).

---

## 9. Açık işler

1. **LLM cevabı doğrulanmıyor.** Model soruyu *ve* cevabı üretiyor, hiçbir şey kontrol etmiyor. 38 soruyu bağımsız bir çağrıyla tekrar çözdürdüm, **0 uyuşmazlık** çıktı — ama 38'de sıfır hata, gerçek oranın ~%8'e kadar olmasıyla uyumlu. Önerilen: üretim anında ikinci bir çağrıyla çözdürüp uyuşmayan soruyu atmak (eleme mekanizması zaten var). Özellikle Year 6 için önemli — orada soruların **tamamı** modelden geliyor.

2. **Yıl geçişi.** Kadran yıla kelepçeli, yani çocuk kendi yılının tavanına takılıyor. Doğru çözüm: yılının tepesinde ipuçsuz rahat çözen çocuk için ebeveyne *"bir üst yılı açayım mı?"* teklifi + `math_year_offset`. Skip butonu geldiği için "rahat çözüyor" sinyali artık ölçülebilir.

3. **Promptta üç küçük eksik**: (a) **persona yok** — Google'ın PARTS çerçevesinde bizde eksik olan tek harf; (b) zorluk LLM yarısına ulaşmıyor (prompt seviye 5–11 arası hep "the middle of this topic" diyor, yani dokuz seviyede aynı); (c) yılın konusu 10 slottan azsa aynı konu tek çağrıda iki kez isteniyor.

4. **`help_used` seviye kararına girmiyor.** Suatkan 10 soruda 9 ipucuyla %40 yaptı — yardımsız %40'tan çok daha kötü, ama kural sadece doğruluğa bakıyor ve eşik `%40'ın altı` olduğu için düşürmedi bile.

---

## 10. Dosya haritası

```
src/lib/mathCurriculum.js   yaş→yıl→konu, seviye kelepçesi, planSession + ağırlıklandırma
src/lib/mathTemplates.js    7 şablon, sayı aralıkları, ipucu adımları, TR/EN
src/lib/gemini.js           BRITISH_CURRICULUM (49 konu), generateCurriculumQuestions, evaluateMath
src/screens/MathScreen.jsx  seans kurgusu, ipucu, skip, çıkış onayı, sonuç ekranı
src/lib/i18n.js             çocuk arayüzü sözlüğü (98 dizge)
server/index.js             math-session, math-plan, topicStanding, set_math_focus
server/migrations/          math_attempts + children.math_focus
```

**Ölçmeden değiştirme.** Bu alandaki hataların çoğu "makul görünen ama yanlış" türündendi ve ancak sayarak ortaya çıktı: tekrar oranı, konu dağılımı, sayı aralıkları, İngilizce kalıntı. Değişiklik yaptıktan sonra üretimden 40–60 örnek alıp saymak, gözle bakmaktan çok daha hızlı sonuç verdi.

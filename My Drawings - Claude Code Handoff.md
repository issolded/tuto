# My Drawings — Claude Code Handoff

Bu, tuto çocuk uygulamasına **yeni bir "My Drawings" (Çizim) modülü** ekleme görevidir. Referans tasarım/etkileşim tamamen çalışır halde: `My Drawings Flow.html` (tek dosya, tıklanabilir prototip). Bu dosya **spesifikasyon** — birebir kod değil. Ondan akışı, ekranları, kopyayı ve veri şeklini oku; gerçek implementasyonu mevcut `tuto-app` kod tabanının desenlerine göre yaz.

**Sadece yeni bir modül ekle. Diğer modüllere (My Homework, My Math, My Books, My Stories, My Tree) dokunma.**

---

## 1. Ne inşa ediyoruz

Çocuk bir çizim hedefi seçer (kedi, köpek, robot…), **adım adım kılavuz eskizleri** takip eder (her adım öncekinin üstüne ekler), bitirince **gerçek çiziminin fotoğrafını** çeker, anında ödül (gem/XP) kazanır ve tarihli bir **"My Paintings" kütüphanesine** kaydeder.

Akış:
```
Home tile ("My Drawings")
  → Browse (kategori çipleri: All / Animals / Characters / Objects / Nature)
      → Ready screen ("kağıt-kalem hazırla")
          → Guided steps (adım 1/8 … 8/8, ileri/geri, kümülatif eskiz)
              → Upload (bitmiş çizimin fotoğrafı)
                  → Instant reward (gem/XP, veli onayı YOK)
                      → Library (detay kartı + "Draw again")
  → Kısayol: "Draw my own idea" — adımları atlar, direkt Upload'a gider
```

Üç yaş cildi (skin) var: **6–8, 9–11, 12–15** — farklı maskot, kopya tonu, ödül etiketi (⭐ +20 / gem +20 / +20 XP), köşe yuvarlaklığı. Referans dosyadaki `SKINS` objesine bak.

---

## 2. Görsel varlıklar (step eskizleri)

Adım eskizleri gerçek pencil-sketch görselleri (kullanıcı üretti). Prototipte `drawings/<id>/step-0N.png` olarak duruyorlar — **şeffaf PNG, beyaz zemin ve köşe adım-numarası temizlenmiş**. Şu an hazır olanlar:

| id    | kategori   | adım sayısı |
|-------|------------|-------------|
| cat   | Animals    | 8 |
| dog   | Animals    | 8 |
| robot | Characters | 8 |

`fish`, `house`, `flower` prototipte hâlâ SVG placeholder; kalan hedefler ("Butterfly, Alien, Rocket, Sun") "Soon" olarak kilitli. Yeni hedefler aynı desenle eklenir: eskiz setini yükle + metadata satırı ekle.

**Önemli:** Eskizler **kümülatif** — `step-08.webp` bitmiş çizim, `step-01` ilk hat. Her adımda tek `<img>` gösterilir (katman üst üste bindirme yok, görsel zaten birikimli). `full.webp` = son/kesilmemiş hali (arşiv, opsiyonel).

Prototipteki her adımın **kısa, çocuk dostu ipucu** metni var (örn. "Draw a big oval for the head."). Bunlar `TARGETS[id].steps[].tip`'te. Türkçe karşılıklarını üretmen gerekebilir — ürün diline göre.

---

## 3. Backend mimarisi

### Görsel dosyalar (binary) → Supabase Storage
WebP'leri Postgres tablosuna **koyma**; blob'lar DB'yi şişirir, sorguyu yavaşlatır. Storage bir CDN gibi davranır, görseli hızlı ve cache'li servis eder.

Bucket yapısı:
```
drawings/
  cat/   step-01.webp … step-08.webp  (+ full.webp opsiyonel)
  dog/   step-01.webp … step-08.webp  (+ full.webp opsiyonel)
  robot/ step-01.webp … step-08.webp  (+ full.webp opsiyonel)
```

Bucket **public** olsun — bu görseller hassas değil (çocuğa özel veri yok, jenerik çizim). Public olunca CDN cache devreye girer, her panel için imzalı URL üretme derdi olmaz. Public bucket'ta dosya URL'i sabit ve tahmin edilebilir:
```
{SUPABASE_URL}/storage/v1/object/public/drawings/cat/step-01.webp
```

### Metadata (satır) → Postgres tablosu
Hangi hedefler var, kaç adım, Türkçe adı, kategori, yaş grubu — görselin kendisi değil, **hakkındaki bilgi**:

```sql
create table drawings (
  id text primary key,              -- "cat"
  name_tr text not null,            -- "kedi"
  name_en text not null,            -- "Cat"
  category text,                    -- "Animals" | "Characters" | "Objects" | "Nature"
  age_groups text[] default '{"6-8"}',
  step_count int not null,          -- 8
  created_at timestamptz default now()
);
```

### Uygulama akışı
Frontend `drawings` tablosunu sorgular (hangi hedefler, kaç adım), sonra her panelin URL'ini **Storage path'inden kurar**:
```
{SUPABASE_URL}/storage/v1/object/public/drawings/{id}/step-{n}.webp
```
URL'leri DB'de saklamana **gerek yok** — path deterministik; `id` + `step_count`'tan üretilir. Panel panel `<img>` ile gösterilir, **lazy-load** ile sadece çocuğun baktığı adım iner.

**Sadeleştirme notu:** `full.webp`'yi (kesilmemiş grid) Storage'a koymak isteğe bağlı. Tek tek panel gösteriyorsan gerekmez; sadece arşiv/debug için. Yer kaplamasın diyorsan atlarsın, panel WebP'leri yeter.

---

## 4. Çocuğun çizimleri (kütüphane / My Paintings)

Çocuğun çektiği fotoğraf = **kullanıcı verisi**, jenerik eskizlerin aksine hassas. Bunlar için:

- **Fotoğraf dosyası** → ayrı, **public olmayan** bir Storage bucket'ı (örn. `paintings/`), kullanıcıya scoped path (`paintings/{user_id}/{painting_id}.webp`). Erişim imzalı URL veya RLS ile.
- **Kayıt satırı** → Postgres:

```sql
create table paintings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  drawing_id text references drawings(id),   -- null = "Draw my own idea" (free-draw)
  photo_path text not null,                  -- paintings/{user_id}/{id}.webp
  reward_amount int default 20,
  created_at timestamptz default now()
);
```

Kütüphane ekranı `paintings`'i `user_id`'ye göre, tarihe göre azalan sorgular; detay kartı `drawing_id` üzerinden hedef adını/adım sayısını `drawings`'ten çeker (free-draw ise "My own drawing").

---

## 5. Ödül (reward) tetikleyici
Fotoğraf eklenince **anında** ödül verilir (**veli onayı yok**), gem/XP bakiyesi mevcut sistemdeki desenle güncellenir. Prototipte `+20`. Yaş cildine göre etiket değişir (⭐/gem/XP) ama miktar aynı. Mevcut ödül/bakiye servisini kullan — yeni bir bakiye sistemi kurma.

---

## 6. Frontend implementasyon notları
- Yeni route + `drawings` tablosunu çeken browse ekranı (kategori filtresi client-side yeterli).
- Guided-step bileşeni: adım index state'i, ileri/geri, `step-{n}.webp` lazy-load, ilerleme göstergesi ("Step n/N" + segment bar).
- Upload: kamera/dosya girişi → önizleme → "Add to my library" → `paintings` insert + reward.
- Home tile: koleksiyon sayısı + son 3 küçük görsel + "Open library" linki. Mevcut home grid'e My Homework tile'ının yanına yerleştir; grid/tile stilini komşularından kopyala.
- "Draw with Tuto" promo kartındaki karakter yaşa göre değişir; 6–8 için `cat/step-08` eskizini kullanır (referans dosyada `HERO_IMG`).

## 7. Kabul kriterleri
- [ ] cat, dog, robot browse'da görünür ve tam 8-adım akışı çalışır (ileri/geri, doğru görseller).
- [ ] "Draw my own idea" adımları atlayıp upload'a gider.
- [ ] Fotoğraf ekleme → `paintings` satırı + anında ödül + kütüphanede görünür.
- [ ] Step görselleri public Storage'dan deterministik URL ile, lazy-load gelir; DB'de blob YOK.
- [ ] Üç yaş cildi doğru kopya/etiket/maskot ile çalışır.
- [ ] Diğer modüller değişmemiş.

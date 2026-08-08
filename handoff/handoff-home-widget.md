# Handoff — ChildHome "Bugün" özet widget'ı

**Dosya:** `src/screens/ChildHome.jsx`
**Amaç:** Ana ekrandaki dev maskot + "Ready to earn? 🌟" hero'sunu kaldır. Yerine, gem avını değil **çocuğun bugününü** öne çıkaran bir **"Bugün" özet kartı** koy: üstte ağaç durumu, ortada bugün yapılan aktiviteler, altta en yakın hedef. Kart **yaş bandına göre** uyarlanır (My Tree'deki `bandFor` mantığıyla birebir).

Referans görsel mock: `Tuto Home Widget.html` (bu projede — Claude Code göremez, sadece açıklama esas alınır).

---

## 1. Kaldırılacak

`ChildHome.jsx` içindeki `.tuto-hero` bloğu (mascot halo + "Ready to earn? 🌟") tamamen silinir. Header (greeting + gem pill) ve `.tuto-task-grid` **aynı kalır**. Yeni kart, header ile task grid'in arasına girer.

## 2. Veri kaynakları (hepsi gerçek, mevcut)

- **Ağaç:** `GET {SERVER}/api/tree?child_id=` → `{ today, monthTreeCount, ... }`. `today` = bugünkü yaprak/katkı sayısı, `monthTreeCount` = bu ay büyütülen ağaç sayısı. (MyTree.jsx'te aynen kullanılıyor.)
- **Bugünkü aktiviteler:** her görev tipinin bugün kaç kez yapıldığı. Tipler: `reading, math, writing, chore(=tree), homework, drawing`. Bugünün sayımını mevcut ledger/aktivite kaynağından türet (chore zaten `/api/tree` `today`). Eğer tek uçtan gelmiyorsa, ChildHome'da hâlihazırda dinlenen `bt_ledger` INSERT realtime kanalı + günlük filtre ile "bugün yapıldı mı / kaç kez" bilgisi çıkarılır. Kesin uç yoksa bana sor — uydurma sayı gösterme.
- **Hedef:** `getChildRewards(child.id)` + `getChildGems(child.id)`. En yakın hedef = `bt_cost > currentGems` olanlar içinde **en küçük `bt_cost`**. `remaining = bt_cost - gems`, `pct = gems / bt_cost`.

## 3. Bandlar (`bandFor(child.age)`: young ≤8 · mid 9-11 · mature 12-15)

Üç yerde de kart 3 bölümlü: **ağaç → aktivite şeridi → hedef**. Fark ton/görsellik:

### young (6-8)
- **Ağaç satırı:** solda `<TreeArt size={62} fruits={today} target={4} />`, sağda iki sayaç: **{today}** "yaprak bugün" · **{monthTreeCount}** "ağaç bu ay". Tüm satır tıklanır → `/child/task` (My Tree). Sağda chevron `›`.
- **Maskot:** `<TutoMascot size={66} />` kartın **sağ üst köşesinden bakar** (position:absolute, top:-24, right:16, drop-shadow). Bu onaylanan yerleşim.
- **Aktivite şeridi:** kart içinde ince dashed ayraçtan sonra. 5 çip (reading/math/writing/homework/drawing — chore ağaç olarak zaten üstte). Yapılan = renkli tile + sağ üstte rozet (✓, birden fazlaysa sayı); yapılmayan = soluk (gri, opacity .5). Çip renkleri task tile bg'leri: reading `#E8E0FF`, math `#D4EDFF`, writing `#D4F5E0`, homework `#FFF1CF`, drawing `#EFE3FF`.
- **Hedef satırı:** dashed ayraç sonrası. 🎯 + "Paten'e çok yakınsın" + "⭐ {remaining} gem kaldı · {gems}/{cost}" + turuncu-sarı progress bar. Tıklanır → `/child/goals`.
- Bol emoji, sıcak dil.

### mid (9-11)
- Aynı iskelet, **daha sakin**: ağaç `size={56}`, ikiz sayaç yerine tek satır "3 yaprak bugün · bu ay 5 🌳" + altında yeşil progress bar (today/4). Maskot `size={54}`, yine köşeden bakar. Emoji az. Aktivite cümlesi düz: "2 iş kaldı: ödev ve çizim".

### mature (12-15)
- **Cartoon ağaç ve maskot YOK.** Palet monokrom-yeşil (My Tree "My Part" bandıyla uyumlu: `#27332c`, `#6c7c72`, `#2f8f6b`, kart bg `#F7F9F6`, border `#E4EAE3`).
- Ağaç yerine `<Sprig size={24} />` + "3 katkı bugün · 5 bu ay".
- Aktiviteler büyük emoji tile değil, **küçük monokrom pill**: yapılan `✓ Kitap` (yeşil zemin `#E2F0E9`), yapılmayan `○ Çizim` (gri `#EEF1ED`). Etiketler kısa: Kitap, Matematik, Yazı, Ödev, Çizim.
- Hedef: "Paten" + "42 ⭐ kaldı" + ince düz bar (`#2f8f6b`).
- Ölçülü, çocuksu değil.

## 4. Tablet (`useIsTablet` / ≥768px — Shell'de mevcut)

- Kart tek satırda **3 panele** açılır (CSS grid, ~`1.1fr 1.4fr 1.1fr`, aralarında dashed dikey ayraç): **ağaç | aktivite şeridi | hedef**.
- Ağaç paneli ortalı, `TreeArt size≈100`. Hedef paneli büyük **halka (ring) progress** + "Paten'e {remaining}⭐ kaldı". Maskot (young/mid) kartın üstünden, ağaç–aktivite ayracı hizasından bakar.
- Task grid tablette zaten 3 sütun ve 6 kutu eşit boy (onaylanan düzen) — dokunma.
- Telefon = dikey stack (3 bölüm alt alta), tablet = yatay 3 panel. Aynı bileşen, `isTablet` ile dallanır.

## 5. Dinamik dil ve boş durumlar

- Teşvik cümlesi bugüne göre: hepsi bitti → "Bugün her şeyi yaptın! 🌟"; 1-2 kaldı → kalanları say ("Bir tek ödev ve çizim kaldı"); hiç yapılmadı → nazik başlangıç ("Bugüne başlayalım 🌱"). Band tonuna uydur (mature'da emoji yok).
- **Hedef yoksa** (`rewards` boş): hedef satırını gizleme yerine ince bir "Henüz hedef yok — ailen ekleyebilir 🎯" satırı; tıklanınca yine `/child/goals`.
- Ağaç `today===0`: TreeArt zaten sprout gösterir; sayaç "0 yaprak bugün" kalır.
- Hedef `pct` %100'ü geçmez (`Math.min`).

## Dokunulmayacak

Header (greeting + gem pill + realtime kanal), `.tuto-task-grid` ve kartları, Shell/nav, routing, `task_settings` filtresi. Sadece hero → yeni kart değişir.

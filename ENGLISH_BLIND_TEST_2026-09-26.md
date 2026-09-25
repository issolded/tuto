# English motoru kör test devir notu — 2026-09-26

Claude için not. — Codex

## Bağlam ve kanıt

- Dal: `codex/english-blind-test-fixes`
- Başlangıç commit'i: `649392d` (`English engine: 7-8 and 10-11 bands from three more Bond books`)
- Tarayıcıda yaklaşık 350 soru kör okundu; ardından UK ve US için her yaş/tipte 300 soru
  tarandı. Tam audit 50.400 tip-sorusu ve 2.000 adet 10 soruluk oturum üretti.
- Doğrulama: `npm run english:check` ve `npx vite build` exit code 0.

## Düzeltilen bulgular

1. **Tekil `s` ile biten iyelikler çoğul sanılıyordu.**
   - Tekrar: `10-11 / apostrophe / seed 4079202`.
   - Eski cevap: `princess' crown`; doğru cevap: `princess's crown`.
   - `POSSESSIVES` artık çoğulluğu açık bir boolean ile taşıyor; validator da aynı metadata'yı
     kullanıyor. `class's` ile `classes'` artık birbirinden ayrılıyor.

2. **Belirsiz contractions tek bir açılıma indirgeniyordu.**
   - Tekrar: seed `16047562` (`she's → she is`) ve `16079238` (`who's → who is`).
   - `I'd`, `she's`, `who's`, `there's`, `what's`, `she'd` için yalnız tam biçimden kısa biçime
     soru üretiliyor; kısa biçimden tek bir genişletme sorulmuyor.

3. **`rhyme-synonym` yardım metni yanlış eşanlam öğretiyordu.**
   - Tekrar: `7-8 / seed 9055460`, `STOP`, `salt → halt`.
   - `food`, `cold`, `yell` başka ipuçlarının cevaplarıydı ama “right meaning, no rhyme” diye
     etiketleniyordu. Bunlar artık `unrelated`; `means-only` etiketi bu yolda kullanılmıyor.

4. **Bağlamsız WordNet ilişkileri çıplak eş/zıt anlam çifti olarak kullanılıyordu.**
   - Tekrar: `phone/sound` (`25007994`), `home/plate` (`25023832`), `have/throw`
     (`25031751`); 7-8 synonym'de `get/fix`, `work/bring`.
   - Sonraki bant taramasında `vacuum/vacancy`, `have/sustain`, `safe/out`, `planar/cubic` ve
     `aunt/uncle` da doğrulandı. Yaş büyümesi bağlam eksikliğini çözmediği için bütün bantların
     `synonym`, `antonym` ve `pair-meaning` doğru cevapları artık elle gözden geçirilmiş
     `PAIR_SYNONYMS` / `PAIR_ANTONYMS` tablolarından geliyor. İleri bantlar tabloda daha seyrek
     kelimelerin eşik üstüne çıkmasıyla 117–140 ayrı synonym ve 118–129 ayrı antonym sorusuna
     ulaşıyor; 7-8 de 68 / 92 ayrı soruda kalıyor.
   - `odd-synonym` taramasında aynı kök neden `dough/lettuce/bread/cabbage` (para argosu),
     `fink/canary/sneaker/snitch` ve `gain/make/reach/hit` kümelerini üretti. Dört aynı-anlamlı
     kelime artık yalnız `SYNONYM_GROUPS` içinden geliyor; motor yalnız unrelated odd seçeneği
     üretiyor.
   - `word-grid` de `safe → out/dangerous`, `sit → pose/ride`, `beginning → middle/end`
     üretiyordu. İki synonym cevabı `SYNONYM_GROUPS` içinden, iki opposite cevabı aynı anlamı
     koruyan `GRID_OPPOSITES` tablosundan geliyor; `light → dark/heavy` gibi iki farklı anlamı
     karıştıran satırlar tabloya alınmadı.
   - `letter-pair` harf maskelemesini doğru yapıyor ama ilişkiyi aynı ham kaynaktan aldığı için
     `girl → daughter` eşanlam, `hungry ↔ thirsty` ve `son ↔ daughter` zıt anlam diyordu. Bu tip
     de `PAIR_SYNONYMS` / `PAIR_ANTONYMS` çiftlerinden besleniyor; validator artık tamamlanan
     kelimenin onaylı anlam çifti olduğunu ayrıca doğruluyor.

5. **`odd-two` kategorileri insan gözüyle çakışıyordu.**
   - Tekrar: `20047347` (`external body part` / `body part`), `20071331`
     (`container` / `vessel`), `19418973` (`herb` içinde banana/pineapple).
   - Çakışan kategori çiftleri birlikte seçilmiyor; botanik `herb` kategorisi bu tipten çıkarıldı.

6. **`sense` örneklerinde yanlış/uygunsuz cümle-cevap çiftleri vardı.**
   - `129`: baseball club cümlesi → `nine`
   - `558`: “father children but don't recognize them” → `mother`
   - `934`: “screen the job applicants” → `sieve`
   - `136`: Clinton/Republican Party cümlesi → `blast`
   - `37`: “load the truck” → `laden`
   - UI seed `17039646`: “my throat feels bad” → `tough`
   - UI seed `17134674`: “change of heart” → `spirit`
   - İlk kara liste düzeltmesinden sonraki editoryal taramada yeni örnekler çıktı: “hit the MAC
     machine → attain/gain”, “matters came to a head → pass”, “soft tapping → easy”. Kök neden
     tekil kayıtlar değil, synset üyeliğinin cümle içinde birebir ikame sanılmasıydı.
   - `sense` artık yalnız `SENSE_ANSWERS` içindeki elle okunmuş cümle–cevap ikamelerini
     üretiyor. WordNet diğer anlamlardan çeldirici bulmak için kullanılmaya devam ediyor.
     Havuz UK/US audit'inde banda göre 77–82 ayrı soru ve %49–62 üretim verimi sağlıyor.
     Uygunsuz konu kalıpları runtime'da ayrıca engelli; bu seed'ler
     `scripts/english-audit.mjs` içinde regresyon olarak kilitli.

7. **Generated definition kaydında lemma/tanım uyuşmazlıkları ve uygunsuz gloss'lar vardı.**
   - Kör örnekler: `despite` için *spite* tanımı (“lack of respect…”), `centre` için Fransa'daki
     bir bölge, `few` için “small elite group”, `swept/written/united` için yalın fiil tanımı.
     `psycho`, `bipolar` ve “boyfriend = lover of a girl…” gloss'ları da çocuk bankasına uygun
     değil.
   - Doğrulanmış kayıtlar `BAD_DEFINITION_WORDS` ile generator ve validator'da kapatıldı.
     Bu engel yalnız definition tipini etkiliyor; örneğin normal `centre` kelimesini diğer
     mekanik tiplerden gereksiz yere silmiyor.

## Bilerek açık bırakılan risk

`sense` cevapları artık editoryal allowlist'te, fakat çeldiriciler hâlâ WordNet'in uzak
anlamlarından geliyor. Validator ikinci doğru cevabı sözlük ilişkileriyle eliyor; buna rağmen
yardım metinlerinin ve her çeldiricinin yaşa uygunluğunu yalnız kör okuma doğrulayabilir.
Allowlist genişletilirken her yeni cümle–cevap ikamesi yüksek sesle okunmalı; synset'te bulunması
tek başına kabul ölçütü değil.

9-10 çoğul havuzunda `methodology`, `tertiary`, `substantive` gibi yaş için sert kelimeler de
görüldü. 9-10 ve 10-11 çoğul/singular havuzları artık elle tanımlı tanıdık kelime kümesiyle
sınırlı; 11-12'nin kitabında Latin/Greek plurals bulunduğu için ileri havuz orada korunuyor.

8. **Çoğul tablosu alternatif ve anlam değiştiren biçimleri tek doğru sayıyordu.**
   - `8-9 / plural / 21843`: `penny → pence` (`pennies` de doğru bağlama sahip).
   - `8-9 / plural / 21028`: `fish → fishes` (`fish` de standart çoğul).
   - Kör taramada ayrıca `index → indexes`, `staff → staffs`, `money → moneys`,
     `info → infos`, `beef → beefs` gibi bağlama/sense'e bağlı biçimler görüldü.
   - Doğrulanmış belirsiz tabanlar plural ve singular yollarından kapatıldı; 9-10 ve 10-11
     kural soruları tanıdık kelimelerle sınırlandı. Validator aynı engeli metadata'dan bağımsız
     olarak tekrar denetliyor.

9. **Basit geçmiş zaman tablosunda participle/modal cevapları vardı.**
   - `9-10 / past-tense / 19235`: `beat → beaten`; basit geçmiş `beat` olmalı.
   - `9-10 / past-tense / 5543`: `may → might`; bu, mekanik bir past-tense dönüşümü değil.
   - İki kayıt generator ve validator'da kapatıldı.

10. **Suffix tablosunda yazım benzerliği ilişki sanılıyordu.**
    - `9-10 / suffix / 60474`: `tense + or → tensor`.
    - Bu çift okul düzeyinde geçerli bir kök+ek türetimi olmadığı için kapatıldı.

11. **Kaynak blocklist'in çekimli biçimi runtime lexicon'da kalmıştı.**
    - `11-12 / missing-vowel / 11900`: `impr_soned → imprisoned`.
    - `imprison` ve `imprisonment` engelliydi, fakat çekimli `imprisoned` ayrı kayıt olarak
      sızıyordu. Kaynak blocklist'e ve yeniden build beklemeyen runtime engeline eklendi.

12. **Comparative sıfatları rastgele bağlamlarla anlamsız cümleler kuruyordu.**
    - `10-11 / comparative / 1`: `young` için “Today is younger than yesterday.”
    - Aynı yol `strong` için “My story is stronger than yours.” gibi dilbilgisel biçimi doğru
      olsa da çocuk sorusu olarak doğal olmayan eşleşmeler üretiyordu.
    - Comparative ve superlative artık her sıfatla çalışan nötr iki cümle kalıbı kullanıyor;
      validator kalıbı ayrıca doğruluyor.

13. **Bare prefix sorusunda aynı kökün iki cevabı vardı.**
    - `10-11 / prefix-antonym / 7810`: `like → dislike`.
    - `10-11 / prefix-antonym / 14112`: `like → unlike`.
    - Cümlesiz `like` fiil/sıfat anlamını ayırmadığı için hangi prefix'in istendiği bilinemez.
      Lexicon'da birden fazla farklı prefixed biçimi olan tabanlar generator'dan çıkarıldı ve
      validator'da aynı kural kilitlendi.

## Regresyon özeti

- `npm run english:check`: geçti; iki variety, beş bant, her tipte 300 soru; kısa oturum ve
  oturum içi tekrar yok.
- `npx vite build`: geçti; yalnız mevcut büyük chunk uyarısı var.
- `git diff --check`: geçti.

# Hareketli ikonlar (Lottie)

Ana sayfadaki görev kartlarının ikonları: `lottie/math.json`, `lottie/book.json`, `lottie/puzzle.json`.
Tasarım referansı Design tuvalinde, v3 sayfası → "Hareketli ikonlar (dokun)".

Her dosya **320×240, 30 fps, saydam arka plan** (rengi kart verir), 8–10 KB. İki işaret (marker) taşır:

| Marker | Kareler | Ne zaman |
|---|---|---|
| `idle` | 0–90 | Görev "sıradaki" iken döngüde oynar. Başı ve sonu aynı kare, dikiş yok. |
| `done` | 90–120 | Görev bitince **bir kez** oynar, tik işaretiyle durur. |

Dosyalar el ile düzenlenmez; `build.py` üretir (bağımlılık yok):

```
python3 design/native-icons/build.py
```

Önizleme: `preview.html`'i bir statik sunucuyla aç (`npx serve design/native-icons`); dosyayı çift tıklayarak açınca tarayıcı JSON'u yüklemez.

## Kurallar

- Ekranda aynı anda yalnız **sıradaki** görevin ikonu `idle` oynar; diğerleri 0. karede durur. Bitmiş görev `done`'ın son karesinde (120) durur.
- **Hareketi Azalt** açıksa hiçbir şey oynamaz: bekleyen ikon 0. karede, biten 120. karede durur.
- Dokununca ikon değil kart tepki verir (basılma + hafif titreşim); ikon yalnız hâl değişince oynar.

## iOS (lottie-ios 4.x, SwiftUI)

```swift
import Lottie

struct TaskIcon: View {
    let file: String          // "math" | "book" | "puzzle"
    let isNext: Bool
    let isDone: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        LottieView(animation: .named(file))
            .playbackMode(mode)
            .aspectRatio(4/3, contentMode: .fit)
    }

    private var mode: LottiePlaybackMode {
        if isDone { return reduceMotion ? .paused(at: .frame(120)) : .playing(.marker("done", loopMode: .playOnce)) }
        if isNext && !reduceMotion { return .playing(.marker("idle", loopMode: .loop)) }
        return .paused(at: .frame(0))
    }
}
```

## Android (lottie-compose 6.x)

JSON'ları `src/main/assets/lottie/` altına koy.

```kotlin
@Composable
fun TaskIcon(file: String, isNext: Boolean, isDone: Boolean, reduceMotion: Boolean) {
    val composition by rememberLottieComposition(LottieCompositionSpec.Asset("lottie/$file.json"))
    val play = !reduceMotion && (isDone || isNext)
    val progress by animateLottieCompositionAsState(
        composition,
        clipSpec = LottieClipSpec.Markers(if (isDone) "done" else "idle"),
        iterations = if (isDone) 1 else LottieConstants.IterateForever,
        isPlaying = play,
    )
    LottieAnimation(composition, progress = { if (play) progress else if (isDone) 1f else 0f },
        modifier = Modifier.aspectRatio(4f / 3f))
}
```

`reduceMotion`: `Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f`.

> API adları lottie-ios 4.4 ve lottie-compose 6.4'e göre yazıldı; farklı sürümde bir ad değişmişse işaret (marker) ve kare numaraları aynı kalır.

## Sınırlar

- Rive (`.riv`) değil. Lottie'de durum makinesi yok; hâl geçişini (idle → done) kod yapıyor.
- Matematik bloklarında rakam yerine nokta var: Lottie'de yazı için font gömmek gerekir, noktalar dilden bağımsız.
- Yalnız bu üç ikon var. Diğer kartlar (Hikâyeler, Çizimler, Ödevler, Ağacım) aynı `build.py` kalıbıyla eklenir.

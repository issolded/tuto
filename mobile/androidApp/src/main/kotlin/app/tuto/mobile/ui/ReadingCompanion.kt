package app.tuto.mobile.ui

import android.graphics.ImageDecoder
import android.graphics.drawable.AnimatedImageDrawable
import android.os.Build
import android.widget.ImageView
import androidx.annotation.RequiresApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.tuto.mobile.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Original reading performance with an offline alpha matte; no opaque video surface. */
@Composable internal fun ReadingCompanion(modifier: Modifier = Modifier, animate: Boolean = true) {
    val motion = !reduceMotion() && animate
    Box(modifier) {
        if (Build.VERSION.SDK_INT >= 28 && motion) AnimatedReadingCompanion(Modifier.fillMaxSize())
        else Image(painterResource(R.drawable.fox_reading_room_still), null, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
    }
}

@RequiresApi(28)
@Composable private fun AnimatedReadingCompanion(modifier: Modifier) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    var foreground by remember { mutableStateOf(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    val drawable by produceState<AnimatedImageDrawable?>(null, context) {
        value = withContext(Dispatchers.IO) {
            runCatching { ImageDecoder.decodeDrawable(ImageDecoder.createSource(context.resources, R.raw.fox_reading_room)) as? AnimatedImageDrawable }.getOrNull()
        }
    }
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, _ -> foreground = owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    if (drawable == null) Image(painterResource(R.drawable.fox_reading_room_still), null, modifier, contentScale=ContentScale.Fit)
    drawable?.let { clip ->
        DisposableEffect(clip, foreground) {
            if (foreground) clip.start() else clip.stop()
            onDispose { clip.stop() }
        }
        AndroidView(modifier = modifier, factory = { ctx ->
            ImageView(ctx).apply {
                scaleType = ImageView.ScaleType.FIT_CENTER
                importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO
                setImageDrawable(clip)
            }
        }, update = { if (it.drawable !== clip) it.setImageDrawable(clip) })
    }
}

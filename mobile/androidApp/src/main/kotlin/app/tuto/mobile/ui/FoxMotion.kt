package app.tuto.mobile.ui

import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.view.Surface
import android.view.TextureView
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.tuto.mobile.R

enum class FoxPose(val clip: Int, val poster: Int) {
    Welcome(R.raw.fox_welcome, R.drawable.fox_welcome),
    Thinking(R.raw.fox_thinking, R.drawable.fox_thinking),
    Hint(R.raw.fox_hint, R.drawable.fox_hint),
    Success(R.raw.fox_success, R.drawable.fox_success),
    Reading(R.raw.fox_reading, R.drawable.fox_reading)
}

/** Bundled, silent clips play once per event. No streaming, audio focus or endless idle loop. */
@Composable
fun Fox(modifier: Modifier = Modifier, pose: FoxPose = FoxPose.Welcome, event: Any = pose, animate: Boolean = true) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val still = reduceMotion() || !animate
    var foreground by remember { mutableStateOf(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, _ -> foreground = owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
      val side = minOf(maxWidth, maxHeight)
      Box(Modifier.size(side).clip(RoundedCornerShape(20.dp))) {
        Image(painterResource(pose.poster), null, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
        if (!still && foreground) key(pose, event) {
            var player by remember { mutableStateOf<MediaPlayer?>(null) }
            var surface by remember { mutableStateOf<Surface?>(null) }
            DisposableEffect(Unit) { onDispose { player?.release(); player = null; surface?.release(); surface = null } }
            AndroidView(modifier = Modifier.fillMaxSize(), factory = { ctx ->
                TextureView(ctx).apply {
                    isOpaque = false
                    importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO
                    surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                        override fun onSurfaceTextureAvailable(texture: SurfaceTexture, width: Int, height: Int) {
                            surface = Surface(texture)
                            player = MediaPlayer().apply {
                                context.resources.openRawResourceFd(pose.clip).use { setDataSource(it.fileDescriptor, it.startOffset, it.length) }
                                setSurface(surface); setVolume(0f, 0f); isLooping = false
                                setOnPreparedListener { it.start() }
                                setOnErrorListener { _, _, _ -> alpha = 0f; true }
                                prepareAsync()
                            }
                        }
                        override fun onSurfaceTextureSizeChanged(t: SurfaceTexture, w: Int, h: Int) {}
                        override fun onSurfaceTextureUpdated(t: SurfaceTexture) {}
                        override fun onSurfaceTextureDestroyed(t: SurfaceTexture): Boolean {
                            player?.release(); player = null; surface?.release(); surface = null
                            return true
                        }
                    }
                }
            })
        }
    }
    }
}

package app.tuto.mobile.ui

import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieClipSpec
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.LottieConstants
import com.airbnb.lottie.compose.animateLottieCompositionAsState
import com.airbnb.lottie.compose.rememberLottieComposition

/** Animations off in system settings (developer "animator duration scale" 0, or accessibility). */
@Composable
fun reduceMotion(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember { Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
}

/** Compatibility entry point for the approved Paper & Play mascot. */
@Composable
fun Tuto(modifier: Modifier = Modifier, cheerKey: Int = 0) {
    Fox(modifier, if (cheerKey > 0) FoxPose.Success else FoxPose.Welcome, event = cheerKey)

}

enum class IconState { Idle, Next, Done }

/**
 * A task card's animated icon (lottie/math|book|puzzle.json): 0-90 idle loop, 90-120 done.
 * Only the task that is next moves; the rest wait on frame 0, and a finished one rests on its tick.
 */
@Composable
fun TaskIcon(file: String, state: IconState, modifier: Modifier = Modifier) {
    val still = reduceMotion()
    val composition by rememberLottieComposition(LottieCompositionSpec.Asset("lottie/$file.json"))
    val playing = !still && state != IconState.Idle
    val anim = animateLottieCompositionAsState(
        composition,
        isPlaying = playing,
        clipSpec = if (state == IconState.Done) LottieClipSpec.Frame(90, 120) else LottieClipSpec.Frame(0, 90),
        iterations = 1,
        restartOnPlay = true,
    )
    val rest = when (state) { IconState.Done -> 1f; else -> 0f }
    LottieAnimation(composition, progress = { if (playing) anim.progress else rest }, modifier = modifier)
}

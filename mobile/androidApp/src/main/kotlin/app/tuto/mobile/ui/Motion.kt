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

/**
 * Tuto, the fox. lottie/fox.json (design/native-icons/fox.py): frames 0-120 are the idle loop,
 * 120-168 the cheer. Bump [cheerKey] to cheer once; it ends on the idle pose and loops idle again.
 */
@Composable
fun Tuto(modifier: Modifier = Modifier, cheerKey: Int = 0) {
    val still = reduceMotion()
    val composition by rememberLottieComposition(LottieCompositionSpec.Asset("lottie/fox.json"))
    var cheering by remember { mutableStateOf(false) }
    LaunchedEffect(cheerKey) { if (cheerKey > 0 && !still) cheering = true }
    val state = animateLottieCompositionAsState(
        composition,
        isPlaying = !still,
        clipSpec = if (cheering) LottieClipSpec.Frame(120, 168) else LottieClipSpec.Frame(0, 120),
        iterations = if (cheering) 1 else LottieConstants.IterateForever,
        restartOnPlay = true,
    )
    LaunchedEffect(state.isAtEnd, cheering) { if (cheering && state.isAtEnd) cheering = false }
    LottieAnimation(composition, progress = { if (still) 0f else state.progress }, modifier = modifier)
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
        iterations = if (state == IconState.Next) LottieConstants.IterateForever else 1,
        restartOnPlay = true,
    )
    val rest = when (state) { IconState.Done -> 1f; else -> 0f }
    LottieAnimation(composition, progress = { if (playing) anim.progress else rest }, modifier = modifier)
}

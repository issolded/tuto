package app.tuto.mobile.ui

import android.speech.tts.TextToSpeech
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

val Card = RoundedCornerShape(22.dp)

fun Modifier.card(color: Color = Color.White, shape: RoundedCornerShape = Card, elevation: Dp = 2.dp) =
    this.shadow(elevation, shape, ambientColor = Ink.main.copy(alpha = .12f), spotColor = Ink.main.copy(alpha = .12f))
        .clip(shape).background(color)

/** The one orange action on a screen. Dark text on the accent, as in the design. */
@Composable
fun BigButton(text: String, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.primary, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier
            .height(64.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(if (enabled) color else color.copy(alpha = .45f))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 24.dp),
        contentAlignment = Alignment.Center,
    ) { Text(text, fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 21.sp, color = if (color == MaterialTheme.colorScheme.primary) Color.White else Ink.main) }
}

@Composable
fun SoftButton(text: String, modifier: Modifier = Modifier, color: Color = Ink.lilacSoft, onClick: () -> Unit) {
    Box(
        modifier.height(64.dp).clip(RoundedCornerShape(22.dp)).background(color)
            .clickable(role = Role.Button, onClick = onClick).padding(horizontal = 22.dp),
        contentAlignment = Alignment.Center,
    ) { Text(text, fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = Ink.main) }
}

@Composable
fun CircleButton(label: String, modifier: Modifier = Modifier, color: Color = Color.White, onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        modifier.size(56.dp).clip(CircleShape).background(color)
            .clickable(role = Role.Button, onClick = onClick).semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) { content() }
}

@Composable
fun GemPill(gems: Int?, modifier: Modifier = Modifier) {
    Row(
        modifier.height(52.dp).clip(RoundedCornerShape(999.dp)).background(Ink.main).padding(start = 14.dp, end = 18.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        GemIcon(Modifier.size(20.dp), stroke = Color.White)
        Text(gems?.toString() ?: "…", fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 21.sp, color = Color.White)
    }
}

@Composable
fun GemIcon(modifier: Modifier, stroke: Color = Ink.main) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        val p = Path().apply { moveTo(w * .2f, h * .06f); lineTo(w * .8f, h * .06f); lineTo(w * .96f, h * .34f); lineTo(w * .5f, h * .96f); lineTo(w * .04f, h * .34f); close() }
        drawPath(p, Ink.jar)
        drawPath(p, stroke, style = Stroke(width = w * .08f, join = StrokeJoin.Round))
    }
}

@Composable
fun FlameIcon(modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        val p = Path().apply {
            moveTo(w * .5f, h * .05f)
            cubicTo(w * .56f, h * .3f, w * .88f, h * .4f, w * .86f, h * .64f)
            cubicTo(w * .84f, h * .98f, w * .16f, h * .98f, w * .14f, h * .64f)
            cubicTo(w * .13f, h * .46f, w * .26f, h * .4f, w * .28f, h * .24f)
            cubicTo(w * .4f, h * .32f, w * .46f, h * .44f, w * .46f, h * .52f)
            cubicTo(w * .52f, h * .4f, w * .52f, h * .2f, w * .5f, h * .05f)
            close()
        }
        drawPath(p, Color(0xFFFF7A2F))
        drawPath(p, Ink.main, style = Stroke(width = w * .09f, join = StrokeJoin.Round))
    }
}

@Composable
fun SpeakerIcon(modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        val body = Path().apply { moveTo(w * .08f, h * .36f); lineTo(w * .28f, h * .36f); lineTo(w * .52f, h * .14f); lineTo(w * .52f, h * .86f); lineTo(w * .28f, h * .64f); lineTo(w * .08f, h * .64f); close() }
        drawPath(body, Ink.main)
        drawArc(Ink.main, -50f, 100f, false, topLeft = Offset(w * .44f, h * .28f), size = androidx.compose.ui.geometry.Size(w * .3f, h * .44f), style = Stroke(w * .09f, cap = StrokeCap.Round))
        drawArc(Ink.main, -55f, 110f, false, topLeft = Offset(w * .44f, h * .1f), size = androidx.compose.ui.geometry.Size(w * .5f, h * .8f), style = Stroke(w * .09f, cap = StrokeCap.Round))
    }
}

@Composable
fun CheckIcon(modifier: Modifier, color: Color = Color.White) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        val p = Path().apply { moveTo(w * .12f, h * .52f); lineTo(w * .4f, h * .8f); lineTo(w * .9f, h * .2f) }
        drawPath(p, color, style = Stroke(w * .16f, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable
fun CloseIcon(modifier: Modifier) {
    Canvas(modifier) {
        val s = Stroke(size.width * .16f, cap = StrokeCap.Round)
        drawLine(Ink.main, Offset(size.width * .18f, size.height * .18f), Offset(size.width * .82f, size.height * .82f), s.width, StrokeCap.Round)
        drawLine(Ink.main, Offset(size.width * .82f, size.height * .18f), Offset(size.width * .18f, size.height * .82f), s.width, StrokeCap.Round)
    }
}

/**
 * The Listen buttons. Reading is still being learned at this age, so every sentence the child has
 * to understand can be read out, in the child's own language.
 */
class Speaker(context: android.content.Context) {
    private var ready = false
    private var pending: Pair<String, String>? = null
    private val tts = TextToSpeech(context.applicationContext) { status ->
        ready = status == TextToSpeech.SUCCESS
        pending?.let { (t, l) -> speak(t, l) }
        pending = null
    }

    fun speak(text: String, lang: String) {
        if (!ready) { pending = text to lang; return }
        tts.setLanguage(when (lang) { "tr" -> Locale("tr", "TR"); "es" -> Locale("es", "ES"); else -> Locale.UK })
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "tuto")
    }

    fun close() { tts.stop(); tts.shutdown() }
}

@Composable
fun rememberSpeaker(): Speaker {
    val context = LocalContext.current
    val speaker = remember { Speaker(context) }
    DisposableEffect(Unit) { onDispose { speaker.close() } }
    return speaker
}

@Composable
fun ListenButton(text: String, lang: String, speaker: Speaker, label: String, color: Color) {
    CircleButton(label, color = color, onClick = { speaker.speak(text, lang) }) { SpeakerIcon(Modifier.size(26.dp)) }
}

@Composable
fun CenteredMessage(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.bodyLarge, color = Ink.soft)
    }
}

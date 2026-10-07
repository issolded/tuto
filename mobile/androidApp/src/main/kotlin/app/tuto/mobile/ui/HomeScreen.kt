package app.tuto.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.*
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.Child
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.data.Strings
import app.tuto.mobile.data.Today
import java.util.Calendar

@Composable
fun HomeScreen(vm: TutoViewModel) {
    val s = LocalStrings.current
    val child = vm.child ?: return
    val today = vm.today
    LaunchedEffect(child.id) { vm.refreshToday() }
    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        val scale = LocalDensity.current.fontScale.coerceAtLeast(1f)
        val cols = if (maxWidth / scale >= 640.dp) 3 else 1
        Column(Modifier.widthIn(max = 1280.dp).fillMaxSize().verticalScroll(rememberScrollState()).padding(if (maxWidth < 600.dp) 18.dp else 20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Fox(Modifier.size(if (cols == 3) 180.dp else 104.dp), event = child.id)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(s.say("Hello, ${child.name}!", "Merhaba, ${child.name}!", "¡Hola, ${child.name}!"), style = MaterialTheme.typography.headlineMedium)
                    Text(s.say("What will you discover today?", "Bugün ne keşfedeceksin?", "¿Qué descubrirás hoy?"), color = Ink.soft)
                    GemPill(if (vm.todayLoaded) today.gems else null, Modifier.clickable { vm.open("gems") })
                }
            }
            val goal = today.nearestGoal
            Row(Modifier.fillMaxWidth().card(Ink.lilacSoft).clickable(role = Role.Button) { vm.open("goals") }.testTag("home-goal").padding(18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                PaperIcon("goals", Modifier.size(56.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(s.say("YOUR NEXT GOAL", "SIRADAKİ HEDEFİN", "TU PRÓXIMA META"), style = MaterialTheme.typography.labelLarge, color = Ink.soft)
                    if (vm.todayLoaded && goal != null) {
                        Text(goal.name, style = MaterialTheme.typography.titleLarge)
                        val left = (goal.cost - today.gems).coerceAtLeast(0)
                        Text(if (left > 0) s.say("$left Gems to go", "$left Gem kaldı", "Faltan $left gems") else s.say("Ready to claim!", "Ödülünü isteyebilirsin!", "¡Ya puedes pedirlo!"), color = Ink.green)
                        androidx.compose.material3.LinearProgressIndicator(progress = { if(goal.cost > 0) (today.gems.toFloat()/goal.cost).coerceIn(0f,1f) else 1f }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(CircleShape))
                    } else Text(if (!vm.todayLoaded) s.say("Loading your goal…", "Hedefin yükleniyor…", "Cargando tu meta…") else s.say("Choose something to work towards", "Ulaşmak istediğin bir hedef seç", "Elige tu próxima meta"), style = MaterialTheme.typography.titleMedium)
                }
                Text("›", style = MaterialTheme.typography.headlineMedium)
            }
            if (vm.todayError) Text(s.say("Couldn't refresh progress. Try again when you're connected.", "İlerleme yenilenemedi. Bağlanınca tekrar dene.", "No se pudo actualizar el progreso. Inténtalo al conectarte."), color = Ink.soft)
            val primary = listOf("math", "english", "puzzle").filter { child.active(it) }
            primary.chunked(cols).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    row.forEach { type ->
                        var launching by remember { mutableStateOf(false) }
                        val still = reduceMotion()
                        LaunchedEffect(launching) { if (launching) { if (!still) delay(420); vm.open(type) } }
                        Column(Modifier.weight(1f).card().clickable(enabled = !launching, role = Role.Button) { launching = true }.testTag("quest_$type").padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            AnimatedPaperIcon(type, launching, Modifier.size(if (cols == 3) 112.dp else 88.dp))
                            Text(s.say(when(type) { "math" -> "Math"; "english" -> "English"; else -> "Puzzles" }, s("task_$type"), s("task_$type")), style = MaterialTheme.typography.titleLarge)
                            Text(s.say(when(type) { "math" -> "Solve a challenge"; "english" -> "Play with words"; else -> "Find the pattern" }, "Keşfet ve öğren", "Explora y aprende"), color = Ink.soft, textAlign = TextAlign.Center)
                            BigButton(s.say("Start", "Başla", "Empezar"), Modifier.fillMaxWidth(), enabled = !launching) { launching = true }
                            if (today.done(type)) Text(s.say("Done today", "Bugün tamamlandı", "Hecho hoy"), color = Ink.green, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    repeat(cols-row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            Text(s.say("More to explore", "Keşfedecek daha çok şey var", "Más por descubrir"), style = MaterialTheme.typography.titleLarge)
            listOf("drawing", "homework", "tree").filter { child.active(it) }.chunked(cols).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    row.forEach { type ->
                        Row(Modifier.weight(1f).heightIn(min = 80.dp).card().clickable(role = Role.Button) { vm.open(type) }.testTag("quest_$type").padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            PaperIcon(type, Modifier.size(44.dp))
                            Text(s.say(when(type) { "drawing" -> "Drawing"; "homework" -> "Homework"; else -> "My Tree" }, s("task_$type"), s("task_$type")), modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                            Text("›", color = Ink.soft)
                        }
                    }
                    repeat(cols-row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

/** The Gem jar: fills as the Gems approach the nearest goal. */
@Composable
fun Jar(fill: Float, modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        drawRoundRect(Color(0xFFC9853E), topLeft = Offset(w * .25f, 0f), size = androidx.compose.ui.geometry.Size(w * .5f, h * .12f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(6f))
        val body = androidx.compose.ui.geometry.RoundRect(0f, h * .14f, w, h, androidx.compose.ui.geometry.CornerRadius(w * .22f))
        val clip = Path().apply { addRoundRect(body) }
        drawPath(clip, Color(0xFF3A2B52))
        val top = h * .14f + (h * .86f) * (1f - fill)
        clipPath(clip) { drawRect(Ink.jar, topLeft = Offset(0f, top), size = androidx.compose.ui.geometry.Size(w, h - top)) }
        drawPath(clip, Color.White, style = Stroke(width = 5f))
    }
}

/** Still drawings for the activities that have no animation yet. */
@Composable
fun ActivityGlyph(type: String, modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        val ink = Stroke(width = w * .06f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        when (type) {
            "writing" -> {
                val p = Path().apply { moveTo(w * .2f, h * .8f); lineTo(w * .28f, h * .58f); lineTo(w * .68f, h * .18f); lineTo(w * .82f, h * .32f); lineTo(w * .42f, h * .72f); close() }
                drawPath(p, Color.White); drawPath(p, Ink.main, style = ink)
                drawLine(Ink.main, Offset(w * .14f, h * .9f), Offset(w * .86f, h * .9f), ink.width, StrokeCap.Round)
            }
            "drawing" -> {
                drawCircle(Color.White, w * .4f, Offset(w * .5f, h * .5f)); drawCircle(Ink.main, w * .4f, Offset(w * .5f, h * .5f), style = ink)
                drawCircle(Color(0xFFFF5D8F), w * .07f, Offset(w * .34f, h * .42f)); drawCircle(TaskColor.math, w * .07f, Offset(w * .5f, h * .3f)); drawCircle(Ink.green, w * .07f, Offset(w * .66f, h * .38f))
            }
            "homework" -> {
                drawRoundRect(Color.White, topLeft = Offset(w * .2f, h * .14f), size = androidx.compose.ui.geometry.Size(w * .6f, h * .76f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(w * .08f))
                drawRoundRect(Ink.main, topLeft = Offset(w * .2f, h * .14f), size = androidx.compose.ui.geometry.Size(w * .6f, h * .76f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(w * .08f), style = ink)
                drawLine(Ink.main, Offset(w * .32f, h * .4f), Offset(w * .68f, h * .4f), ink.width, StrokeCap.Round)
                drawLine(Ink.main, Offset(w * .32f, h * .58f), Offset(w * .58f, h * .58f), ink.width, StrokeCap.Round)
            }
            else -> { // tree
                drawLine(Color(0xFF8A5A2B), Offset(w * .5f, h * .92f), Offset(w * .5f, h * .5f), w * .08f, StrokeCap.Round)
                drawCircle(Color.White, w * .24f, Offset(w * .5f, h * .34f)); drawCircle(Ink.main, w * .24f, Offset(w * .5f, h * .34f), style = ink)
                drawCircle(Color.White, w * .16f, Offset(w * .26f, h * .52f)); drawCircle(Ink.main, w * .16f, Offset(w * .26f, h * .52f), style = ink)
                drawCircle(Color.White, w * .16f, Offset(w * .74f, h * .52f)); drawCircle(Ink.main, w * .16f, Offset(w * .74f, h * .52f), style = ink)
            }
        }
    }
}

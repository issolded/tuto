package app.tuto.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.tuto.mobile.PuzzleRun
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.data.PuzzleQuestion
import app.tuto.mobile.data.Strings
import com.caverock.androidsvg.SVG

private val TEAL = Color(0xFF22C3A6)
private val OK = Color(0xFF3FBF7F)
private val BAD = Color(0xFFE2586A)
private val DIM = Color(0xFF8D83AD)
private val FIG: Dp = 96.dp

@Composable
fun PuzzleScreen(vm: TutoViewModel) {
    val run = vm.puzzle ?: return
    val s = LocalStrings.current
    LaunchedEffect(run) { if (run.session == null && run.phase == PuzzleRun.Phase.Loading) run.start() }
    when (run.phase) {
        PuzzleRun.Phase.Loading, PuzzleRun.Phase.Finishing -> Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterVertically)) {
            Tuto(Modifier.size(width = 220.dp, height = 280.dp))
            CircularProgressIndicator(color = TEAL)
            Text(s(if (run.phase == PuzzleRun.Phase.Loading) "puzzle_preparing" else "math_checking"), style = MaterialTheme.typography.titleLarge)
        }
        PuzzleRun.Phase.Failed -> Column(Modifier.fillMaxSize().padding(40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically)) {
            Tuto(Modifier.size(width = 220.dp, height = 280.dp))
            Text(s("puzzle_failed"), style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                SoftButton(s("nav_home")) { vm.home() }
                BigButton(s("puzzle_retry"), color = TEAL) { vm.openPuzzleAgain() }
            }
        }
        PuzzleRun.Phase.Welcome -> Row(Modifier.fillMaxSize().padding(48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(40.dp, Alignment.CenterHorizontally)) {
            Tuto(Modifier.size(width = 280.dp, height = 356.dp))
            Column(Modifier.widthIn(max = 540.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Text(s("puzzle_welcome"), style = MaterialTheme.typography.headlineMedium)
                val sess = run.session
                Text(
                    if (sess?.willPay == true) "${s("math_up_to_gems")} ${sess.gems} ${s("math_gems_word")}" else s("puzzle_no_gems"),
                    style = MaterialTheme.typography.labelLarge, color = if (sess?.willPay == true) Color.White else Ink.soft,
                    modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(if (sess?.willPay == true) TEAL else Color.White).padding(horizontal = 14.dp, vertical = 6.dp),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    SoftButton(s("nav_home")) { vm.home() }
                    BigButton(s("math_lets_go"), color = TEAL) { run.begin() }
                }
            }
        }
        PuzzleRun.Phase.Asking -> Asking(run, s) { vm.home() }
        PuzzleRun.Phase.Result -> {
            val r = run.result ?: return
            val key = when {
                r.total > 0 && r.correct == r.total -> "puzzle_enc_perfect"
                r.total > 0 && r.correct * 10 >= r.total * 8 -> "puzzle_enc_high"
                r.total > 0 && r.correct * 2 >= r.total -> "puzzle_enc_mid"
                else -> "puzzle_enc_low"
            }
            Row(Modifier.fillMaxSize().padding(40.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(40.dp)) {
                Tuto(Modifier.size(width = 300.dp, height = 380.dp), cheerKey = 1)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    Text(s(key), style = MaterialTheme.typography.headlineMedium)
                    Text(s.say("${r.correct} out of ${r.total} right", "${r.total} bulmacadan ${r.correct} tanesi doğru", "${r.correct} de ${r.total} correctas"), style = MaterialTheme.typography.headlineLarge)
                    when {
                        r.gemsEarned > 0 -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            GemIcon(Modifier.size(28.dp))
                            Text(s.say("+${r.gemsEarned} Gems", "+${r.gemsEarned} Gem", "+${r.gemsEarned} gems"), style = MaterialTheme.typography.headlineMedium)
                        }
                        r.capped -> Text(s("puzzle_no_gems"), style = MaterialTheme.typography.bodyLarge)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        SoftButton(s("nav_home")) { vm.home() }
                        BigButton(s.say("Play again", "Tekrar oyna", "Jugar otra vez"), color = TEAL) { vm.openPuzzleAgain() }
                    }
                }
            }
        }
    }
}

@Composable
private fun Asking(run: PuzzleRun, s: Strings, onClose: () -> Unit) {
    val q = run.question ?: return
    val drawn = run.drawings.getOrNull(run.index) ?: return
    val speaker = rememberSpeaker()
    val ans = run.answer
    Column(Modifier.fillMaxSize().padding(horizontal = 32.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            CircleButton(s.say("Close", "Kapat", "Cerrar"), onClick = onClose) { CloseIcon(Modifier.size(18.dp)) }
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(run.total) { i ->
                    Box(Modifier.weight(1f).height(14.dp).clip(RoundedCornerShape(999.dp)).background(if (i < run.index) OK else if (i == run.index) TEAL else Color(0xFFEFE4D2)))
                }
            }
            Text("${run.index + 1} / ${run.total}", fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
        }
        Column(Modifier.fillMaxWidth().weight(1f).card(shape = RoundedCornerShape(32.dp)).verticalScroll(rememberScrollState()).padding(28.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(s(q.stemKey), fontFamily = Baloo, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 33.sp, modifier = Modifier.weight(1f))
                ListenButton(s(q.stemKey), run.child.language, speaker, s.say("Listen", "Dinle", "Escuchar"), Color(0xFFD4F0EE))
            }
            Prompt(q, drawn.prompt)
            Options(run, q, drawn.options)
            ans?.let { a ->
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Tuto(Modifier.size(width = 100.dp, height = 127.dp), cheerKey = run.cheerKey)
                    Text(
                        if (a.correct) s.say("Yes! That's the one.", "Evet! İşte bu.", "¡Sí! Es esa.") else (a.why ?: s.say("Not this one. Look at the green one.", "Bu değil. Yeşil olana bak.", "Esa no. Mira la verde.")),
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.weight(1f).clip(RoundedCornerShape(20.dp)).background(if (a.correct) Ink.greenSoft else Ink.wrongSoft).padding(16.dp),
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            if (run.sendFailed) Text(s.say("Couldn't send. Try again.", "Gönderilemedi. Tekrar dene.", "No se ha enviado. Inténtalo otra vez."), color = BAD, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            else Spacer(Modifier.weight(1f))
            if (ans == null) BigButton(if (run.sending) "…" else s("puzzle_send"), Modifier.width(260.dp), color = TEAL, enabled = run.picked != null && !run.sending) { run.send() }
            else if (!ans.correct) BigButton(s.say("Next", "Sonraki", "Siguiente"), Modifier.width(260.dp), color = TEAL) { run.next() }
        }
    }
}

/** The question's figures, laid out as PuzzleView lays them out for each layout. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Prompt(q: PuzzleQuestion, svgs: List<String?>) {
    if (q.layout == "options-only") return
    val gap = Arrangement.spacedBy(10.dp)
    when (q.layout) {
        "code" -> FlowRow(horizontalArrangement = gap, verticalArrangement = gap) {
            svgs.forEachIndexed { i, svg ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    FigureBox(svg)
                    Text(q.promptLabels.getOrElse(i) { "" }, fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, color = DIM)
                }
            }
        }
        "overlay" -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = gap) {
            FigureBox(svgs.getOrNull(0)); Sign("+"); FigureBox(svgs.getOrNull(1)); Sign("="); Blank()
        }
        "grid2x2", "grid3x3" -> {
            val cols = if (q.layout == "grid3x3") 3 else 2
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                svgs.chunked(cols).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { row.forEach { if (it != null) FigureBox(it) else Blank() } } }
            }
        }
        "mirror" -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            FigureBox(svgs.getOrNull(0))
            Canvas(Modifier.width(4.dp).height(FIG + 12.dp)) {
                drawLine(DIM, Offset(size.width / 2, 0f), Offset(size.width / 2, size.height), size.width, pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 10f)))
            }
            Blank()
        }
        "analogy" -> FlowRow(horizontalArrangement = gap, verticalArrangement = gap, itemVerticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = gap) { FigureBox(svgs.getOrNull(0)); Sign("→"); FigureBox(svgs.getOrNull(1)) }
            Sign("::")
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = gap) { FigureBox(svgs.getOrNull(2)); Sign("→"); Blank() }
        }
        else -> FlowRow(horizontalArrangement = gap, verticalArrangement = gap, itemVerticalAlignment = Alignment.CenterVertically) {
            svgs.forEach { FigureBox(it) }
            // Every "what comes next" run ends in the blank (PuzzleView).
            if (q.layout == "row" && q.stemKey == "puzzle_stem_next") Blank()
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Options(run: PuzzleRun, q: PuzzleQuestion, svgs: List<String?>) {
    val ans = run.answer
    FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        q.options.forEachIndexed { i, o ->
            val border = when {
                ans != null && i == ans.correctIndex -> OK
                ans != null && !ans.correct && i == run.picked -> BAD
                run.picked == i -> TEAL
                else -> Color(0xFFDCD9EA)
            }
            Box(
                Modifier.clip(RoundedCornerShape(18.dp)).border(if (border == Color(0xFFDCD9EA)) 3.dp else 5.dp, border, RoundedCornerShape(18.dp))
                    .clickable(enabled = ans == null, role = Role.Button) { run.pick(i) }
                    .testTag("puzzle_option_$i")
                    .padding(6.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (o.code != null) Box(Modifier.size(FIG), contentAlignment = Alignment.Center) { Text(o.code, fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 34.sp) }
                else Svg(svgs.getOrNull(i), FIG)
            }
        }
    }
}

@Composable private fun Sign(t: String) = Text(t, fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 30.sp, color = DIM)

@Composable
private fun FigureBox(svg: String?) {
    Box(Modifier.clip(RoundedCornerShape(14.dp)).border(3.dp, Color(0xFFDCD9EA), RoundedCornerShape(14.dp)).padding(6.dp)) { Svg(svg, FIG) }
}

@Composable
private fun Blank() {
    Box(Modifier.size(FIG + 12.dp).clip(RoundedCornerShape(14.dp)).border(3.dp, DIM, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
        Text("?", fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 40.sp, color = DIM)
    }
}

/** A figure the web's own puzzle code drew, at a fixed size so every figure on a card matches. */
@Composable
private fun Svg(markup: String?, side: Dp) {
    val svg = remember(markup) { markup?.let { runCatching { SVG.getFromString(it).apply { setDocumentWidth("100%"); setDocumentHeight("100%") } }.getOrNull() } }
    Canvas(Modifier.size(side)) {
        val w = size.width.toInt(); val h = size.height.toInt()
        if (svg != null && w > 0 && h > 0) drawIntoCanvas { it.nativeCanvas.drawPicture(svg.renderToPicture(w, h)) }
    }
}

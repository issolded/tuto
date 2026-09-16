package app.tuto.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.lifecycle.viewmodel.compose.viewModel
import app.tuto.core.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { TutoApp() }
    }
}

data class Palette(val paper: Color, val ink: Color, val accent: Color, val action: Color, val pastel: Color)
private fun palette(theme: ThemeChoice) = if (theme == ThemeChoice.MORPH)
    Palette(Color(0xFFFFF8E9), Color(0xFF17134E), Color(0xFF5225CF), Color(0xFFE95350), Color(0xFFE7DAFF))
else Palette(Color(0xFFF5F0FF), Color(0xFF241F3A), Color(0xFF408DC5), Color(0xFFF79433), Color(0xFFD4EDFF))

@Composable fun TutoApp(vm: MobileState = viewModel()) {
    val p = palette(vm.theme)
    MaterialTheme(colorScheme = lightColorScheme(primary = p.accent, secondary = p.action, background = p.paper, surface = Color.White, onSurface = p.ink, onBackground = p.ink)) {
        BackHandler(vm.page != "home") { vm.leavePractice() }
        Surface(color = p.paper, modifier = Modifier.fillMaxSize()) {
            BoxWithConstraints(Modifier.safeDrawingPadding()) {
                val expanded = maxWidth >= 840.dp
                Row(Modifier.fillMaxSize()) {
                    if (expanded) Column(Modifier.width(180.dp).fillMaxHeight().background(p.pastel).padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                        Text("tuto", fontSize = 42.sp, fontWeight = FontWeight.Black, color = p.ink)
                        Text(if (vm.theme == ThemeChoice.MORPH) "/ Morph Studio" else "/ Classic", color = p.ink)
                        Spacer(Modifier.height(24.dp))
                        Navigation(vm, vertical = true)
                        Spacer(Modifier.weight(1f))
                        Mascot(vm.theme, Modifier.size(130.dp))
                        Text(vm.text("Küçük adımlar. Büyük fikirler.", "Small steps. Big ideas."), color = p.ink)
                    }
                    Column(Modifier.weight(1f).fillMaxHeight()) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            if (vm.page != "home") TextButton(onClick = { vm.leavePractice() }) { Text(vm.text("← Ana sayfa", "← Home")) }
                            else Text(if (expanded) vm.text("Bugün senin günün", "Make today yours") else "tuto", fontSize = 26.sp, fontWeight = FontWeight.Black)
                            Spacer(Modifier.weight(1f))
                            Surface(shape = RoundedCornerShape(24.dp), color = p.pastel, onClick = { vm.page = "gems" }) {
                                Text("◆ ${vm.wallet.balance}", Modifier.padding(horizontal = 20.dp, vertical = 10.dp), fontWeight = FontWeight.Bold)
                            }
                        }
                        Text(vm.text("ÖNİZLEME · Bu cihazdaki örnek çalışmalar ve Gem'ler", "PREVIEW · Practice and Gems on this device"), Modifier.padding(horizontal = 24.dp), fontSize = 12.sp, color = p.ink.copy(alpha = .65f))
                        Box(Modifier.weight(1f).fillMaxWidth()) {
                            Column(Modifier.align(Alignment.TopCenter).widthIn(max = 1160.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                when (vm.page) {
                                    "home" -> Home(vm, p, expanded)
                                    "quiz" -> Quiz(vm, p, expanded)
                                    "result" -> Result(vm, p)
                                    "gems" -> Gems(vm, p)
                                    "settings" -> Settings(vm, p)
                                    "screen" -> ScreenTime(vm)
                                }
                                Spacer(Modifier.height(16.dp))
                            }
                        }
                        if (!expanded) Row(Modifier.fillMaxWidth().background(Color.White).padding(6.dp), horizontalArrangement = Arrangement.SpaceEvenly) { Navigation(vm, false) }
                    }
                }
            }
        }
    }
}

@Composable private fun Navigation(vm: MobileState, vertical: Boolean) {
    listOf("home" to vm.text("⌂  Keşfet", "⌂  Discover"), "gems" to vm.text("◆  Gem'ler", "◆  Gems"), "screen" to vm.text("◷  Ekran", "◷  Screen"), "settings" to vm.text("✦  Stilim", "✦  My style")).forEach { (page, label) ->
        TextButton(onClick = { vm.page = page }, modifier = if (vertical) Modifier.fillMaxWidth() else Modifier) { Text(label, fontWeight = if (vm.page == page) FontWeight.Black else FontWeight.Medium, fontSize = 14.sp) }
    }
}

@Composable private fun Panel(color: Color = Color.White, content: @Composable ColumnScope.() -> Unit) {
    Surface(shape = RoundedCornerShape(28.dp), color = color, modifier = Modifier.fillMaxWidth(), tonalElevation = 0.dp) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
    }
}
@Composable private fun Action(label: String, color: Color, enabled: Boolean = true, action: () -> Unit) {
    Button(onClick = action, enabled = enabled, colors = ButtonDefaults.buttonColors(containerColor = color), shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) {
        Text(label, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable private fun Home(vm: MobileState, p: Palette, wide: Boolean) {
    val hero: @Composable () -> Unit = {
        Panel(p.pastel.copy(alpha = .6f)) {
            Text(vm.text("Bugünü keşfet,\n${vm.name}!", "Make today\nyours, ${vm.name}!"), fontSize = if (wide) 40.sp else 34.sp, fontWeight = FontWeight.Black, lineHeight = 44.sp)
            Text(vm.text("Şekiller, sayılar ve büyük fikirler.", "Shapes, numbers and big ideas."), fontSize = 17.sp)
            Mascot(vm.theme, Modifier.fillMaxWidth().height(if (wide) 250.dp else 190.dp))
            Text(vm.text("Öğren. Kazan. Birlikte planla.", "Learn. Earn. Plan together."), fontWeight = FontWeight.Bold)
        }
    }
    val activities: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(vm.text("Oyun alanını seç", "Choose your playground"), fontSize = 25.sp, fontWeight = FontWeight.Bold)
            Panel(Color(0xFFDDEDFC)) {
                Text(vm.text("123  Matematik", "123  Maths playground"), fontSize = 24.sp, fontWeight = FontWeight.Bold)
                Text(vm.text("20 içinde toplama ve çıkarma · 5 soru", "Addition and subtraction within 20 · 5 questions"))
                Action(vm.text("Hadi başlayalım →", "Let's explore →"), p.action) { vm.start(Subject.MATH) }
            }
            Panel(Color(0xFFFFEDB0)) {
                Text(vm.text("● ▲ ■  Örüntü oyunu", "● ▲ ■  Pattern play"), fontSize = 24.sp, fontWeight = FontWeight.Bold)
                Text(vm.text("Tekrar eden şekilleri keşfet · 5 soru", "Discover repeating shapes · 5 questions"))
                Action(vm.text("Şekilleri keşfet →", "Play with shapes →"), p.accent) { vm.start(Subject.PATTERNS) }
            }
            if (vm.session != null && vm.session?.finished == false) OutlinedButton(onClick = vm::resume, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Text(vm.text("Kaldığım yerden devam et", "Continue my practice")) }
        }
    }
    if (wide) Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        Box(Modifier.weight(1f)) { hero() }; Box(Modifier.weight(1f)) { activities() }
    } else { hero(); activities() }
    Panel {
        Text(vm.text("Bir sonraki küçük hedefin", "Your next little goal"), fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text(vm.text("20 Gem → aileyle planlanan 15 dakika oyun isteği", "20 Gems → request 15 minutes of play with your family"))
        LinearProgressIndicator(progress = { (vm.wallet.balance / 20f).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth(), color = p.accent)
    }
}

@Composable private fun Quiz(vm: MobileState, p: Palette, wide: Boolean) {
    val s = vm.session ?: return
    val q = if (vm.feedback != null) s.questions.getOrNull(s.attempts.size - 1) else s.current
    if (q == null) { Result(vm, p); return }
    Text(vm.text("${s.attempts.size.coerceAtMost(4)+1} / 5 · Küçük bir keşif", "${s.attempts.size.coerceAtMost(4)+1} / 5 · A little discovery"), color = p.accent, fontWeight = FontWeight.Bold)
    LinearProgressIndicator(progress = { s.attempts.size / 5f }, modifier = Modifier.fillMaxWidth(), color = p.accent)
    Panel {
        Text(q.prompt, fontSize = if (wide) 38.sp else 28.sp, fontWeight = FontWeight.Black)
        if (q.shapes.isNotEmpty()) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
            q.shapes.forEach { ShapeTile(it, Modifier.weight(1f).height(if (wide) 80.dp else 48.dp)) }
            Text("?", fontSize = 36.sp, fontWeight = FontWeight.Bold)
        } else Mascot(vm.theme, Modifier.fillMaxWidth().height(130.dp))
    }
    val chunks = q.choices.indices.toList().chunked(if (wide) 4 else 2)
    chunks.forEach { indices -> Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxWidth()) {
        indices.forEach { index ->
            val chosen = vm.selected == index
            Surface(onClick = { if (vm.feedback == null) vm.selected = index }, shape = RoundedCornerShape(22.dp), color = if (chosen) p.pastel else Color.White,
                border = BorderStroke(if (chosen) 3.dp else 1.dp, if (chosen) p.accent else p.ink.copy(alpha = .1f)), modifier = Modifier.weight(1f).heightIn(min = 104.dp)) {
                Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    if (q.shapes.isNotEmpty()) ShapeTile(index, Modifier.size(48.dp))
                    Text(q.choices[index], fontSize = if (q.shapes.isEmpty()) 30.sp else 17.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    } }
    if (vm.feedback != null) {
        Panel(if (vm.feedback == true) Color(0xFFD9F3E2) else Color(0xFFFFE7CC)) {
            Text(if (vm.feedback == true) vm.text("Harika, buldun!", "You found it!") else vm.text("Birlikte öğreniyoruz. Cevap: ${q.choices[q.answer]}", "We're learning together. Answer: ${q.choices[q.answer]}"), fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Action(vm.text("Devam →", "Continue →"), p.accent, action = vm::next)
        }
    } else {
        Action(vm.text("Kontrol et", "Check"), p.action, enabled = vm.selected != null, action = vm::check)
        OutlinedButton(onClick = { vm.helped = true }, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text(vm.text("Bir ipucu göster", "Show me a hint")) }
        if (vm.helped) Panel(p.pastel) { Text(q.hint, fontSize = 20.sp) }
    }
}

@Composable private fun Result(vm: MobileState, p: Palette) {
    val s = vm.session ?: return
    Panel(p.pastel) {
        Mascot(vm.theme, Modifier.fillMaxWidth().height(180.dp))
        Text(vm.text("Bir keşif daha tamam!", "Another discovery complete!"), fontSize = 32.sp, fontWeight = FontWeight.Black)
        Text("${s.correctCount} / ${s.questions.size}", fontSize = 48.sp, fontWeight = FontWeight.Black)
        Text(vm.text("${s.independentCount} soruyu yardımsız çözdün.", "You solved ${s.independentCount} questions independently."))
        Text(vm.text("Çalışmanı tamamladığın için +10 önizleme Gem'i", "+10 preview Gems for completing your practice"), fontWeight = FontWeight.Bold)
        Action(vm.text("Ana sayfaya dön", "Back to home"), p.accent) { vm.page = "home" }
    }
}
@Composable private fun Gems(vm: MobileState, p: Palette) {
    Text(vm.text("Emeklerin burada", "Your efforts, collected"), fontSize = 32.sp, fontWeight = FontWeight.Black)
    Panel(p.pastel) {
        Text("◆ ${vm.wallet.balance}", fontSize = 48.sp, fontWeight = FontWeight.Black)
        Text(vm.text("Bu önizlemedeki Gem'ler canlı hesabına aktarılmaz.", "Preview Gems are separate from your live account."))
        Action(vm.text("20 Gem ile 15 dakika iste", "Request 15 minutes for 20 Gems"), p.action, vm.wallet.balance >= 20) { vm.redeem() }
        Text(vm.text("Bu bir aile içi istektir; cihaz kilidini açmaz.", "This is a family request; it does not unlock the device."))
        vm.message?.let { Text(it, fontWeight = FontWeight.Bold) }
    }
    if (vm.wallet.entries.isEmpty()) Text(vm.text("İlk çalışmanla koleksiyonuna başla.", "Start your collection with your first practice."))
    vm.wallet.entries.reversed().forEach { entry ->
        Panel {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(when(entry.label) { "MATH" -> vm.text("Matematik", "Maths"); "PATTERNS" -> vm.text("Örüntüler", "Patterns"); else -> vm.text("Oyun süresi isteği", "Play-time request") })
                Text("${if (entry.gems > 0) "+" else ""}${entry.gems} ◆", fontWeight = FontWeight.Bold)
            }
        }
    }
}
@Composable private fun Settings(vm: MobileState, p: Palette) {
    Text(vm.text("Senin Tuto'n, senin stilin", "Your Tuto, your style"), fontSize = 30.sp, fontWeight = FontWeight.Black)
    ThemeChoice.entries.forEach { choice ->
        val sample = palette(choice)
        Surface(onClick = { vm.chooseTheme(choice) }, color = sample.paper, shape = RoundedCornerShape(24.dp), border = BorderStroke(if (vm.theme == choice) 3.dp else 1.dp, if (vm.theme == choice) p.accent else Color.LightGray)) {
            Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                Mascot(choice, Modifier.size(100.dp))
                Column(Modifier.weight(1f).padding(16.dp)) {
                    Text(if (choice == ThemeChoice.CLASSIC) vm.text("Klasik", "Classic") else "Morph Studio", fontWeight = FontWeight.Black, fontSize = 24.sp)
                    Text(if (choice == ThemeChoice.CLASSIC) vm.text("Pastel renkler, tanıdık Tuto", "Pastel colours, familiar Tuto") else vm.text("Krem, kobalt ve büyük fikirler", "Cream, cobalt and big ideas"))
                }
                RadioButton(selected = vm.theme == choice, onClick = { vm.chooseTheme(choice) })
            }
        }
    }
    Panel {
        OutlinedTextField(value = vm.name, onValueChange = vm::updateName, label = { Text(vm.text("Adın", "Your name")) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Türkçe", Modifier.weight(1f)); Switch(checked = vm.turkish, onCheckedChange = vm::setLanguage); Text(" / English")
        }
        Text(vm.text("Tema seçimin ilerlemeni değiştirmez. Tabletini çevirebilir veya bölünmüş ekranda kullanabilirsin.", "Changing your theme keeps your progress. Rotate your tablet or use split screen."))
    }
}

@Composable private fun ShapeTile(kind: Int, modifier: Modifier) {
    Canvas(modifier.semantics { contentDescription = listOf("Circle", "Triangle", "Square", "Pentagon")[kind % 4] }) {
        val side = size.minDimension * .75f; val origin = Offset((size.width-side)/2, (size.height-side)/2)
        when (kind % 4) {
            0 -> drawCircle(Color(0xFFEE5055), side/2, center)
            1 -> drawPath(Path().apply { moveTo(center.x, origin.y); lineTo(origin.x+side, origin.y+side); lineTo(origin.x, origin.y+side); close() }, Color(0xFF235DEB))
            2 -> drawRoundRect(Color(0xFFF8CF3E), origin, Size(side, side), androidx.compose.ui.geometry.CornerRadius(4f))
            else -> drawPath(Path().apply { for (i in 0..4) { val a = Math.toRadians((i*72-90).toDouble()); val x = center.x+(kotlin.math.cos(a)*side/2).toFloat(); val y = center.y+(kotlin.math.sin(a)*side/2).toFloat(); if(i==0) moveTo(x,y) else lineTo(x,y) }; close() }, Color(0xFF762ED4))
        }
    }
}

@Composable private fun Mascot(theme: ThemeChoice, modifier: Modifier) {
    Canvas(modifier.semantics { contentDescription = "Tuto" }) {
        val s = size.minDimension / 240f
        translate((size.width-240*s)/2, (size.height-240*s)/2) { scale(s, s, Offset.Zero) {
            drawOval(Color(0xFF17134E).copy(alpha = .1f), Offset(32f, 211f), Size(184f, 20f))
            drawRoundRect(Color(0xFFF4C94F), Offset(15f, 165f), Size(48f, 50f), androidx.compose.ui.geometry.CornerRadius(8f))
            drawRoundRect(Color(0xFFEF817B), Offset(177f, 169f), Size(43f, 44f), androidx.compose.ui.geometry.CornerRadius(8f))
            val blue = if(theme == ThemeChoice.MORPH) Color(0xFF225CE8) else Color(0xFF5AA9E6)
            drawLine(blue, Offset(166f, 82f), Offset(183f, 36f), 13f, StrokeCap.Round)
            drawCircle(blue, 19f, Offset(183f, 29f))
            drawOval(blue, Offset(38f, 45f), Size(59f, 31f))
            drawRoundRect(Brush.linearGradient(listOf(blue, Color(0xFF263BBC)), Offset(65f,70f), Offset(180f,200f)), Offset(61f, 67f), Size(121f, 130f), androidx.compose.ui.geometry.CornerRadius(if(theme==ThemeChoice.MORPH) 37f else 56f))
            drawOval(blue, Offset(63f, 181f), Size(46f, 35f)); drawOval(blue, Offset(132f,181f), Size(45f,35f))
            drawOval(Color.White, Offset(80f, 93f), Size(36f, 48f)); drawOval(Color.White, Offset(130f,93f), Size(36f,48f))
            drawOval(Color(0xFF151847), Offset(91f,106f), Size(18f,27f)); drawOval(Color(0xFF151847), Offset(140f,106f), Size(18f,27f))
            drawCircle(Color.White, 5f, Offset(101f,112f)); drawCircle(Color.White, 5f, Offset(150f,112f))
            drawArc(Color(0xFF141541), 0f, 180f, true, Offset(106f,144f), Size(32f,26f))
            drawOval(Color(0xFFF37686), Offset(115f,155f), Size(16f,10f))
            drawCircle(Color(0xFFF7CD3F), 14f, Offset(64f,170f)); drawCircle(Color(0xFFF7CD3F), 14f, Offset(183f,151f))
        } }
    }
}

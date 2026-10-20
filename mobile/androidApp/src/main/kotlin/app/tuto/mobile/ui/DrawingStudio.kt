package app.tuto.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.tuto.mobile.data.LocalStrings

/** Paper drawing lesson: the reference is the workspace, with controls always reachable. */
@Composable fun DrawingStudio(title: String, url: String, step: Int, count: Int, instruction: String, onBack: () -> Unit, onPrevious: () -> Unit, onNext: () -> Unit) {
    val s=LocalStrings.current
    var expanded by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment=Alignment.CenterVertically, horizontalArrangement=Arrangement.spacedBy(16.dp)) {
            TextButton(onClick=onBack) { Text(s.say("Back", "Geri", "Atrás")) }
            Text(title, style=MaterialTheme.typography.titleLarge, modifier=Modifier.weight(1f))
            Text("$step / $count", style=MaterialTheme.typography.titleLarge)
        }
        LinearProgressIndicator(progress={step.toFloat()/count.coerceAtLeast(1)}, modifier=Modifier.fillMaxWidth())
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val wide=maxWidth >= 840.dp
            val guide: @Composable () -> Unit = {
                Column(Modifier.verticalScroll(rememberScrollState()).padding(12.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
                    Text(s.say("One step at a time", "Adım adım ilerle", "Paso a paso"), style=MaterialTheme.typography.titleLarge)
                    Text(instruction, style=MaterialTheme.typography.bodyLarge)
                    Text(s.say("Follow along on your paper. Take your time.", "Kâğıdına çizerek takip et. Acele etme.", "Dibuja en tu papel. Tómate tu tiempo."),color=Ink.soft)
                    OutlinedButton(onClick={expanded=true}, modifier=Modifier.testTag("drawing-enlarge")) { Text(s.say("Enlarge drawing", "Çizimi büyüt", "Ampliar dibujo")) }
                }
            }
            if(wide) Row(Modifier.fillMaxSize(),horizontalArrangement=Arrangement.spacedBy(20.dp)) {
                Box(Modifier.weight(1f).fillMaxHeight().card().testTag("drawing-reference"),contentAlignment=Alignment.Center) { RemotePhoto(url,Modifier.fillMaxSize().padding(16.dp),maxHeight=2000.dp) }
                Box(Modifier.width(280.dp).fillMaxHeight()) { guide() }
            } else Column(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f).fillMaxWidth().card().testTag("drawing-reference"),contentAlignment=Alignment.Center) { RemotePhoto(url,Modifier.fillMaxSize().padding(12.dp),maxHeight=2000.dp) }
                Box(Modifier.heightIn(max=180.dp)) { guide() }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.spacedBy(16.dp)) {
            OutlinedButton(onClick=onPrevious,enabled=step>1, modifier=Modifier.weight(1f).height(60.dp)) { Text(s.say("Previous", "Önceki", "Anterior")) }
            BigButton(if(step<count) s.say("Next", "Sonraki", "Siguiente") else s.say("I've drawn it", "Çizdim", "Ya lo dibujé"),Modifier.weight(1f),onClick=onNext)
        }
    }
    if(expanded) PictureDialog({expanded=false}) { RemotePhoto(url,Modifier.fillMaxSize(),maxHeight=2000.dp) }
}

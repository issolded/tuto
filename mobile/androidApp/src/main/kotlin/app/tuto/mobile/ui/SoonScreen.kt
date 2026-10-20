package app.tuto.mobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.LocalStrings

/**
 * Activities the tablet does not do natively yet. Said plainly: a screen that looked finished but
 * saved nothing would be worse than a closed door, because the child's work would be lost.
 */
@Composable
fun SoonScreen(vm: TutoViewModel, type: String) {
    val s = LocalStrings.current
    val name = if (type in setOf("goals", "gems")) s("nav_gems") else s("task_$type")
    Row(Modifier.fillMaxSize().padding(48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(40.dp, Alignment.CenterHorizontally)) {
        Tuto(Modifier.size(width = 260.dp, height = 330.dp))
        Column(Modifier.widthIn(max = 520.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Text(name, style = MaterialTheme.typography.headlineLarge)
            Text(
                s.say("This one is coming to the tablet soon. Until then you can do it on Tuto in the browser.",
                    "Bu etkinlik tablete çok yakında geliyor. O zamana kadar tarayıcıdaki Tuto'da yapabilirsin.",
                    "Esta actividad llega pronto a la tableta. Mientras tanto puedes hacerla en Tuto desde el navegador."),
                style = MaterialTheme.typography.bodyLarge, color = Ink.soft, textAlign = TextAlign.Start,
            )
            BigButton(s("nav_home")) { vm.home() }
        }
    }
}

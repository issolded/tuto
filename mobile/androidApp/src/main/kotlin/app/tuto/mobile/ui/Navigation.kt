package app.tuto.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.tuto.mobile.Screen
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.LocalStrings
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun BottomNavigation(vm: TutoViewModel) {
    val s = LocalStrings.current
    NavigationBar(containerColor = MaterialTheme.colorScheme.surface, modifier = Modifier.testTag("bottom-navigation")) {
        NavigationBarItem(selected = vm.screen == Screen.Home, onClick = { vm.home() },
            icon = { NavigationIcon(false) }, label = { Text(s("nav_home")) }, modifier = Modifier.testTag("nav-home"))
        NavigationBarItem(selected = vm.screen == Screen.Goals, onClick = { vm.open("goals") },
            icon = { GemIcon(Modifier.size(28.dp)) }, label = { Text(s.say("Goals", "Hedefler", "Metas")) }, modifier = Modifier.testTag("nav-goals"))
        NavigationBarItem(selected = vm.screen == Screen.Settings, onClick = { vm.open("settings") },
            icon = { NavigationIcon(true) }, label = { Text(s.say("Settings", "Ayarlar", "Ajustes")) }, modifier = Modifier.testTag("nav-settings"))
    }
}

@Composable
private fun NavigationIcon(settings: Boolean) {
    Canvas(Modifier.size(28.dp)) {
        val w = size.width
        val stroke = Stroke(width = w * .075f, cap = StrokeCap.Round)
        if (settings) {
            drawCircle(Ink.main, w * .28f, style = stroke)
            drawCircle(Ink.main, w * .1f, style = stroke)
            repeat(8) { i ->
                val a = i * Math.PI / 4
                drawLine(Ink.main, center + Offset(cos(a).toFloat(), sin(a).toFloat()) * (w * .3f),
                    center + Offset(cos(a).toFloat(), sin(a).toFloat()) * (w * .43f), stroke.width, StrokeCap.Round)
            }
        } else {
            val p = Path().apply {
                moveTo(w*.08f, w*.43f); lineTo(w*.5f, w*.08f); lineTo(w*.92f, w*.43f)
                moveTo(w*.2f, w*.35f); lineTo(w*.2f,w*.9f); lineTo(w*.8f,w*.9f); lineTo(w*.8f,w*.35f)
                moveTo(w*.42f,w*.9f); lineTo(w*.42f,w*.6f); lineTo(w*.6f,w*.6f); lineTo(w*.6f,w*.9f)
            }
            drawPath(p, Ink.main, style = stroke)
        }
    }
}

@Composable
fun SettingsScreen(vm: TutoViewModel) {
    val s = LocalStrings.current
    val child = vm.child ?: return
    var disconnect by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Text(s.say("Settings", "Ayarlar", "Ajustes"), style = MaterialTheme.typography.headlineLarge)
            Text(child.name, style = MaterialTheme.typography.headlineMedium)
            Text(s.say("Your grown-up manages your learning language and activities.", "Öğrenme dilini ve etkinliklerini ebeveynin yönetir.", "Tu familia gestiona tu idioma y tus actividades."), style = MaterialTheme.typography.bodyLarge)
            BigButton(s.say("Switch child", "Çocuğu değiştir", "Cambiar de niño"), Modifier.fillMaxWidth()) { vm.signOut() }
            SoftButton(s.say("Disconnect this family", "Bu aileden çık", "Desconectar esta familia")) { disconnect = true }
        }
    }
    if (disconnect) AlertDialog(onDismissRequest = { disconnect = false },
        title = { Text(s.say("Disconnect this tablet?", "Tabletin bağlantısı kesilsin mi?", "¿Desconectar esta tableta?")) },
        text = { Text(s.say("You will need the family code to sign in again. Your saved learning stays in your account.", "Yeniden giriş için aile kodu gerekecek. Kaydedilmiş çalışmaların hesabında kalır.", "Necesitarás el código de familia para volver. Tu trabajo guardado permanece en tu cuenta.")) },
        confirmButton = { TextButton(onClick = { disconnect = false; vm.leaveFamily() }) { Text(s.say("Disconnect", "Bağlantıyı kes", "Desconectar")) } },
        dismissButton = { TextButton(onClick = { disconnect = false }) { Text(s.say("Cancel", "İptal", "Cancelar")) } })
}

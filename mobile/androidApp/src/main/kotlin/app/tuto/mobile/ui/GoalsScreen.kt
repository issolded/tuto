package app.tuto.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.Claim
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.data.Reward
import app.tuto.mobile.data.ServerRefused
import app.tuto.mobile.data.Strings
import app.tuto.mobile.data.Suggestion
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

// GoalsScreen.jsx's choices for a goal the child asks for.
private val ASK_EMOJIS = listOf("🎁", "🛹", "🧸", "🎮", "📚", "🚲", "🍕", "🎨", "⚽", "🎧")

/**
 * My Goals, as on the web: what the parent has set, how far the Gems go towards each, and a claim
 * the parent then approves. The server checks the balance and takes the Gems; nothing is spent here.
 */
@Composable
fun GoalsScreen(vm: TutoViewModel) {
    val s = LocalStrings.current
    val child = vm.child ?: return
    val scope = rememberCoroutineScope()
    var rewards by remember { mutableStateOf<List<Reward>?>(null) }
    var gems by remember { mutableStateOf<Int?>(null) }
    var claims by remember { mutableStateOf<List<Claim>>(emptyList()) }
    var suggestions by remember { mutableStateOf<List<Suggestion>>(emptyList()) }
    var failed by remember { mutableStateOf(false) }
    var claiming by remember { mutableStateOf<String?>(null) }
    var asking by remember { mutableStateOf(false) }
    var reload by remember { mutableStateOf(0) }
    var actionFailed by remember { mutableStateOf(false) }

    LaunchedEffect(child.id, reload) {
        failed = false
        runCatching {
            val r = async { vm.api.rewards(child.id) }
            val g = async { vm.api.gems(child.id) }
            val c = async { vm.api.rewardClaims(child.id) }
            val q = async { vm.api.rewardSuggestions(child.id) }
            rewards = r.await(); gems = g.await(); claims = c.await(); suggestions = q.await()
        }.onFailure { failed = true }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 40.dp, vertical = 28.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            CircleButton(s.say("Back", "Geri", "Atrás"), onClick = { vm.home() }) { CloseIcon(Modifier.size(18.dp)) }
            Text(s("goals_title"), style = MaterialTheme.typography.headlineLarge, modifier = Modifier.weight(1f))
            GemPill(gems)
        }
        if (failed) SoftButton(s.say("Try again", "Tekrar dene", "Reintentar")) { reload++ }
        if (actionFailed) Text(s.say("Your request couldn't be sent. Check the connection and try again.", "İsteğin gönderilemedi. Bağlantını kontrol edip tekrar dene.", "No se pudo enviar tu solicitud. Revisa la conexión e inténtalo otra vez."), style = MaterialTheme.typography.bodyLarge)
        when {
            failed -> Text(s.say("Can't reach Tuto right now. Try again in a moment.", "Şu an Tuto'ya ulaşamıyorum. Birazdan tekrar dene.", "Ahora no puedo conectar con Tuto. Inténtalo en un momento."), style = MaterialTheme.typography.bodyLarge, color = Ink.soft)
            rewards == null -> Text(s("dr_loading_short"), style = MaterialTheme.typography.bodyLarge, color = Ink.soft)
            rewards!!.isEmpty() && suggestions.isEmpty() -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                Tuto(Modifier.size(width = 200.dp, height = 254.dp))
                Column { Text(s("goals_empty_1"), style = MaterialTheme.typography.headlineMedium); Text(s("goals_empty_2"), style = MaterialTheme.typography.bodyLarge, color = Ink.soft) }
            }
            else -> {
                val pending = claims.filter { it.status == "pending" }.associateBy { it.rewardId }
                rewards!!.forEach { r ->
                    RewardCard(r, gems ?: 0, pending.containsKey(r.id), claiming == r.id, s) {
                        if (claiming != null) return@RewardCard
                        claiming = r.id
                        actionFailed = false
                        scope.launch {
                            runCatching { vm.api.claimReward(child.id, r.id) }
                                .onSuccess { c ->
                                    claims = listOf(c) + claims.filter { it.id != c.id }
                                    // A pending claim is server-owned. Re-read the balance instead
                                    // of guessing it by subtracting the card's cached price.
                                    gems = runCatching { vm.api.gems(child.id) }.getOrNull()
                                }
                                .onFailure { actionFailed = true }
                            claiming = null
                        }
                    }
                }
                suggestions.forEach { SuggestionCard(it, s) }
            }
        }
        if (rewards != null) {
            Box(
                Modifier.fillMaxWidth().height(64.dp).clip(RoundedCornerShape(24.dp)).background(Color.White.copy(alpha = .6f))
                    .border(2.dp, Color(0xFFE8D9A0), RoundedCornerShape(24.dp)).clickable(role = Role.Button) { asking = true },
                contentAlignment = Alignment.Center,
            ) { Text("✨ " + s("goal_ask"), style = MaterialTheme.typography.labelLarge, color = Ink.soft) }
        }
    }

    if (asking) AskDialog(s, onClose = { asking = false }) { name, icon, wanted, done ->
        scope.launch {
            runCatching { vm.api.suggestReward(child.id, name, icon, wanted) }
                .onSuccess { suggestions = listOf(it) + suggestions; asking = false; done(null) }
                .onFailure { e -> done(if (e is ServerRefused && e.reason == "too many pending requests") s("goal_ask_toomany") else s.say("Couldn't send. Try again?", "Gönderilemedi. Tekrar dener misin?", "No se ha podido enviar. ¿Otra vez?")) }
        }
    }
}

@Composable
private fun RewardCard(r: Reward, gems: Int, pending: Boolean, claiming: Boolean, s: Strings, onClaim: () -> Unit) {
    val ready = r.cost > 0 && gems >= r.cost
    Column(Modifier.fillMaxWidth().card().padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Box(Modifier.size(64.dp).clip(RoundedCornerShape(18.dp)).background(Color(0xFFFFF3C4)), contentAlignment = Alignment.Center) { Text(r.icon, fontSize = 34.sp) }
            Column(Modifier.weight(1f)) {
                Text(r.name, style = MaterialTheme.typography.titleLarge)
                Text(s.say("${r.cost} Gems needed", "${r.cost} Gem gerekiyor", "Hacen falta ${r.cost} gems"), style = MaterialTheme.typography.bodySmall, color = Color(0xFFC8900A))
            }
        }
        Box(Modifier.fillMaxWidth().height(14.dp).clip(RoundedCornerShape(999.dp)).background(Color(0xFFF1E9D6))) {
            Box(Modifier.fillMaxWidth(if (r.cost > 0) (gems.toFloat() / r.cost).coerceIn(0f, 1f) else 0f).height(14.dp).clip(RoundedCornerShape(999.dp)).background(Ink.jar))
        }
        when {
            pending -> Text("⏳ " + s.say("Waiting for your grown-up to say yes", "Annenin ya da babanın onayı bekleniyor", "Esperando a que tu madre o tu padre diga que sí"), style = MaterialTheme.typography.bodyMedium, color = Color(0xFFC8900A))
            ready -> BigButton(if (claiming) s("goal_claiming") else s("goal_claim"), Modifier.fillMaxWidth(), color = Color(0xFF2EC486), enabled = !claiming, onClick = onClaim)
            else -> Text(s.say("${r.cost - gems} more Gems to go!", "${r.cost - gems} Gem daha!", "¡Faltan ${r.cost - gems} gems!"), style = MaterialTheme.typography.bodyMedium, color = Ink.soft)
        }
    }
}

@Composable
private fun SuggestionCard(sg: Suggestion, s: Strings) {
    Row(Modifier.fillMaxWidth().card(Color.White.copy(alpha = .75f)).padding(18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(sg.icon, fontSize = 30.sp)
        Column(Modifier.weight(1f)) {
            Text(sg.name, style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp))
            Text("⏳ " + s("goal_asked_waiting"), style = MaterialTheme.typography.bodySmall, color = Ink.soft)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AskDialog(s: Strings, onClose: () -> Unit, onSend: (String, String, Int, (String?) -> Unit) -> Unit) {
    var name by remember { mutableStateOf("") }
    var icon by remember { mutableStateOf("🎁") }
    var wanted by remember { mutableStateOf(100) }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text(s("goal_ask_title"), style = MaterialTheme.typography.headlineMedium) },
        text = {
            Column(Modifier.widthIn(max = 520.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                OutlinedTextField(name, { name = it.take(60) }, label = { Text(s("goal_ask_name")) }, placeholder = { Text(s("goal_ask_name_ph")) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ASK_EMOJIS.forEach { e ->
                        Box(Modifier.size(52.dp).clip(CircleShape).background(if (e == icon) Color(0xFFFFE3C2) else Color(0xFFF6F2EA)).clickable(role = Role.Button) { icon = e }, contentAlignment = Alignment.Center) { Text(e, fontSize = 26.sp) }
                    }
                }
                Text(s("goal_ask_gems"), style = MaterialTheme.typography.labelLarge)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    CircleButton("−", color = Color(0xFFF6F2EA), onClick = { wanted = (wanted - 10).coerceAtLeast(10) }) { Text("−", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold) }
                    Text("$wanted", fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 32.sp)
                    CircleButton("+", color = Color(0xFFF6F2EA), onClick = { wanted = (wanted + 10).coerceAtMost(1000) }) { Text("+", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold) }
                }
                Text(s("goal_ask_note"), style = MaterialTheme.typography.bodySmall, color = Ink.soft)
                error?.let { Text(it, color = Color(0xFFB3261E), style = MaterialTheme.typography.bodyMedium) }
            }
        },
        confirmButton = {
            TextButton(enabled = !sending, onClick = {
                if (name.isBlank()) { error = s("goal_ask_needname"); return@TextButton }
                sending = true; error = null
                onSend(name.trim(), icon, wanted) { err -> sending = false; error = err }
            }) { Text(if (sending) s("goal_ask_sending") else s("goal_ask_send"), style = MaterialTheme.typography.labelLarge) }
        },
        dismissButton = { TextButton(onClick = onClose) { Text(s("goal_ask_cancel"), style = MaterialTheme.typography.labelLarge, color = Ink.soft) } },
    )
}

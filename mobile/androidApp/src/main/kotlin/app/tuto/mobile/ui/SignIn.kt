package app.tuto.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.ChildSummary
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.data.PinResult
import kotlinx.coroutines.launch

/**
 * The family code a parent reads out or shows from their dashboard, as on the web's /setup:
 * letters and digits only, upper-cased, eight at most. Accepted only if the family has children.
 */
@Composable
fun SetupScreen(vm: TutoViewModel) {
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun submit() {
        val c = code.trim().uppercase()
        if (c.isEmpty() || busy) return
        busy = true; error = null
        scope.launch {
            error = runCatching { vm.api.familyChildren(c) }.fold(
                onSuccess = { kids -> if (kids.isEmpty()) s.say("We couldn't find that family code. Check it with your grown-up.", "Bu aile kodunu bulamadık. Annene babana sorup tekrar dene.", "No encontramos ese código de familia. Revísalo con tu madre o tu padre.") else { vm.joinFamily(c); null } },
                onFailure = { s.say("No connection. Check the internet and try again.", "Bağlantı yok. İnterneti kontrol edip tekrar dene.", "No hay conexión. Revisa internet e inténtalo otra vez.") },
            )
            busy = false
        }
    }

    // With the keyboard up a landscape tablet has little height left: scroll rather than hide Continue.
    BoxWithConstraints(Modifier.fillMaxSize()) {
        Row(Modifier.verticalScroll(rememberScrollState()).fillMaxWidth().heightIn(min = maxHeight).padding(40.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(48.dp)) {
            Tuto(Modifier.size(width = 320.dp, height = 406.dp))
            Column(Modifier.widthIn(max = 520.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Text(s.say("Hi! I'm Tuto.", "Merhaba! Ben Tuto.", "¡Hola! Soy Tuto."), style = MaterialTheme.typography.headlineLarge)
                Text(s.say("Ask your grown-up for the family code on their Tuto dashboard.", "Aile kodunu annenden ya da babandan iste. Tuto panellerinde yazıyor.", "Pide a tu madre o a tu padre el código de familia de su panel de Tuto."), style = MaterialTheme.typography.bodyLarge, color = Ink.soft)
                OutlinedTextField(
                    value = code,
                    onValueChange = { v -> code = v.filter { it.isLetterOrDigit() }.uppercase().take(8) },
                    label = { Text(s.say("Family code", "Aile kodu", "Código de familia")) },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.headlineMedium.copy(letterSpacing = 4.sp),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let { Text(it, color = Color(0xFFB3261E), style = MaterialTheme.typography.bodyMedium) }
                BigButton(if (busy) "…" else s.say("Continue", "Devam", "Continuar"), Modifier.fillMaxWidth(), enabled = code.isNotBlank() && !busy) { submit() }
            }
        }
    }
}

/**
 * A four-digit PIN, checked on the server (it identifies which child is signing in). Five wrong
 * tries lock the family for ten minutes there; this only relays what the server says.
 */
@Composable
fun PinScreen(vm: TutoViewModel) {
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    val code = vm.session.familyCode ?: return
    var kids by remember { mutableStateOf<List<ChildSummary>?>(null) }
    var pin by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var checking by remember { mutableStateOf(false) }
    var shakeKey by remember { mutableStateOf(0) }

    LaunchedEffect(code) { kids = runCatching { vm.api.familyChildren(code) }.getOrNull() }

    fun check(entered: String) {
        checking = true
        scope.launch {
            val result = runCatching { vm.api.verifyPin(code, entered) }.getOrNull()
            checking = false
            when (result) {
                is PinResult.Ok -> vm.signedIn(result.child)
                is PinResult.Wrong -> { pin = ""; shakeKey++; message = s.say("That's not the right PIN. Try again!", "PIN yanlış. Tekrar dene!", "Ese PIN no es. ¡Prueba otra vez!") }
                is PinResult.Locked -> { pin = ""; message = s.say("Too many tries. Wait ${result.retrySeconds / 60} minutes.", "Çok fazla deneme oldu. ${result.retrySeconds / 60} dakika bekle.", "Demasiados intentos. Espera ${result.retrySeconds / 60} minutos.") }
                null -> { pin = ""; message = s.say("No connection. Try again.", "Bağlantı yok. Tekrar dene.", "No hay conexión. Inténtalo otra vez.") }
            }
        }
    }

    Row(Modifier.fillMaxSize().padding(40.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(48.dp)) {
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Tuto(Modifier.size(width = 260.dp, height = 330.dp))
            Text(s.say("Who's learning today?", "Bugün kim öğreniyor?", "¿Quién aprende hoy?"), style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
            kids?.takeIf { it.isNotEmpty() }?.let { list ->
                Text(list.joinToString(" · ") { it.name }, style = MaterialTheme.typography.bodyLarge, color = Ink.soft, textAlign = TextAlign.Center)
            }
            Text(
                s.say("Not your family?", "Senin ailen değil mi?", "¿No es tu familia?"),
                style = MaterialTheme.typography.bodyMedium, color = Ink.soft,
                modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable(role = Role.Button) { vm.leaveFamily() }.padding(10.dp),
            )
        }
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Text(s.say("Enter your PIN", "PIN'ini gir", "Escribe tu PIN"), style = MaterialTheme.typography.headlineMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(18.dp), modifier = Modifier.semantics { contentDescription = "${pin.length}/4" }) {
                repeat(4) { i -> Box(Modifier.size(26.dp).clip(CircleShape).background(if (i < pin.length) Ink.main else Ink.main.copy(alpha = .15f))) }
            }
            Box(Modifier.height(28.dp)) { message?.let { Text(it, color = Color(0xFFB3261E), style = MaterialTheme.typography.bodyMedium) } }
            Keypad(
                keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"),
                enabled = !checking,
                onKey = { k ->
                    message = null
                    when {
                        k == "⌫" -> pin = pin.dropLast(1)
                        pin.length < 4 -> { pin += k; if (pin.length == 4) check(pin) }
                    }
                },
                modifier = Modifier.width(360.dp),
            )
        }
    }
}

/** Big number keys, shared by the PIN pad and the maths answer pad. An empty label is a gap. */
@Composable
fun Keypad(keys: List<String>, onKey: (String) -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, keyHeight: Int = 82, labels: Map<String, String> = emptyMap()) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        keys.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { k ->
                    if (k.isEmpty()) Spacer(Modifier.weight(1f).height(keyHeight.dp))
                    else Box(
                        Modifier.weight(1f).height(keyHeight.dp).clip(RoundedCornerShape(22.dp))
                            .background(if (k == "⌫") Color(0xFFF4EEE4) else Color(0xFFFFF6E5))
                            .clickable(enabled = enabled, role = Role.Button) { onKey(k) }
                            .semantics { contentDescription = labels[k] ?: k }
                            .testTag("key_$k"),
                        contentAlignment = Alignment.Center,
                    ) { Text(labels[k] ?: k, fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 34.sp) }
                }
            }
        }
    }
}

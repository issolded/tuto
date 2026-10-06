package app.tuto.mobile.ui

import androidx.compose.material3.TextButton

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
import androidx.compose.runtime.saveable.rememberSaveable
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
    val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    val focus = androidx.compose.ui.platform.LocalFocusManager.current
    var code by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun submit() {
        val c = code.trim().uppercase()
        if (c.isEmpty() || busy) return
        keyboard?.hide(); focus.clearFocus(force = true)
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
    AdaptivePair(first = {
        Tuto(Modifier.widthIn(max = 280.dp).fillMaxWidth().height(260.dp))
    }, second = {
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
                TextButton(onClick = { vm.open("parent") }) { Text(s.say("Parent sign in", "Ebeveyn girişi", "Acceso familiar")) }
                BigButton(if (busy) "…" else s.say("Continue", "Devam", "Continuar"), Modifier.fillMaxWidth(), enabled = code.isNotBlank() && !busy) { submit() }
            }
    })
}

/**
 * A four-digit PIN, checked on the server (it identifies which child is signing in). Five wrong
 * tries lock the family for one minute there; this only relays what the server says.
 */
@Composable
fun PinScreen(vm: TutoViewModel) {
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    val code = vm.session.familyCode ?: return
    var kids by remember { mutableStateOf<List<ChildSummary>?>(null) }
    var pin by rememberSaveable { mutableStateOf("") }
    var selected by rememberSaveable { mutableStateOf<String?>(null) }
    var loadFailed by remember { mutableStateOf(false) }
    var loadKey by remember { mutableStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }
    var checking by remember { mutableStateOf(false) }
    var requestingPin by remember { mutableStateOf(false) }
    var pinRequested by remember { mutableStateOf(false) }
    var shakeKey by remember { mutableStateOf(0) }

    LaunchedEffect(code, loadKey) {
        loadFailed = false
        runCatching { vm.api.familyChildren(code) }
            .onSuccess { kids = it; if (it.size == 1) selected = it[0].id }
            .onFailure { loadFailed = true }
    }

    fun check(entered: String) {
        checking = true
        scope.launch {
            val result = runCatching { vm.api.verifyPin(code, entered, selected) }.getOrNull()
            checking = false
            when (result) {
                is PinResult.Ok -> vm.signedIn(result.child)
                is PinResult.Wrong -> { pin = ""; shakeKey++; message = s.say("That's not the right PIN. Try again!", "PIN yanlış. Tekrar dene!", "Ese PIN no es. ¡Prueba otra vez!") }
                is PinResult.Locked -> { pin = ""; message = s.say("Too many tries. Wait ${((result.retrySeconds + 59) / 60).coerceAtLeast(1)} minutes.", "Çok fazla deneme oldu. ${((result.retrySeconds + 59) / 60).coerceAtLeast(1)} dakika bekle.", "Demasiados intentos. Espera ${((result.retrySeconds + 59) / 60).coerceAtLeast(1)} minutos.") }
                null -> { pin = ""; message = s.say("No connection. Try again.", "Bağlantı yok. Tekrar dene.", "No hay conexión. Inténtalo otra vez.") }
            }
        }
    }

    AdaptivePair(first = {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Tuto(Modifier.widthIn(max = 260.dp).fillMaxWidth().height(220.dp))
            Text(s.say("Who's learning today?", "Bugün kim öğreniyor?", "¿Quién aprende hoy?"), style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
            kids?.takeIf { it.isNotEmpty() }?.let { list ->
                list.forEach { kid ->
                    androidx.compose.material3.FilterChip(
                        selected = selected == kid.id,
                        onClick = { if (!checking && !requestingPin) { selected = kid.id; pin = ""; message = null; pinRequested = false } },
                        label = { Text(kid.name) },
                        enabled = !checking && !requestingPin,
                        modifier = Modifier.testTag("child_${kid.id}"),
                    )
                }
            }
            Text(
                s.say("Not your family?", "Senin ailen değil mi?", "¿No es tu familia?"),
                style = MaterialTheme.typography.bodyMedium, color = Ink.soft,
                modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable(role = Role.Button) { vm.leaveFamily() }.padding(10.dp),
            )
        }
    }, second = {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
            if (loadFailed) {
                Text(s.say("Couldn't load your family. Check your connection.", "Ailen yüklenemedi. Bağlantını kontrol et.", "No se pudo cargar tu familia. Revisa la conexión."))
                SoftButton(s.say("Try again", "Tekrar dene", "Reintentar")) { loadKey++ }
            } else if (kids?.isEmpty() == true) {
                Text(s.say("No children found. Ask your grown-up to check the family code.", "Çocuk bulunamadı. Aile kodunu ebeveyninle kontrol et.", "No se encontraron niños. Revisa el código con tu familia."))
            }
            Text(s.say("Enter your PIN", "PIN'ini gir", "Escribe tu PIN"), style = MaterialTheme.typography.headlineMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(18.dp), modifier = Modifier.semantics { contentDescription = "${pin.length}/4" }) {
                repeat(4) { i -> Box(Modifier.size(26.dp).clip(CircleShape).background(if (i < pin.length) Ink.main else Ink.main.copy(alpha = .15f))) }
            }
            Box(Modifier.heightIn(min = 28.dp)) { message?.let { Text(it, color = Color(0xFFB3261E), style = MaterialTheme.typography.bodyMedium) } }
            Keypad(
                keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"),
                enabled = !checking && !requestingPin && !loadFailed && selected != null && !kids.isNullOrEmpty(),
                onKey = { k ->
                    message = null
                    when {
                        k == "⌫" -> pin = pin.dropLast(1)
                        pin.length < 4 -> { pin += k; if (pin.length == 4) check(pin) }
                    }
                },
                modifier = Modifier.widthIn(max = 360.dp).fillMaxWidth(),
            )
            androidx.compose.material3.TextButton(
                enabled = selected != null && !checking && !requestingPin && !pinRequested && !loadFailed,
                modifier = Modifier.testTag("forgot-pin"),
                onClick = {
                    val id = selected ?: return@TextButton
                    requestingPin = true
                    scope.launch {
                        runCatching { vm.api.forgotPin(code, id) }
                            .onSuccess { pinRequested = true; message = s.say("Request received. Ask your grown-up for a new PIN.", "İstek alındı. Yeni PIN için ebeveynine sor.", "Solicitud recibida. Pide un PIN nuevo a tu familia.") }
                            .onFailure { message = s.say("Couldn't send the request. Try again.", "İstek gönderilemedi. Tekrar dene.", "No se pudo enviar. Inténtalo otra vez.") }
                        requestingPin = false
                    }
                },
            ) { Text(s.say("I forgot my PIN", "PIN'imi unuttum", "He olvidado mi PIN")) }
        }
    })
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

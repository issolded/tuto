package app.tuto.mobile.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import app.tuto.mobile.*
import app.tuto.mobile.data.*
import org.json.JSONObject
import java.time.Instant

@OptIn(ExperimentalLayoutApi::class)
@Composable fun ParentScreen(vm: TutoViewModel) {
    val p = vm.parent
    val s = vm.strings.withLang(if (p.unlocked) p.language else java.util.Locale.getDefault().language)
    val context = LocalContext.current
    val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    val focus = androidx.compose.ui.platform.LocalFocusManager.current
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var draft by remember { mutableStateOf(JSONObject()) }
    var confirm by remember { mutableStateOf<(() -> Unit)?>(null) }
    var wa by remember { mutableStateOf<JSONObject?>(null) }
    fun edit(key: String, value: Any) { draft = JSONObject(draft.toString()).put(key, value) }
    fun go(page: String, value: JSONObject = JSONObject()) { draft = if (page == "screen") ParentRules.complete(value) else JSONObject(value.toString()); p.page = page }
    CompositionLocalProvider(LocalStrings provides s) {
        FeaturePage(s.say("Parent area", "Ebeveyn alanı", "Área familiar"), { if (!p.unlocked || p.page == "children") vm.home() else p.page = "children" }) {
            if (p.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            p.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            p.notice?.let { Text(it) }
            if (!p.unlocked) {
                Button(onClick={keyboard?.hide();focus.clearFocus(force=true);p.work { try {context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(p.cloud.beginGoogleOAuth())))} catch(e:Exception) {p.cloud.cancelOAuth();throw e} }},enabled=!p.busy) {Text(s.say("Continue with Google","Google ile devam et","Continuar con Google"))}
                OutlinedTextField(email, { email = it }, label = { Text(s.say("Email", "E-posta", "Correo")) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(password, { password = it }, label = { Text(s.say("Password", "Şifre", "Contraseña")) }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
                Button(onClick = { keyboard?.hide(); focus.clearFocus(force=true); p.work { p.signIn(email, password); password = "" } }, enabled = !p.busy && email.isNotBlank() && password.isNotBlank()) { Text(s.say("Sign in", "Giriş yap", "Entrar")) }
                TextButton(onClick = { p.work { p.cloud.resetPassword(email); p.notice = s.say("Check your email for the reset link.", "Şifre yenileme bağlantısı için e-postanı kontrol et.", "Revisa tu correo para restablecer la contraseña.") } }, enabled = !p.busy && email.isNotBlank()) { Text(s.say("Forgot password", "Şifremi unuttum", "Olvidé mi contraseña")) }
                TextButton(onClick = { p.work {
                    if (p.cloud.signUp(email, password)) { p.load(); p.unlocked = true; password = "" }
                    else p.notice = s.say("Check your email to confirm your account, then sign in.", "Hesabını doğrulamak için e-postanı kontrol et, ardından giriş yap.", "Confirma tu cuenta por correo y después inicia sesión.")
                } }, enabled = !p.busy && email.isNotBlank() && password.length >= 8) { Text(s.say("Create parent account", "Ebeveyn hesabı oluştur", "Crear cuenta familiar")) }
                return@FeaturePage
            }
            when (p.page) {
                "children" -> {
                    Text(s.say("Family code", "Aile kodu", "Código familiar") + ": " + p.profile.optString("family_code"), style = MaterialTheme.typography.headlineMedium)
                    p.children.forEach { child -> Card(onClick = { p.work { p.loadChild(child) } }, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(20.dp)) { Text(child.optString("name"), style = MaterialTheme.typography.headlineSmall); Text("${child.optInt("age")} · ${child.optString("language")}") } } }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = { p.selected = null; go("edit-child") }) { Text(s.say("Add child", "Çocuk ekle", "Añadir niño")) }
                        TextButton(onClick = { go("settings", p.profile.optJSONObject("prefs") ?: JSONObject()) }) { Text(s.say("Notifications & settings", "Bildirimler ve ayarlar", "Notificaciones y ajustes")) }
                        TextButton(onClick = { p.page = "chat"; p.work { p.loadChat() } }) { Text(s.say("Ask Tuto", "Tuto'ya sor", "Pregunta a Tuto")) }
                        TextButton(onClick = { p.work { p.cloud.signOut(); p.lock() } }) { Text(s.say("Sign out", "Çıkış yap", "Salir")) }
                    }
                }
                "child" -> {
                    Text(p.selected!!.optString("name"), style = MaterialTheme.typography.headlineMedium)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { go("edit-child", p.selected!!) }) { Text(s.say("Profile & PIN", "Profil ve PIN", "Perfil y PIN")) }
                        TextButton(onClick = { go("tasks", p.selected!!.optJSONObject("task_settings") ?: JSONObject()) }) { Text(s.say("Activities", "Etkinlikler", "Actividades")) }
                        TextButton(onClick = { p.work { p.loadWeek(0) } }) { Text(s.say("Weekly report", "Haftalık rapor", "Informe semanal")) }
                        TextButton(onClick = { go("rewards") }) { Text(s.say("Rewards & Gems", "Ödüller ve Gem", "Premios y gemas")) }
                        TextButton(onClick = { go("screen", p.profile.optJSONObject("prefs")?.optJSONObject("screen_control_web")?.optJSONObject(p.selected!!.getString("id")) ?: JSONObject()) }) { Text(s.say("Screen plan", "Ekran planı", "Plan de pantalla")) }
                    }
                    Text(s.say("Awaiting approval", "Onay bekleyenler", "Pendientes"), style = MaterialTheme.typography.titleLarge)
                    val groups = listOf("submissions" to "submissions", "paintings" to "paintings", "contributions" to "contributions", "claims" to "reward-claims", "suggestions" to "reward-suggestions")
                    var count = 0
                    groups.forEach { (key, endpoint) -> p.detail.optJSONArray(key).objects().filter { it.optString("status") == "pending" }.forEach { row ->
                        count++
                        Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(row.optString("name").ifBlank { row.optString("label").ifBlank { s.say("Submission", "Gönderim", "Entrega") } }, style = MaterialTheme.typography.titleLarge)
                            Text(row.optString("created_at").take(10)); Text(row.optString("task_type")); Text(row.optString("task_description"))
                            RemotePhoto(row.optStringOrNull("photo"))
                            row.optJSONArray("photos").strings().forEach { RemotePhoto(it) }
                            var cost by remember(row.optString("id")) { mutableStateOf("100") }
                            if (endpoint == "reward-suggestions") OutlinedTextField(cost, { cost = it.filter(Char::isDigit).take(6) }, label = { Text("Gem") })
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Button(onClick = { confirm = { p.work { p.decision(endpoint, row, true, if (endpoint == "reward-suggestions") cost.toIntOrNull() else null) } } }, enabled = !p.busy && (endpoint != "reward-suggestions" || (cost.toIntOrNull() ?: 0) in 10..100000)) { Text(s.say("Approve", "Onayla", "Aprobar")) }
                                TextButton(onClick = { confirm = { p.work { p.decision(endpoint, row, false) } } }, enabled = !p.busy) { Text(s.say("Reject", "Reddet", "Rechazar")) }
                            }
                        } }
                    } }
                    if (count == 0) Text(s.say("No pending items.", "Bekleyen kayıt yok.", "No hay pendientes."))
                    Text(s.say("Gem history", "Gem geçmişi", "Historial de gemas"), style = MaterialTheme.typography.titleLarge)
                    p.detail.optJSONArray("ledger").objects().forEach { Text("${it.optString("created_at").take(10)} · ${it.optString("reason")} · ${it.optInt("amount")}") }
                }
                "edit-child" -> {
                    Field(s.say("Name", "Ad", "Nombre"), draft.optString("name")) { edit("name", it.take(60)) }
                    Field(s.say("Birth date (YYYY-MM-DD)", "Doğum tarihi (YYYY-AA-GG)", "Fecha de nacimiento (AAAA-MM-DD)"), draft.optString("birth_date").let { if (it == "null") "" else it }) { edit("birth_date", it.take(10)) }
                    LanguagePicker(draft.optString("language", "en")) { edit("language", it) }
                    var pin by remember { mutableStateOf("") }
                    OutlinedTextField(pin, { pin = it.filter(Char::isDigit).take(4) }, label = { Text(s.say("New 4-digit PIN", "Yeni 4 haneli PIN", "Nuevo PIN de 4 dígitos")) }, visualTransformation = PasswordVisualTransformation())
                    Text(s.say("Leave PIN empty to keep the existing PIN.", "Mevcut PIN'i korumak için boş bırak.", "Deja el PIN vacío para conservarlo."))
                    Button(onClick = { p.work { p.saveChild(draft.optString("name"), draft.optString("birth_date").takeUnless { it == "null" }.orEmpty(), draft.optString("language", "en"), pin, p.selected?.optString("id")) } }, enabled = !p.busy && draft.optString("name").isNotBlank() && (draft.optString("birth_date").length == 10 || (p.selected != null && draft.optString("birth_date").let { it.isBlank() || it == "null" }))) { Text(s.say("Save", "Kaydet", "Guardar")) }
                }
                "tasks" -> {
                    val defaults = mapOf("math" to 30, "puzzle" to 30, "english" to 30, "reading" to 30, "writing" to 30, "homework" to 25, "drawing" to 20)
                    defaults.forEach { (type, gems) ->
                        val value = draft.optJSONObject(type) ?: JSONObject().put("active", true).put("gems", gems).put("daily_cap", if (type == "drawing") 2 else 3)
                        Text(s("task_$type"), style = MaterialTheme.typography.titleLarge)
                        Toggle(s.say("Enabled", "Etkin", "Activado"), value.optBoolean("active", true)) { edit(type, JSONObject(value.toString()).put("active", it)) }
                        NumberField("Gem", value.optInt("gems", gems), 0..1000) { edit(type, JSONObject(value.toString()).put("gems", it)) }
                        NumberField(s.say("Daily cap", "Günlük sınır", "Límite diario"), value.optInt("daily_cap", 3), 1..10) { edit(type, JSONObject(value.toString()).put("daily_cap", it)) }
                    }
                    val bonus = draft.optJSONObject("bonus") ?: JSONObject().put("active", false).put("gems", 20).put("types", org.json.JSONArray(listOf("math", "reading")))
                    Toggle(s.say("Daily all-rounder bonus", "Günlük çok yönlü çalışma bonusu", "Bono diario de actividades"), bonus.optBoolean("active")) { edit("bonus", JSONObject(bonus.toString()).put("active", it)) }
                    NumberField("Bonus Gem", bonus.optInt("gems",20), 0..1000) { edit("bonus", JSONObject(bonus.toString()).put("gems",it)) }
                    listOf("math","reading","writing","drawing","puzzle","english").forEach { type ->
                        val types = bonus.optJSONArray("types").strings()
                        Toggle(s("task_$type"), type in types) { checked -> val next = if(checked) (types + type).distinct() else types - type; if(next.size >= 2) edit("bonus", JSONObject(bonus.toString()).put("types",org.json.JSONArray(next))) }
                    }
                    var variety by remember { mutableStateOf(p.selected!!.optString("english_variety", "auto").takeUnless { it == "null" } ?: "auto") }
                    FlowRow { listOf("auto", "uk", "us").forEach { value -> FilterChip(selected = variety == value, onClick = { variety = value }, label = { Text(value) }) } }
                    Button(onClick = { p.work { p.saveTasks(draft, variety) } }, enabled = !p.busy) { Text(s.say("Save", "Kaydet", "Guardar")) }
                }
                "week" -> {
                    Row { TextButton(onClick = { p.work { p.loadWeek(p.weekOffset + 1) } }, enabled = !p.busy) { Text("←") }; TextButton(onClick = { p.work { p.loadWeek(p.weekOffset - 1) } }, enabled = !p.busy && p.weekOffset > 0) { Text("→") } }
                    p.week?.let { w -> Text("${w.optJSONObject("range")?.optString("start")} — ${w.optJSONObject("range")?.optString("end")}"); Text("Gem: ${w.optJSONObject("totals")?.optInt("gems")}", style = MaterialTheme.typography.headlineSmall); w.optJSONArray("days").objects().forEach { Text("${it.optString("date")} · ${it.optInt("sessions")} · ${it.optInt("gems")} Gem") } }
                }
                "rewards" -> {
                    p.detail.optJSONArray("rewards").objects().forEach { reward -> Row { Text("${reward.optString("icon")} ${reward.optString("name")} · ${reward.optInt("bt_cost")}", Modifier.weight(1f)); TextButton(onClick = { confirm = { p.work { p.cloud.rows("rewards", "id=eq.${enc(reward.getString("id"))}", "PATCH", JSONObject().put("archived_at", Instant.now().toString()), true); p.loadChild(p.selected!!) } } }) { Text(s.say("Archive", "Arşivle", "Archivar")) } } }
                    Field(s.say("New reward", "Yeni ödül", "Nuevo premio"), draft.optString("name")) { edit("name", it.take(100)) }
                    NumberField("Gem", draft.optInt("cost", 100), 10..100000) { edit("cost", it) }
                    Toggle(s.say("Recurring", "Tekrarlanabilir", "Recurrente"), draft.optBoolean("recurring")) { edit("recurring", it) }
                    Button(onClick = { p.work { p.cloud.rows("rewards", "", "POST", JSONObject().put("child_id", p.selected!!.getString("id")).put("name", draft.optString("name")).put("icon", "⭐").put("bt_cost", draft.optInt("cost", 100)).put("recurring", draft.optBoolean("recurring")), true); p.loadChild(p.selected!!) } }, enabled = !p.busy && draft.optString("name").isNotBlank()) { Text(s.say("Add reward", "Ödül ekle", "Añadir premio")) }
                    HorizontalDivider()
                    NumberField(s.say("Gem amount", "Gem miktarı", "Cantidad de gemas"), draft.optInt("amount", 50), 1..100000) { edit("amount", it) }
                    Field(s.say("Reason", "Açıklama", "Motivo"), draft.optString("note")) { edit("note", it.take(80)) }
                    Row { listOf("gift-gems", "deduct-gems").forEach { action -> TextButton(onClick = { confirm = { p.work { p.cloud.parentCall("POST", "/api/children/${enc(p.selected!!.getString("id"))}/$action", JSONObject().put("amount", draft.optInt("amount", 50)).put("note", draft.optString("note"))); p.loadChild(p.selected!!) } } }, enabled = !p.busy) { Text(if (action == "gift-gems") s.say("Gift", "Hediye et", "Regalar") else s.say("Deduct", "Düş", "Descontar")) } } }
                }
                "settings" -> {
                    LanguagePicker(draft.optString("language", "en")) { edit("language", it) }
                    FlowRow { listOf("all", "required", "quiet").forEach { level -> FilterChip(selected = draft.optString("notify_level", "all") == level, onClick = { edit("notify_level", level) }, label = { Text(level) }) } }
                    listOf("submission", "drawing", "contribution").forEach { type -> Toggle(s("task_$type") + " · " + s.say("Approval", "Onay", "Aprobación"), draft.optJSONObject("approval_required")?.optBoolean(type, true) ?: true) { edit("approval_required", JSONObject(draft.optJSONObject("approval_required")?.toString() ?: "{}").put(type, it)) } }
                    Field(s.say("Quiet hours start (HH:mm)", "Sessiz saat başlangıcı (SS:dd)", "Silencio desde (HH:mm)"), draft.optJSONObject("quiet_hours")?.optString("start") ?: "21:00") { edit("quiet_hours", JSONObject(draft.optJSONObject("quiet_hours")?.toString() ?: "{}").put("start", it)) }
                    Field(s.say("Quiet hours end (HH:mm)", "Sessiz saat bitişi (SS:dd)", "Silencio hasta (HH:mm)"), draft.optJSONObject("quiet_hours")?.optString("end") ?: "08:00") { edit("quiet_hours", JSONObject(draft.optJSONObject("quiet_hours")?.toString() ?: "{}").put("end", it)) }
                    Button(onClick = { p.work { p.savePrefs(draft); p.page = "children" } }, enabled = !p.busy) { Text(s.say("Save", "Kaydet", "Guardar")) }
                    Text(s.say("Autopilot approves routine submissions, drawings and contributions for the selected period; reward claims still need you.", "Otomatik pilot seçilen süre boyunca ödev, çizim ve katkıları onaylar; ödül talepleri yine seni bekler.", "El piloto automático aprueba entregas, dibujos y aportaciones durante el periodo elegido; los premios aún requieren tu aprobación."))
                    Text(draft.optJSONObject("autopilot")?.optString("until").orEmpty())
                    FlowRow { listOf(60,120,240).forEach { minutes -> TextButton(onClick = { edit("autopilot", JSONObject().put("started_at",Instant.now().toString()).put("until",Instant.now().plusSeconds(minutes*60L).toString())) }) { Text("$minutes min") } }; TextButton(onClick = { edit("autopilot", JSONObject(draft.optJSONObject("autopilot")?.toString() ?: "{}").put("until",Instant.now().toString())) }) { Text(s.say("Stop", "Durdur", "Detener")) } }
                    Button(onClick = { p.work { p.savePrefs(draft); p.page="children" } }, enabled = !p.busy) { Text(s.say("Save notification settings", "Bildirim ayarlarını kaydet", "Guardar notificaciones")) }
                    Text("WhatsApp: " + if (!p.profile.isNull("whatsapp_verified_at")) s.say("Connected", "Bağlı", "Conectado") else s.say("Not connected", "Bağlı değil", "No conectado"))
                    Button(onClick = { p.work { wa = p.api.call("POST", "/api/whatsapp/connect-code", JSONObject().put("parentId", p.cloud.parentId)) } }, enabled = !p.busy) { Text(s.say("Connect WhatsApp", "WhatsApp bağla", "Conectar WhatsApp")) }
                    wa?.let { link -> TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link.getString("waLink")))) }) { Text(s.say("Open WhatsApp to send the connection code", "Bağlantı kodunu göndermek için WhatsApp'ı aç", "Abrir WhatsApp para enviar el código")) }; TextButton(onClick = { p.work { p.api.call("GET", "/api/whatsapp/connect-status?parentId=${enc(p.cloud.parentId!!)}&code=${enc(link.getString("code"))}"); p.load() } }) { Text(s.say("Check connection", "Bağlantıyı kontrol et", "Comprobar conexión")) } }
                    TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://t.me/TutoParentBot"))) }) { Text(s.say("Connect Telegram: send /start, then your family code", "Telegram bağla: /start, ardından aile kodunu gönder", "Conectar Telegram: envía /start y tu código familiar")) }
                }
                "screen" -> {
                    Text(s.say("This manages the family screen-time plan. It does not block Android apps or measure device usage.", "Bu alan aile ekran süresi planını yönetir. Android uygulamalarını engellemez veya cihaz kullanımını ölçmez.", "Gestiona el plan familiar. No bloquea aplicaciones Android ni mide su uso."))
                    listOf("weekday" to 30, "weekend" to 60, "cap" to 120, "earnedCap" to 30, "gemsPerMinute" to 2).forEach { (key, default) -> NumberField(planLabel(key), draft.optInt(key, default), if (key == "gemsPerMinute") 1..100 else 0..480) { edit(key, it) } }
                    listOf("approval", "bedtime", "school", "learnFirst").forEach { key -> Toggle(planLabel(key), draft.optBoolean(key, key != "learnFirst")) { edit(key, it) } }
                    listOf("bedStart" to "20:30", "bedEnd" to "07:00", "schoolStart" to "08:00", "schoolEnd" to "15:00").forEach { (key, default) -> Field(planLabel(key), draft.optString(key, default)) { edit(key, it) } }
                    NumberField(s.say("Learning activities first", "Önce tamamlanacak etkinlik", "Actividades antes de jugar"), draft.optInt("learnNeed",1),1..5) { edit("learnNeed",it) }
                    listOf("roblox","youtube","minecraft").forEach { app ->
                        Text(app)
                        FlowRow { listOf("timed","allowed","blocked").forEach { mode -> FilterChip(selected=draft.getJSONObject("apps").optString(app)==mode,onClick={edit("apps",JSONObject(draft.getJSONObject("apps").toString()).put(app,mode))},label={Text(planLabel(mode))}) } }
                    }
                    Toggle(s.say("Holiday", "Tatil", "Vacaciones"),draft.optBoolean("holiday")) { edit("holiday",it) }
                    Field(s.say("From (YYYY-MM-DD)", "Başlangıç (YYYY-AA-GG)", "Desde (AAAA-MM-DD)"),draft.optString("holidayFrom")) { edit("holidayFrom",it) }
                    Field(s.say("To (YYYY-MM-DD)", "Bitiş (YYYY-AA-GG)", "Hasta (AAAA-MM-DD)"),draft.optString("holidayTo")) { edit("holidayTo",it) }
                    Button(onClick = { p.work { require(ParentRules.valid(draft)); val prefs = p.cloud.updatePrefs { old -> val all = old.optJSONObject("screen_control_web") ?: JSONObject(); all.put(p.selected!!.getString("id"), draft); old.put("screen_control_web", all) }; p.load(); p.page = "children" } }, enabled = !p.busy) { Text(s.say("Save plan", "Planı kaydet", "Guardar plan")) }
                }
                "chat" -> {
                    p.messages.forEach { item -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text(item.optString("question"), style = MaterialTheme.typography.titleMedium); Text(if (item.optString("status") == "pending") s.say("Thinking…", "Düşünüyor…", "Pensando…") else item.optString("answer").ifBlank { s.say("Could not answer. Please send again.", "Yanıt alınamadı. Yeniden gönder.", "No se pudo responder. Envía de nuevo.") }); item.optJSONArray("photos").objects().forEach { RemotePhoto(it.optStringOrNull("url")) } } } }
                    Field(s.say("Ask about your child's progress", "Çocuğunun gelişimini sor", "Pregunta sobre el progreso"), draft.optString("question")) { edit("question", it.take(1000)) }
                    Button(onClick = { val q = draft.optString("question"); edit("question", ""); p.work { p.ask(q) } }, enabled = !p.busy && draft.optString("question").isNotBlank()) { Text(s.say("Send", "Gönder", "Enviar")) }
                }
            }
        }
        confirm?.let { action -> AlertDialog(onDismissRequest = { confirm = null }, title = { Text(s.say("Confirm this change?", "Bu değişiklik onaylansın mı?", "¿Confirmar este cambio?")) }, confirmButton = { TextButton(onClick = { confirm = null; action() }) { Text(s.say("Confirm", "Onayla", "Confirmar")) } }, dismissButton = { TextButton(onClick = { confirm = null }) { Text(s.say("Cancel", "Vazgeç", "Cancelar")) } }) }
    }
}
@Composable private fun Field(label: String, value: String, change: (String) -> Unit) { OutlinedTextField(value, change, label = { Text(label) }, modifier = Modifier.fillMaxWidth()) }
@Composable private fun NumberField(label: String, value: Int, range: IntRange, change: (Int) -> Unit) { var text by remember(value) { mutableStateOf(value.toString()) }; OutlinedTextField(text, { text = it.filter(Char::isDigit).take(6); text.toIntOrNull()?.takeIf { it in range }?.let(change) }, label = { Text("$label (${range.first}–${range.last})") }, isError = text.toIntOrNull() !in range) }
@Composable private fun Toggle(label: String, checked: Boolean, change: (Boolean) -> Unit) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(label, Modifier.weight(1f)); Switch(checked, change) } }
@OptIn(ExperimentalLayoutApi::class) @Composable private fun LanguagePicker(value: String, change: (String) -> Unit) { FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("en" to "English", "tr" to "Türkçe", "es" to "Español").forEach { (code, label) -> FilterChip(selected = code == value, onClick = { change(code) }, label = { Text(label) }) } } }

@Composable private fun planLabel(key:String):String {
 val s=LocalStrings.current
 return when(key) {
  "weekday" -> s.say("Weekday minutes","Hafta içi dakika","Minutos entre semana")
  "weekend" -> s.say("Weekend minutes","Hafta sonu dakika","Minutos de fin de semana")
  "cap" -> s.say("Daily limit (minutes)","Günlük sınır (dakika)","Límite diario (minutos)")
  "earnedCap" -> s.say("Maximum earned minutes","Kazanılabilecek en fazla dakika","Máximo de minutos ganados")
  "gemsPerMinute" -> s.say("Gems per minute","Dakika başına Gem","Gemas por minuto")
  "approval" -> s.say("Parent approval","Ebeveyn onayı","Aprobación parental")
  "bedtime" -> s.say("Bedtime schedule","Uyku saatleri","Horario de sueño")
  "school" -> s.say("School schedule","Okul saatleri","Horario escolar")
  "learnFirst" -> s.say("Complete learning first","Önce öğrenme görevlerini tamamla","Completar actividades primero")
  "bedStart" -> s.say("Bedtime starts (HH:MM)","Uyku başlangıcı (SS:DD)","Inicio del descanso (HH:MM)")
  "bedEnd" -> s.say("Bedtime ends (HH:MM)","Uyku bitişi (SS:DD)","Fin del descanso (HH:MM)")
  "schoolStart" -> s.say("School starts (HH:MM)","Okul başlangıcı (SS:DD)","Inicio de clases (HH:MM)")
  "schoolEnd" -> s.say("School ends (HH:MM)","Okul bitişi (SS:DD)","Fin de clases (HH:MM)")
  "timed" -> s.say("Timed","Süreli","Con límite")
  "allowed" -> s.say("Allowed","İzinli","Permitido")
  "blocked" -> s.say("Blocked in plan","Planda engelli","Bloqueado en el plan")
  else -> key
 }
}

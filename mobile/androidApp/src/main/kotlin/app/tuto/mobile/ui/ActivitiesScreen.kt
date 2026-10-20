package app.tuto.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.tuto.mobile.*
import app.tuto.mobile.data.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

@OptIn(ExperimentalLayoutApi::class)
@Composable fun ActivitiesScreen(vm: TutoViewModel, type: String) {
    val f = vm.feature ?: return
    val s = LocalStrings.current
    val context = LocalContext.current
    val ageGroup = when { f.child.age <= 8 -> "6-8"; f.child.age <= 11 -> "9-11"; else -> "12-15" }
    val instructions = remember { JSONObject(context.assets.open("drawing_steps.json").bufferedReader().use { it.readText() }) }
    var confirmDelete by remember { mutableStateOf<String?>(null) }
    fun load() = f.work {
        f.data = when (type) {
            "homework" -> f.api.call("GET", "${f.path}/homework")
            "drawing" -> f.api.call("GET", "/api/drawings?age_group=${enc(ageGroup)}").put("paintings", f.api.call("GET", "${f.path}/paintings").optJSONArray("paintings"))
            "tree" -> f.api.call("GET", "/api/tree?child_id=${enc(f.child.id)}").put("cards", f.api.call("GET", "/api/cards?child_id=${enc(f.child.id)}").optJSONArray("cards")).put("archive", f.api.call("GET", "/api/tree/archive?child_id=${enc(f.child.id)}"))
            else -> JSONObject().put("ledger", JSONArray(f.cloud.rows("bt_ledger", "child_id=eq.${enc(f.child.id)}&select=*&order=created_at.desc&limit=200")))
        }
    }
    LaunchedEffect(f, type) { load() }
    fun back() { if (f.busy) return; if (f.page == "list") vm.home() else { f.page = "list"; f.photos = emptyList(); load() } }
    if (type == "drawing" && f.page == "steps" && f.selected != null) {
        val drawing = f.selected!!
        val steps = instructions.optJSONObject(drawing.optString("id"))?.let { it.optJSONArray(f.child.language) ?: it.optJSONArray("en") }
        DrawingStudio(
            title = drawing.optString("name_${f.child.language}").ifBlank { drawing.optString("name_en") },
            url = drawingUrl(f, drawing, ageGroup, f.index, false),
            step = f.index, count = drawing.optInt("step_count"),
            instruction = steps?.optString(f.index - 1).orEmpty(),
            onBack = ::back, onPrevious = { f.index-- },
            onNext = { if (f.index < drawing.optInt("step_count")) f.index++ else { f.photos = emptyList(); f.page = "upload" } }
        )
        return
    }
    FeaturePage(s(if (type == "gems") "gems_history" else "task_$type"), ::back) {
        if (f.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (f.error != null) { Text(f.error!!, color = MaterialTheme.colorScheme.error); if (f.page == "list") TextButton(onClick = ::load) { Text(s.say("Retry", "Tekrar dene", "Reintentar")) } }
        f.notice?.let { Text(it) }
        when (type) {
            "homework" -> {
                if (f.page == "confirm-date") {
                    Text(s.say("Did you do this homework today?", "Bu ödevi bugün mü yaptın?", "¿Hiciste estos deberes hoy?"))
                    listOf(true, false).forEach { today -> Button(onClick = { f.work {
                        f.api.call("POST", "/api/homework/${enc(f.selected!!.getString("submissionId"))}/confirm-date", JSONObject().put("doneToday", today)); f.page = "list"; f.photos = emptyList(); f.notice = s.say("Sent for review", "İncelemeye gönderildi", "Enviado para revisión"); f.data = f.api.call("GET", "${f.path}/homework")
                    } }, enabled = !f.busy) { Text(if (today) s.say("Yes", "Evet", "Sí") else s.say("No", "Hayır", "No")) } }
                } else {
                    Text(s.say("Photograph your completed homework. Your grown-up will review it.", "Tamamladığın ödevin fotoğrafını çek. Ebeveynin inceleyecek.", "Fotografía tus deberes terminados. Tu familia los revisará."))
                    PhotoInput(f)
                    BigButton(s.say("Send homework", "Ödevi gönder", "Enviar deberes"), enabled = !f.busy && f.photos.isNotEmpty()) { f.work {
                        val paths = JSONArray(); f.photos.forEachIndexed { i, photo -> paths.put(f.cloud.upload("submission-photos", "${f.child.id}/homework/${UUID.randomUUID()}-$i.jpg", photo.bytes(), photo.mime)) }
                        val r = f.api.call("POST", "${f.path}/homework", JSONObject().put("paths", paths).put("file_modified_at", JSONArray(f.photos.map { it.modified ?: JSONObject.NULL })))
                        f.selected = r
                        if (r.optBoolean("needsDateConfirm")) f.page = "confirm-date" else { f.photos = emptyList(); f.notice = s.say("Sent for review", "İncelemeye gönderildi", "Enviado para revisión"); f.data = f.api.call("GET", "${f.path}/homework") }
                    } }
                    Text(s.say("This week", "Bu hafta", "Esta semana"), style = MaterialTheme.typography.titleLarge)
                    f.data.optJSONArray("submissions").objects().forEach { row -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text(row.optString("date")); Text("${row.optInt("pages")} · ${statusText(row.optString("status"), s)}") } } }
                }
            }
            "drawing" -> when (f.page) {
                "list" -> {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = { f.selected = null; f.photos = emptyList(); f.page = "upload" }) { Text(s.say("Free drawing", "Serbest çizim", "Dibujo libre")) }
                        TextButton(onClick = { f.page = "gallery" }) { Text(s.say("My drawings", "Çizimlerim", "Mis dibujos")) }
                    }
                    BoxWithConstraints(Modifier.fillMaxWidth()) {
                        val cols = (maxWidth.value / 260).toInt().coerceIn(1, 4)
                        Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                            f.data.optJSONArray("drawings").objects().chunked(cols).forEach { row ->
                                Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                                    row.forEach { drawing ->
                                        Card(onClick = { f.selected = drawing; f.index = 1; f.page = "steps" }, modifier = Modifier.weight(1f)) {
                                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                                RemotePhoto(drawingUrl(f, drawing, ageGroup, drawing.optInt("step_count"), true), Modifier.fillMaxWidth().height(200.dp))
                                                Text(drawing.optString("name_${f.child.language}").ifBlank { drawing.optString("name_en") }, style = MaterialTheme.typography.titleLarge)
                                                Text("${drawing.optInt("step_count")} " + s.say("steps", "adım", "pasos"))
                                            }
                                        }
                                    }
                                    repeat(cols-row.size) { Spacer(Modifier.weight(1f)) }
                                }
                            }
                        }
                    }
                }
                "steps" -> {
                    val drawing = f.selected ?: return@FeaturePage
                    Text(drawing.optString("name_${f.child.language}").ifBlank { drawing.optString("name_en") }, style = MaterialTheme.typography.headlineSmall)
                    Text("${f.index} / ${drawing.optInt("step_count")}")
                    RemotePhoto(drawingUrl(f, drawing, ageGroup, f.index, false))
                    val steps = instructions.optJSONObject(drawing.optString("id"))?.let { it.optJSONArray(f.child.language) ?: it.optJSONArray("en") }
                    steps?.optString(f.index - 1)?.let { Text(it, style = MaterialTheme.typography.titleLarge) }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        TextButton(onClick = { f.index-- }, enabled = f.index > 1) { Text(s.say("Previous", "Önceki", "Anterior")) }
                        Button(onClick = { if (f.index < drawing.optInt("step_count")) f.index++ else { f.photos = emptyList(); f.page = "upload" } }) { Text(s.say("Next", "Sonraki", "Siguiente")) }
                    }
                }
                "upload" -> {
                    PhotoInput(f, 1)
                    BigButton(s.say("I've drawn it", "Çizdim", "Ya lo he dibujado"), enabled = !f.busy && f.photos.size == 1) { f.work {
                        val image = f.photos.single().modelImage()
                        val r = f.api.call("POST", "${f.path}/paintings", JSONObject().put("photo_base64", image.base64).put("mime_type", image.mime).put("drawing_id", f.selected?.optString("id") ?: JSONObject.NULL).put("age_group", if (f.selected == null) JSONObject.NULL else ageGroup))
                        f.evaluation = r; f.page = "drawing-sent"; f.photos = emptyList()
                    } }
                }
                "drawing-sent" -> { Tuto(Modifier.size(180.dp), cheerKey = 1); Text(statusText(f.evaluation?.optJSONObject("painting")?.optString("status") ?: "pending", s)); Button(onClick = { f.work { f.data = JSONObject(f.data.toString()).put("paintings", f.api.call("GET", "${f.path}/paintings").optJSONArray("paintings")); f.page = "gallery" } }) { Text(s.say("My drawings", "Çizimlerim", "Mis dibujos")) } }
                "gallery" -> f.data.optJSONArray("paintings").objects().forEach { p ->
                    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { RemotePhoto(p.optStringOrNull("photo")); Text(statusText(p.optString("status"), s)); Text(p.optString("created_at").take(10)); TextButton(onClick = { confirmDelete = p.getString("id") }, enabled = !f.busy) { Text(s.say("Delete", "Sil", "Eliminar")) } } }
                }
            }
            "tree" -> {
                val today = f.data.optInt("today")
                Text("🌳 ${f.data.optInt("monthTreeCount")} · $today " + s.say("contributions today", "bugünkü katkı", "aportaciones hoy"), style = MaterialTheme.typography.headlineSmall)
                f.data.optJSONArray("cards").objects().forEach { card ->
                    OutlinedButton(onClick = { f.selected = card; f.title = card.optString("label"); f.photos = emptyList(); f.page = "entry" }, enabled = !f.busy) { Text(card.optString("icon") + " " + card.optString("label")) }
                }
                if (f.page != "entry") Button(onClick = { f.selected = null; f.title = ""; f.photos = emptyList(); f.page = "entry" }) { Text(s.say("Add to my diary", "Günlüğüme ekle", "Añadir a mi diario")) }
                if (f.page == "entry") {
                    OutlinedTextField(f.title, { f.title = it.take(200) }, label = { Text(s.say("What did you do?", "Ne yaptın?", "¿Qué hiciste?")) }, modifier = Modifier.fillMaxWidth())
                    if (f.selected == null || f.selected?.optBoolean("photo_ok") == true) PhotoInput(f, 1)
                    Button(onClick = { f.work {
                        val photo = f.photos.firstOrNull()?.let { f.cloud.upload("submission-photos", "${f.child.id}/diary/${UUID.randomUUID()}.jpg", it.bytes(), it.mime) }
                        f.api.call("POST", "/api/contributions", JSONObject().put("child_id", f.child.id).put("label", f.title).put("source", if (f.selected == null) "free_text" else "card").put("category", f.selected?.optString("category") ?: "outside").put("photo_url", photo ?: JSONObject.NULL))
                        f.page = "list"; f.photos = emptyList(); f.data = f.api.call("GET", "/api/tree?child_id=${enc(f.child.id)}").put("cards", f.data.optJSONArray("cards")).put("archive", f.data.optJSONObject("archive"))
                    } }, enabled = !f.busy && f.title.isNotBlank()) { Text(s.say("Save entry", "Kaydet", "Guardar")) }
                }
                Text(s.say("My diary", "Günlüğüm", "Mi diario"), style = MaterialTheme.typography.titleLarge)
                f.data.optJSONArray("listItems").objects().forEach { e -> Text("${e.optString("date")} · ${e.optString("label")} · ${statusText(e.optString("status"), s)}") }
                Text(s.say("My forest", "Ormanım", "Mi bosque"), style = MaterialTheme.typography.titleLarge)
                f.data.optJSONObject("archive")?.let { archive ->
                    Text("🌳 ${archive.optInt("allTimeTrees")}")
                    archive.optJSONArray("months").objects().forEach { m -> Text("${m.optString("month")} · ${m.optInt("trees")} 🌳") }
                }
            }
            "gems" -> if (f.page == "review") {
                val r = f.selected ?: return@FeaturePage
                Text(r.optString("at").take(10)); Text("${r.optInt("correct")} / ${r.optInt("total")}")
                if (r.optString("kind") == "math") r.optJSONArray("items").objects().forEachIndexed { i, q ->
                    Text("${i+1}. ${q.optString("question")}")
                    Text(s.say("Your answer", "Cevabın", "Tu respuesta") + ": " + q.optString("child_answer").takeUnless { it == "null" }.orEmpty())
                    Text("✓ " + q.optString("correct_answer"))
                } else if (r.optString("kind") == "puzzle") {
                    if (r.isNull("questions")) Text(s.say("The original questions are no longer available; this is the recorded score.", "İlk sorular artık görüntülenemiyor; bu kaydedilmiş sonuç.", "Las preguntas originales ya no están disponibles; esta es la puntuación guardada."))
                    r.optJSONArray("questions").objects().forEachIndexed { i, q -> PuzzleHistory(vm, q, r.optJSONArray("answers")?.optJSONObject(i)) }
                } else r.optJSONArray("questions").objects().forEachIndexed { i, q ->
                    Text("${i + 1}. ${s(q.optString("stem_key"))}")
                    if (r.optString("kind") == "english") Text(englishPrompt(q, s))
                    val a = r.optJSONArray("answers")?.optJSONObject(i)
                    val options = q.optJSONArray("options").objects()
                    Text(s.say("Your answer", "Cevabın", "Tu respuesta") + ": " + a?.optJSONArray("chosen").ints().mapNotNull { options.getOrNull(it)?.optString("text") }.joinToString(" · "))
                    Text("✓ " + a?.optJSONArray("correct_indices").ints().mapNotNull { options.getOrNull(it)?.optString("text") }.joinToString(" · "))
                }
            } else {
                val rows = f.data.optJSONArray("ledger").objects()
                Text(s.say("Balance", "Bakiye", "Saldo") + ": ${vm.today.gems}", style = MaterialTheme.typography.headlineSmall)
                rows.forEach { row -> Card(onClick = { if (row.optString("reason") in setOf("math", "math_review", "puzzle", "puzzle_review", "english", "english_review")) f.work { f.selected = f.api.call("GET", "${f.path}/review/${enc(row.getString("id"))}?lang=${enc(f.child.language)}"); f.page = "review" } }, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) {
                    Text(s("task_${row.optString("reason")}")); Text(row.optString("created_at").take(10)); Text(if (row.optBoolean("capped")) s("math_capped") else "${row.optInt("amount")} ${s("math_gems_word")}")
                } } }
            }
        }
    }
    confirmDelete?.let { id -> AlertDialog(onDismissRequest = { confirmDelete = null }, title = { Text(s.say("Delete drawing?", "Çizim silinsin mi?", "¿Eliminar dibujo?")) }, confirmButton = { TextButton(onClick = { confirmDelete = null; f.work { f.api.call("DELETE", "${f.path}/paintings/${enc(id)}"); f.data = JSONObject(f.data.toString()).put("paintings", f.api.call("GET", "${f.path}/paintings").optJSONArray("paintings")) } }) { Text(s.say("Delete", "Sil", "Eliminar")) } }, dismissButton = { TextButton(onClick = { confirmDelete = null }) { Text(s.say("Cancel", "Vazgeç", "Cancelar")) } }) }
}
private fun drawingUrl(f: FeatureRun, d: JSONObject, group: String, step: Int, thumb: Boolean): String = "${f.cloud.base}/storage/v1/render/image/public/drawings/${enc(d.getString("id"))}/${enc(group)}/step-${step.toString().padStart(2, '0')}.webp?width=${if (thumb) 320 else 1024}&height=${if (thumb) 320 else 1024}&resize=contain&quality=80"
internal fun statusText(status: String, s: Strings) = when (status) {
    "approved" -> s.say("Approved", "Onaylandı", "Aprobado")
    "rejected" -> s.say("Needs another look", "Tekrar gözden geçir", "Revisar de nuevo")
    "pending" -> s.say("Waiting for your grown-up", "Ebeveyn onayı bekleniyor", "Esperando a tu familia")
    else -> status
}

@OptIn(ExperimentalLayoutApi::class)
@Composable private fun PuzzleHistory(vm: TutoViewModel, raw: JSONObject, answer: JSONObject?) {
    val q = remember(raw) { PuzzleQuestion.from(raw) }
    val s = LocalStrings.current
    var pictures by remember(raw) { mutableStateOf<List<String?>>(emptyList()) }
    LaunchedEffect(raw) { pictures = vm.engine.drawPuzzle(q.prompt + q.options.map { it.spec }, 200) }
    Text(s(q.stemKey),style=MaterialTheme.typography.titleLarge)
    PuzzlePrompt(q,pictures.take(q.prompt.size))
    FlowRow(horizontalArrangement=Arrangement.spacedBy(12.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) { q.options.forEachIndexed { i, option ->
        Card(Modifier.width(150.dp)) { Column(Modifier.padding(8.dp)) {
            pictures.getOrNull(q.prompt.size+i)?.let { SvgFigure(it,Modifier.size(130.dp)) }
            Text(option.code ?: "${i+1}")
            if(answer?.optInt("chosen_index",-1)==i) Text(s.say("Your choice","Senin seçimin","Tu elección"))
            if(answer?.optInt("correct_index",-1)==i) Text("✓")
        } }
    } }
    answer?.optStringOrNull("why")?.let { Text(it) }
}

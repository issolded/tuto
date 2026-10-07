package app.tuto.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.tuto.mobile.*
import app.tuto.mobile.data.*
import org.json.JSONArray
import org.json.JSONObject

internal fun JSONArray?.strings(): List<String> = if (this == null) emptyList() else (0 until length()).map { optString(it) }
internal fun JSONArray?.ints(): List<Int> = if (this == null) emptyList() else (0 until length()).map { optInt(it) }

@Composable
fun FeaturePage(title: String, onBack: () -> Unit, showHeader: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 1240.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(if (maxWidth < 600.dp) 18.dp else 32.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            if (showHeader) Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                TextButton(onClick = onBack) { Text(LocalStrings.current.say("Back", "Geri", "Atrás")) }
                Text(title, style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
            }
            content()
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable fun FailureMessage(retry: (() -> Unit)? = null) {
    val s = LocalStrings.current
    Text(s.say("Couldn't complete the request. Your work is still here. Check your connection and try again.", "İstek tamamlanamadı. Çalışman burada duruyor. Bağlantını kontrol edip tekrar dene.", "No se pudo completar. Tu trabajo sigue aquí. Revisa la conexión e inténtalo de nuevo."), color = MaterialTheme.colorScheme.error)
    if (retry != null) TextButton(onClick = retry) { Text(s.say("Try again", "Tekrar dene", "Reintentar")) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable fun EnglishScreen(vm: TutoViewModel) {
    val run = vm.english ?: return
    val s = LocalStrings.current
    LaunchedEffect(run) { if (run.session == null) run.start() }
    FeaturePage(s("task_english"), { vm.home() }) {
        if (run.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (run.error) FailureMessage(if (run.phase == EnglishRun.Phase.Failed) ({ run.retry() }) else null)
        when (run.phase) {
            EnglishRun.Phase.Loading, EnglishRun.Phase.Finishing -> Text(s.say("Getting your session ready…", "Oturumun hazırlanıyor…", "Preparando tu sesión…"))
            EnglishRun.Phase.Failed -> Unit
            EnglishRun.Phase.Welcome -> {
                Tuto(Modifier.size(180.dp))
                Text(s("english_welcome"), style = MaterialTheme.typography.headlineSmall)
                Text("${run.questions.size} " + s.say("questions", "soru", "preguntas"))
                BigButton(s("math_lets_go"), Modifier.testTag("english-begin")) { run.begin() }
            }
            EnglishRun.Phase.Asking -> {
                val q = run.question ?: return@FeaturePage
                Text("${run.index + 1} / ${run.questions.size}", style = MaterialTheme.typography.titleLarge)
                Text(s(q.optString("stem_key")), style = MaterialTheme.typography.headlineSmall)
                Text(englishPrompt(q, s), style = MaterialTheme.typography.headlineSmall)
                val options = q.optJSONArray("options").objects()
                val correct = run.answer?.optJSONArray("correct_indices").ints()
                if (run.need > 1) Text(s("english_pick_two"))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    options.forEachIndexed { i, option ->
                        Button(onClick = { run.pick(i) }, enabled = !run.busy && run.answer == null && i !in run.struck,
                            colors = ButtonDefaults.buttonColors(containerColor = when { i in correct -> Ink.green; i in run.picked -> Color(0xFFD9577A); else -> Ink.lilacSoft }, contentColor = Ink.main),
                            modifier = Modifier.testTag("english-option-$i").widthIn(min = 120.dp).heightIn(min = 64.dp)) { Text(option.optString("text"), style = MaterialTheme.typography.titleLarge) }
                    }
                }
                run.hints.forEach { h ->
                    if (h.optString("text").isNotBlank()) Text(h.optString("text"))
                    h.optJSONArray("steps").strings().forEach { Text(it) }
                    if (h.has("eliminate") && !h.isNull("eliminate")) {
                        Text(englishWhy(q, h.optString("why"), h.optInt("eliminate"), s))
                    }
                    h.optJSONObject("visual")?.let { EnglishVisual(it) }
                }
                if (run.retryNeeded) Text(s.say("Try another answer or ask for a hint.", "Başka bir cevap dene ya da ipucu iste.", "Prueba otra respuesta o pide una pista."))
                if (run.answer == null) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = { run.hint() }, enabled = !run.busy && run.hints.size < 3) { Text(s.say("Hint", "İpucu", "Pista")) }
                        if (run.picked.isEmpty()) TextButton(onClick = { run.send(true) }, enabled = !run.busy) { Text(s("rd_skip")) }
                    }
                    BigButton(s("puzzle_send"), Modifier.testTag("english-send"), enabled = !run.busy && run.picked.size == run.need) { run.send() }
                } else {
                    val a = run.answer!!
                    Text(if (a.optBoolean("correct")) s("math_yes") else correct.mapNotNull { options.getOrNull(it)?.optString("text") }.joinToString(" · "), style = MaterialTheme.typography.headlineSmall)
                    a.optJSONArray("explain").strings().forEach { Text(it) }
                    a.optJSONArray("why").objects().forEach { Text(englishWhy(q, it.optString("key"), it.optInt("index"), s)) }
                    a.optJSONObject("explain_visual")?.let { EnglishVisual(it) }
                    BigButton(s.say("Next", "Sonraki", "Siguiente"), Modifier.testTag("english-next")) { run.next() }
                }
            }
            EnglishRun.Phase.Result -> {
                val r = run.result ?: return@FeaturePage
                Tuto(Modifier.size(180.dp), cheerKey = 1)
                Text("${r.optInt("correct")} / ${r.optInt("total", r.optInt("asked", run.questions.size))}", style = MaterialTheme.typography.headlineLarge)
                Text(if (r.optBoolean("capped")) s("math_capped") else "+${r.optInt("gems_earned")} ${s("math_gems_word")}")
                if (r.optJSONObject("review") != null) {
                    val offer = r.getJSONObject("review")
                    Text(s.say("Practise ${offer.optInt("count")} new questions · up to ${offer.optInt("max_gems")} gems", "${offer.optInt("count")} yeni soruyla pekiştir · en fazla ${offer.optInt("max_gems")} gem", "Repasa ${offer.optInt("count")} preguntas nuevas · hasta ${offer.optInt("max_gems")} gems"))
                    BigButton(s.say("Practise", "Pekiştir", "Repasar"), enabled = !run.busy) { run.practise() }
                    TextButton(onClick = { vm.home() }, enabled = !run.busy) { Text(s.say("Not now", "Şimdi değil", "Ahora no")) }
                }
                run.questions.forEachIndexed { i, q ->
                    val a = run.answers.getOrNull(i)
                    HorizontalDivider()
                    Text("${i + 1}. ${s(q.optString("stem_key"))}")
                    Text(englishPrompt(q, s))
                    val options = q.optJSONArray("options").objects()
                    Text(a?.optJSONArray("chosen").ints().mapNotNull { options.getOrNull(it)?.optString("text") }.joinToString(" · "))
                    Text("✓ " + a?.optJSONArray("correct_indices").ints().mapNotNull { options.getOrNull(it)?.optString("text") }.joinToString(" · "))
                }
            }
        }
    }
}

internal fun englishWhy(q: JSONObject, key: String, index: Int, s: Strings): String {
    val base = "eng_why_" + key.replace('-', '_')
    val specific = base + "__" + q.optString("type").replace('-', '_')
    val why = if (key.startsWith("syllables-")) s("eng_why_syllables").replace("%n%", key.substringAfter('-')) else s(specific).takeIf { it != specific } ?: s(base).takeIf { it != base } ?: s.say("Look at this word again.", "Bu kelimeye tekrar bak.", "Mira esta palabra otra vez.")
    return q.optJSONArray("options")?.optJSONObject(index)?.optString("text").orEmpty() + ": " + why
}

internal fun englishPrompt(q: JSONObject, s: Strings): String {
    val p = q.optJSONObject("prompt") ?: return ""
    fun v(k: String) = p.optString(k)
    fun arr(k: String) = p.optJSONArray(k).strings()
    return when (q.optString("type")) {
        "sense", "hidden-word", "homophone-cloze", "grammar-cloze", "proverb" -> v("sentence")
        "comparative" -> v("sentence") + " (" + v("word") + ")"
        "shared-letters" -> arr("blanks").joinToString("    ")
        "letter-pair" -> "${v("word")}  ${s(if (p.optBoolean("opposite")) "eng_pair_opposite" else "eng_pair_similar")}  ${v("masked")}"
        "word-grid" -> s(if (p.optBoolean("opposite")) "eng_grid_opposite" else "eng_grid_similar") + " “${v("word")}”"
        "odd-two", "odd-synonym", "letters-in-order", "anagram-pair", "misspelt" -> ""
        "definition" -> v("definition")
        "missing-vowel", "ending", "ie-ei", "silent-letter" -> v("masked")
        "syllables" -> "${v("count")} ${s("eng_syllable_beats")}"
        "suffix" -> "${v("word")} + ${v("suffix")}"
        "prefix-antonym" -> "___${v("word")}"
        "letter-code" -> "${v("key")} = ${v("keyCode")}\n${v(if (p.optBoolean("decode")) "code" else "word")} = ?"
        "front-letter", "compound-front" -> arr("tails").joinToString("    ") { "___$it" }
        "alpha-order" -> listOf("", "1st", "2nd", "3rd", "4th", "5th").getOrElse(p.optInt("nth")) { p.optString("nth") }
        "join-letter" -> "${v("left")} ( _ ) ${v("right")}"
        "change-pattern" -> (p.optJSONArray("pairs")?.let { a -> (0 until a.length()).map { a.getJSONArray(it).strings().joinToString(" → ") } } ?: emptyList()).joinToString("\n") + "\n${v("word")} → ?"
        "word-ladder" -> "${v("from")} → ? → ${v("to")}"
        "not-from-letters", "unscramble" -> v("letters").ifBlank { v("word") }.uppercase()
        "letter-analogy" -> "${v("a")} is to ${v("b")} as ${v("c")} is to ?\nABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "analogy" -> "${v("a")} is to ${v("A")} as ${v("b")} is to ?"
        "rhyme-synonym" -> "${v("word")} ${s("eng_rhymes_with")} ${v("rhyme")}"
        "pair-meaning" -> s(if (p.optBoolean("opposite")) "eng_pair_most_opposite" else "eng_pair_most_similar")
        "logic-grid" -> arr("lines").joinToString("\n") + "\n" + v("question")
        "letter-sum" -> "${v("table")}\n${v("sum")} = ?"
        "apostrophe" -> v("phrase")
        "collective" -> "a _____ of ${v("word")}"
        else -> v("word")
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable private fun EnglishVisual(v: JSONObject) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        when (v.optString("kind")) {
            "alphabet" -> {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) { ('A'..'Z').forEach { ch -> Text(ch.toString(), color = if (v.optJSONObject("marks")?.has(ch.toString()) == true) Color(0xFFD9577A) else Ink.soft) } }
                (v.optJSONArray("rows").objects() + v.optJSONArray("question").objects()).forEach { Text("${it.optString("from")} → ${it.optString("shift", "?")} → ${it.optString("to", "?")}") }
                v.optJSONObject("numbers")?.let { Text("${it.optString("from")} → ${it.optString("to")} · ${it.optString("ask")} → ${it.optString("ans", "?")}") }
            }
            "keytable" -> {
                val pairs = v.optJSONArray("pairs") ?: JSONArray()
                FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) { for (i in 0 until pairs.length()) Text(pairs.getJSONArray(i).strings().joinToString("\n")) }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) { v.optJSONArray("line").objects().forEach { Text("${it.optString("top")}\n↓\n${if (it.isNull("bottom")) "?" else it.optString("bottom")}") } }
                v.optJSONObject("expr")?.let { Text("${it.optString("named")} = ${it.optString("left")} = ${if (it.isNull("right")) "?" else it.optString("right")}") }
            }
            "diff" -> { v.optJSONArray("rows").objects().forEach { Text("${it.optString("from")} → ${it.optString("to")}") }; Text("${v.optString("word")} → ${v.optString("answer", "?")}") }
            "ladder" -> Text("${v.optString("from")}\n↓\n${v.optString("middle", "?")}\n↓\n${v.optString("to")}")
            "grid" -> {
                Text(" · " + v.optJSONArray("cols").strings().joinToString(" · "))
                v.optJSONArray("rows").strings().forEachIndexed { i, row -> Text(row + " · " + v.optJSONArray("cells")?.optJSONArray(i).strings().joinToString(" · ")) }
            }
        }
    }
}

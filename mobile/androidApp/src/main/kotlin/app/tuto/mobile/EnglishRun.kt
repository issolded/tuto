package app.tuto.mobile

import androidx.compose.runtime.*
import app.tuto.mobile.data.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/** Answers and rewards are authoritative server responses, including two-choice questions. */
class EnglishRun(private val scope: CoroutineScope, private val api: TutoApi, val child: Child) {
    enum class Phase { Loading, Welcome, Asking, Finishing, Result, Failed }
    var phase by mutableStateOf(Phase.Loading); private set
    var session by mutableStateOf<JSONObject?>(null); private set
    var index by mutableIntStateOf(0); private set
    var picked by mutableStateOf<List<Int>>(emptyList()); private set
    var struck by mutableStateOf<Set<Int>>(emptySet()); private set
    var hints by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var answers by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var result by mutableStateOf<JSONObject?>(null); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf(false); private set
    var retryNeeded by mutableStateOf(false); private set
    private var retryAction: () -> Unit = { start() }
    val questions get() = session?.optJSONArray("questions").objects()
    val question get() = questions.getOrNull(index)
    val answer get() = answers.getOrNull(index)
    val need get() = question?.optInt("pick", 1) ?: 1
    val review get() = session?.optBoolean("review") == true
    private val cid get() = "/api/children/${child.id}"
    private val sid get() = session!!.getString("session_id")
    fun start() = load(null)
    fun begin() { phase = Phase.Asking }
    fun retry() { retryAction() }
    private fun load(offer: JSONObject?) {
        if (busy) return
        busy = true; error = false; phase = Phase.Loading; retryAction = { load(offer) }
        scope.launch {
            runCatching {
                val path = if (offer == null) "$cid/english-session" else "$cid/english-review/${offer.getString("id")}/start"
                api.call("POST", path).apply { if (offer != null) put("review", true).put("max_gems", offer.optInt("max_gems")) }
            }.onSuccess {
                if (it.optJSONArray("questions").objects().isEmpty()) { error = true; phase = Phase.Failed }
                else { session = it; index = 0; answers = emptyList(); result = null; resetQuestion(); phase = Phase.Welcome }
            }.onFailure { error = true; phase = Phase.Failed }
            busy = false
        }
    }
    private fun resetQuestion() { picked = emptyList(); struck = emptySet(); hints = emptyList(); retryNeeded = false; error = false }
    fun pick(i: Int) {
        if (busy || answer != null || i in struck) return
        picked = if (need == 1) listOf(i) else if (i in picked) picked - i else (picked + i).takeLast(need)
    }
    fun hint() {
        if (busy || answer != null || hints.size >= 3) return
        busy = true; error = false
        scope.launch {
            runCatching { api.call("POST", "/api/english-sessions/$sid/hint", JSONObject().put("question_index", index).put("chosen", JSONArray(picked))) }
                .onSuccess { h ->
                    hints = hints + h
                    if (h.has("eliminate") && !h.isNull("eliminate")) { val i = h.getInt("eliminate"); struck = struck + i; picked = picked - i }
                }.onFailure { error = true }
            busy = false
        }
    }
    fun send(skip: Boolean = false) {
        if (busy || answer != null || (!skip && picked.size != need) || (skip && picked.isNotEmpty())) return
        busy = true; error = false
        scope.launch {
            runCatching { api.call("POST", "/api/english-sessions/$sid/answer", JSONObject().put("question_index", index).put("chosen", JSONArray(picked)).put("skip", skip)) }
                .onSuccess {
                    if (it.optBoolean("retry")) { if (need == 1) struck = struck + picked; picked = emptyList(); retryNeeded = true }
                    else { answers = answers + it.apply { if (!has("chosen")) put("chosen", JSONArray(picked)) }; retryNeeded = false }
                }.onFailure { error = true }
            busy = false
        }
    }
    fun next() {
        if (busy || answer == null) return
        if (index + 1 < questions.size) { index++; resetQuestion() } else finish()
    }
    private fun finish() {
        if (busy) return
        busy = true; phase = Phase.Finishing; retryAction = { finish() }
        scope.launch {
            runCatching { api.call("POST", if (review) "$cid/english-review/$sid/finish" else "/api/english-sessions/$sid/finish") }
                .onSuccess { result = it; phase = Phase.Result }.onFailure { error = true; phase = Phase.Failed }
            busy = false
        }
    }
    fun practise() { result?.optJSONObject("review")?.let { load(it) } }
    fun close(done: () -> Unit) {
        if (busy) return
        val id = result?.optJSONObject("review")?.optString("id") ?: if (review && phase != Phase.Result) sid else null
        if (id == null) { done(); return }
        busy = true; error = false
        scope.launch {
            runCatching { api.call("POST", "$cid/english-review/$id/decline") }.onSuccess { done() }.onFailure { error = true }
            busy = false
        }
    }
}

package app.tuto.mobile

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.tuto.mobile.data.Child
import app.tuto.mobile.data.PuzzleRenderer
import app.tuto.mobile.data.PuzzleAnswer
import app.tuto.mobile.data.PuzzleQuestion
import app.tuto.mobile.data.PuzzleResult
import app.tuto.mobile.data.PuzzleSession
import app.tuto.mobile.data.TutoApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * One puzzle sitting, as PuzzleScreen runs it: the server deals ten questions without their
 * answers, checks each tap, and on finish counts the score from what it recorded and pays.
 * A tap selects, Send commits; a right answer moves on by itself, a wrong one waits for the child.
 */
class PuzzleRun(
    private val scope: CoroutineScope,
    private val api: TutoApi,
    private val engine: PuzzleRenderer,
    val child: Child,
) {
    enum class Phase { Loading, Welcome, Asking, Finishing, Result, Failed }

    var phase by mutableStateOf(Phase.Loading)
        private set
    var session by mutableStateOf<PuzzleSession?>(null)
        private set
    var index by mutableIntStateOf(0)
        private set
    var picked by mutableStateOf<Int?>(null)
        private set
    var answer by mutableStateOf<PuzzleAnswer?>(null)
        private set
    var sending by mutableStateOf(false)
        private set
    var sendFailed by mutableStateOf(false)
        private set
    var retryNeeded by mutableStateOf(false)
        private set
    var result by mutableStateOf<PuzzleResult?>(null)
        private set
    var cheerKey by mutableIntStateOf(0)
        private set
    /** SVG for each question: prompt figures, then option figures, in the order the server sent them. */
    var drawings by mutableStateOf<List<Drawn>>(emptyList())
        private set

    data class Drawn(val prompt: List<String?>, val options: List<String?>)

    val question: PuzzleQuestion? get() = session?.questions?.getOrNull(index)
    val total get() = session?.questions?.size ?: 0
    private var advanceJob: Job? = null

    var hints by mutableStateOf<List<String>>(emptyList())
        private set
    var hintCount by mutableIntStateOf(0)
        private set
    var struck by mutableStateOf<Set<Int>>(emptySet())
        private set
    private var reviewDismissed = false
    private var retryAction: () -> Unit = { start() }
    val reviewToClose: String? get() = if (reviewDismissed) null else result?.review?.optString("id")
        ?: session?.takeIf { it.review && phase != Phase.Result }?.sessionId

    fun retry() = retryAction()
    fun startReview() { result?.review?.optString("id")?.let { load(it) } }
    fun start() = load(null)

    private fun load(reviewId: String?) {
        retryAction = { load(reviewId) }
        phase = Phase.Loading
        scope.launch {
            val s = runCatching { if (reviewId == null) api.startPuzzle(child.id) else api.startPuzzleReview(child.id, reviewId).copy(gems = result?.review?.optInt("max_gems") ?: 0, willPay = (result?.review?.optInt("max_gems") ?: 0) > 0) }.getOrNull()
            val drawn = s?.let { sess ->
                runCatching {
                    sess.questions.map { q ->
                        val specs = q.prompt + q.options.map { it.spec }
                        val svgs = engine.drawPuzzle(specs, 96)
                        Drawn(svgs.take(q.prompt.size), svgs.drop(q.prompt.size))
                    }
                }.getOrNull()
            }
            if (s == null || drawn == null || s.questions.isEmpty()) { phase = Phase.Failed; return@launch }
            session = s; drawings = drawn
            index = 0; picked = null; answer = null; result = null
            hints = emptyList(); hintCount = 0; struck = emptySet(); retryNeeded = false; reviewDismissed = false; sendFailed = false
            phase = Phase.Welcome
        }
    }

    fun begin() { phase = Phase.Asking }

    fun pick(i: Int) {
        if (sending || answer != null || i in struck) return
        picked = i
        sendFailed = false
    }

    fun send(skip: Boolean = false) {
        val s = session ?: return
        val i = if (skip) -1 else picked ?: return
        if (sending || answer != null) return
        sending = true; sendFailed = false
        scope.launch {
            runCatching { api.answerPuzzle(s.sessionId, index, i, child.language, skip) }
                .onSuccess { r ->
                    if (r.retry) {
                        // The latest server has not settled this question yet. Advancing here
                        // silently dropped the child's answer and lost the chance to retry.
                        retryNeeded = true
                        struck = struck + i
                        picked = null
                        return@onSuccess
                    }
                    retryNeeded = false
                    answer = r
                    if (r.correct) { cheerKey++; advanceJob = scope.launch { delay(1400); next() } }
                }
                .onFailure { sendFailed = true }
            sending = false
        }
    }

    fun next() {
        advanceJob?.cancel()
        if (answer == null) return
        if (index >= total - 1) finish() else { index++; picked = null; answer = null; hints = emptyList(); hintCount = 0; struck = emptySet(); retryNeeded = false }
    }

    private fun finish() {
        val s = session ?: return
        retryAction = { finish() }
        phase = Phase.Finishing
        scope.launch {
            runCatching { if (s.review) api.finishPuzzleReview(child.id, s.sessionId) else api.finishPuzzle(s.sessionId) }
                .onSuccess { result = it; phase = Phase.Result }
                .onFailure { phase = Phase.Failed }
        }
    }
    fun hint() {
        val s = session ?: return
        if (sending || answer != null || hintCount >= 3) return
        sending = true; sendFailed = false
        scope.launch {
            runCatching { api.puzzleHint(s.sessionId, index, child.language) }
                .onSuccess { h ->
                    hintCount++
                    if (h.has("text") && !h.isNull("text")) hints = hints + h.getString("text")
                    if (h.has("eliminate") && !h.isNull("eliminate")) {
                        val i = h.getInt("eliminate")
                        struck = struck + i
                        if (picked == i) picked = null
                    }
                }.onFailure { sendFailed = true }
            sending = false
        }
    }

    fun declineThen(onDone: () -> Unit) {
        val id = reviewToClose ?: return onDone()
        if (sending) return
        sending = true; sendFailed = false
        scope.launch {
            runCatching { api.declinePuzzleReview(child.id, id) }
                .onSuccess { reviewDismissed = true; onDone() }
                .onFailure { sendFailed = true }
            sending = false
        }
    }

}

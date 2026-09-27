package app.tuto.mobile

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.tuto.mobile.data.Child
import app.tuto.mobile.data.MathEngine
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
    private val engine: MathEngine,
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

    fun start() {
        phase = Phase.Loading
        scope.launch {
            val s = runCatching { api.startPuzzle(child.id) }.getOrNull()
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
            index = 0; picked = null; answer = null
            phase = Phase.Welcome
        }
    }

    fun begin() { phase = Phase.Asking }

    fun pick(i: Int) {
        if (sending || answer != null) return
        picked = i
        sendFailed = false
    }

    fun send() {
        val s = session ?: return
        val i = picked ?: return
        if (sending || answer != null) return
        sending = true; sendFailed = false
        scope.launch {
            runCatching { api.answerPuzzle(s.sessionId, index, i, child.language) }
                .onSuccess { r ->
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
        if (index >= total - 1) finish() else { index++; picked = null; answer = null }
    }

    private fun finish() {
        val s = session ?: return
        phase = Phase.Finishing
        scope.launch {
            runCatching { api.finishPuzzle(s.sessionId) }
                .onSuccess { result = it; phase = Phase.Result }
                .onFailure { phase = Phase.Failed }
        }
    }
}

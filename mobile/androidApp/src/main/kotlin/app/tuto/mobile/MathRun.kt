package app.tuto.mobile

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.tuto.mobile.data.Child
import app.tuto.mobile.data.MathEngine
import app.tuto.mobile.data.MathQuestion
import app.tuto.mobile.data.MathSaved
import app.tuto.mobile.data.MathSession
import app.tuto.mobile.data.Session
import app.tuto.mobile.data.TutoApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * One maths sitting, with MathScreen's rules:
 *  - the level and the topic weighting come from /math-plan (the server is the one authority);
 *  - the questions come from the web engine;
 *  - eight and under: a wrong answer opens help and the child may try again, or skip once helped;
 *  - nine and over: one attempt, then the answer and why;
 *  - the server records the sitting and decides the Gems, so the result shows what was banked.
 */
class MathRun(
    private val scope: CoroutineScope,
    private val api: TutoApi,
    private val engine: MathEngine,
    private val store: Session,
    val child: Child,
) {
    enum class Phase { Loading, Asking, Saving, Result, Failed }
    sealed interface Feedback {
        data object Correct : Feedback
        data class Wrong(val why: String?, val canRetry: Boolean) : Feedback
        data class Revealed(val answer: String, val why: String?) : Feedback
    }

    val young = child.age <= 8

    var phase by mutableStateOf(Phase.Loading)
        private set
    var session by mutableStateOf<MathSession?>(null)
        private set
    var index by mutableIntStateOf(0)
        private set
    var input by mutableStateOf("")
        private set
    var feedback by mutableStateOf<Feedback?>(null)
        private set
    /** How many of the current question's hints are showing. */
    var hintsShown by mutableIntStateOf(0)
        private set
    var cheerKey by mutableIntStateOf(0)
        private set
    var saved by mutableStateOf<MathSaved?>(null)
        private set
    var saveFailed by mutableStateOf(false)
        private set

    private val answers = mutableListOf<String?>()
    private val attempted = mutableMapOf<Int, String>()
    private val helpUsed = mutableSetOf<Int>()

    val question: MathQuestion? get() = session?.questions?.getOrNull(index)
    val total get() = session?.questions?.size ?: 0
    val correctCount get() = session?.questions?.indices?.count { MathEngine.sameAnswer(answers.getOrNull(it), session!!.questions[it].answer) } ?: 0
    fun answerAt(i: Int) = answers.getOrNull(i)

    fun start() {
        phase = Phase.Loading
        scope.launch {
            // A session with no weighting is still a good session; one that will not start is not.
            val plan = runCatching { api.mathPlan(child.id) }.getOrNull()
            val built = runCatching {
                val topics = store.seen("topics", child.id, "curriculum")
                engine.buildSession(child.age, plan, child.language, topics, store.seen("keys", child.id, "all"))
            }.getOrNull()
            if (built == null || built.questions.isEmpty()) { phase = Phase.Failed; return@launch }
            store.remember("keys", child.id, "all", built.questions.mapNotNull { it.operandKey })
            store.remember("topics", child.id, "curriculum", built.questions.mapNotNull { it.topicId })
            session = built
            index = 0; input = ""; feedback = null; hintsShown = 0
            answers.clear(); attempted.clear(); helpUsed.clear()
            phase = Phase.Asking
        }
    }

    fun type(key: String) {
        if (feedback is Feedback.Correct || feedback is Feedback.Revealed) return
        if (feedback is Feedback.Wrong) feedback = null
        input = when (key) {
            "⌫" -> input.dropLast(1)
            "." -> if (input.contains('.') || input.isEmpty()) input else "$input."
            else -> (input + key).take(7)
        }
    }

    fun hint() {
        val q = question ?: return
        if (hintsShown < q.hints.size) { hintsShown++; helpUsed += index }
    }

    fun submit(value: String = input) {
        val q = question ?: return
        if (value.isBlank() || feedback is Feedback.Correct || feedback is Feedback.Revealed) return
        if (MathEngine.sameAnswer(value, q.answer)) {
            answers.add(value)
            feedback = Feedback.Correct
            cheerKey++
            advanceSoon(1400)
            return
        }
        attempted[index] = value
        val why = q.options.firstOrNull { it.value == value }?.why
        if (young) {
            // Help opens with the first wrong try; each further wrong try shows one more step.
            helpUsed += index
            if (hintsShown < q.hints.size) hintsShown++
            feedback = Feedback.Wrong(why, canRetry = true)
            input = ""
        } else {
            answers.add(value)
            feedback = Feedback.Revealed(q.answer, why)
            advanceSoon(2600)
        }
    }

    /** Eight and under, after help: move on, and the question counts as not answered. */
    fun skip() {
        val q = question ?: return
        answers.add(null)
        feedback = Feedback.Revealed(q.answer, null)
        advanceSoon(1600)
    }

    private fun advanceSoon(ms: Long) {
        val at = index
        scope.launch {
            delay(ms)
            if (index != at || phase != Phase.Asking) return@launch
            if (index + 1 >= total) finish() else { index++; input = ""; feedback = null; hintsShown = 0 }
        }
    }

    private fun finish() {
        phase = Phase.Saving
        save()
    }

    fun save() {
        val s = session ?: return
        saveFailed = false
        scope.launch {
            val qs = s.questions
            val correct = correctCount
            val body = JSONObject()
                .put("level", s.level)
                .put("topics", JSONArray(qs.mapNotNull { it.topicName }.distinct()))
                .put("school_year", s.schoolYear)
                .put("attempts", JSONArray(qs.mapIndexedNotNull { i, q ->
                    val id = q.topicId ?: return@mapIndexedNotNull null
                    JSONObject()
                        .put("topic_id", id)
                        .put("topic_name", q.topicName ?: JSONObject.NULL)
                        .put("source", "template")
                        .put("question", q.question)
                        .put("child_answer", answers.getOrNull(i) ?: JSONObject.NULL)
                        .put("correct_answer", q.answer)
                        .put("correct", MathEngine.sameAnswer(answers.getOrNull(i), q.answer))
                        .put("help_used", i in helpUsed)
                }))
                .put("questions_total", qs.size)
                .put("questions_correct", correct)
                .put("accuracy", if (qs.isEmpty()) 0 else (correct * 100.0 / qs.size).roundToInt())
                .put("help_used", helpUsed.size)
            runCatching { api.saveMathSession(child.id, body) }
                .onSuccess { saved = it; phase = Phase.Result }
                .onFailure { saveFailed = true; phase = Phase.Result }
        }
    }
}

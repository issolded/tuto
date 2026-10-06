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
 *  - retry/help at every age, with the first unhinted miss at seven+ returned for another try;
 *  - paper transcription is checked by the child and scored by the shared answer comparator;
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

    val young = true // All ages can retry with help, matching the current web flow.

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
    private val helpShown = mutableSetOf<Int>()
    private val wrongTries = mutableMapOf<Int, Int>()
    var reviewId by mutableStateOf<String?>(null); private set
    private var reviewPicks = emptyList<JSONObject>()
    var operationError by mutableStateOf(false); private set
    var paper by mutableStateOf(false); private set
    private var saving = false
    fun usePaper() { if (index == 0 && answers.isEmpty()) paper = true }
    fun acceptPaper(results: List<JSONObject>) {
        if (phase != Phase.Asking || !paper || results.size != total) return
        answers.clear()
        results.forEach { answers += if (it.isNull("child_answer")) null else it.optString("child_answer") }
        finish()
    }
    fun practise() {
        val offer = saved?.review ?: return
        if (phase != Phase.Result || saving) return
        saving = true; operationError = false; phase = Phase.Loading
        scope.launch {
            runCatching {
                val picks = offer.getJSONArray("picks").let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
                val fresh = picks.map { engine.reviewQuestion(session!!.questions[it.getInt("idx")], child.language) }
                api.call("POST", "/api/children/${child.id}/math-review/${offer.getString("id")}/start")
                reviewId = offer.getString("id"); reviewPicks = picks
                session = session!!.copy(questions = fresh); answers.clear(); helpUsed.clear(); wrongTries.clear(); attempted.clear()
                index = 0; input = ""; hintsShown = 0; feedback = null; paper = false; saved = null; phase = Phase.Asking
            }.onFailure { operationError = true; phase = Phase.Result }
            saving = false
        }
    }
    fun close(done: () -> Unit) {
        if (saving) return
        val id = saved?.review?.optString("id") ?: if (phase != Phase.Result) reviewId else null
        if (id == null) { done(); return }
        saving = true
        scope.launch { runCatching { api.call("POST", "/api/children/${child.id}/math-review/$id/decline") }.onSuccess { done() }.onFailure { operationError = true }; saving = false }
    }

    val question: MathQuestion? get() = session?.questions?.getOrNull(index)
    val total get() = session?.questions?.size ?: 0
    val correctCount get() = session?.questions?.indices?.count { MathEngine.sameAnswer(answers.getOrNull(it), session!!.questions[it].answer) } ?: 0
    fun answerAt(i: Int) = answers.getOrNull(i)

    fun start() {
        val pending = store.pendingMath(child.id)
        if (pending != null) {
            session = MathSession.from(pending.getJSONObject("session"))
            answers.clear(); pending.getJSONArray("answers").let { a -> for(i in 0 until a.length()) answers.add(if(a.isNull(i)) null else a.optString(i)) }
            helpUsed.clear(); pending.optJSONArray("help").let { a -> if(a!=null) for(i in 0 until a.length()) helpUsed.add(a.getInt(i)) }
            helpShown.clear(); pending.optJSONArray("shown")?.let { a -> for(i in 0 until a.length()) helpShown.add(a.getInt(i)) }
            wrongTries.clear(); pending.optJSONObject("wrong")?.let { o -> o.keys().forEach { k -> wrongTries[k.toInt()] = o.getInt(k) } }
            reviewId = pending.optString("review_id").takeUnless { it.isBlank() || it=="null" }
            reviewPicks = pending.optJSONArray("picks").let { a -> if(a==null) emptyList() else (0 until a.length()).map { a.getJSONObject(it) } }
            paper = pending.optBoolean("paper"); saveFailed = true; phase = Phase.Result
            return
        }
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
        input = app.tuto.mobile.data.MathInput.next(input, key)
    }

    fun hint() {
        val q = question ?: return
        if (hintsShown < maxOf(1,q.hints.size)) { hintsShown++; helpUsed += index; helpShown += index }
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
        wrongTries[index] = (wrongTries[index] ?: 0) + 1
        val why = q.options.firstOrNull { it.value == value }?.why
        if (young) {
            // Help opens with the first wrong try; each further wrong try shows one more step.
            helpUsed += index
            if ((child.age < 7 || wrongTries[index]!! >= 2 || hintsShown > 0) && hintsShown < maxOf(1,q.hints.size)) { hintsShown++; helpShown += index }
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
        if (feedback is Feedback.Correct || feedback is Feedback.Revealed || phase != Phase.Asking) return
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
        if (saving) return
        store.pendingMath(child.id, JSONObject().put("session", JSONObject().put("level",s.level).put("school_year",s.schoolYear).put("questions",JSONArray(s.questions.map { it.raw }))).put("answers",JSONArray(answers)).put("help",JSONArray(helpUsed.toList())).put("shown",JSONArray(helpShown.toList())).put("wrong",JSONObject(wrongTries.mapKeys { it.key.toString() })).put("review_id",reviewId ?: JSONObject.NULL).put("picks",JSONArray(reviewPicks)).put("paper",paper))
        saving = true; phase = Phase.Saving; saveFailed = false
        scope.launch {
            val qs = s.questions
            val correct = correctCount
            val body = JSONObject()
                .put("mode", if (paper) "paper" else "screen")
                .put("review_ok", reviewId == null)
                .put("level", s.level)
                .put("topics", JSONArray(qs.mapNotNull { it.topicName }.distinct()))
                .put("school_year", s.schoolYear)
                .put("attempts", JSONArray(qs.mapIndexedNotNull { i, q ->
                    val id = q.topicId ?: return@mapIndexedNotNull null
                    JSONObject()
                        .put("idx", i)
                        .put("wrong_tries", wrongTries[i] ?: 0)
                        .put("help_shown", i in helpShown)
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
            runCatching {
                if (reviewId == null) api.saveMathSession(child.id, body)
                else {
                    val results = body.getJSONArray("attempts")
                    for (i in 0 until results.length()) results.getJSONObject(i).put("idx", reviewPicks[i].getInt("idx"))
                    val r = api.call("POST", "/api/children/${child.id}/math-review/$reviewId/finish", JSONObject().put("results", results))
                    MathSaved(r.optInt("gems_earned"), false, "same")
                }
            }
                .onSuccess { store.pendingMath(child.id, null); saved = it; phase = Phase.Result }
                .onFailure { saveFailed = true; phase = Phase.Result }
            saving = false
        }
    }
}

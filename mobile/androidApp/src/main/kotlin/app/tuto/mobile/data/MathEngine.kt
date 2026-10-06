package app.tuto.mobile.data

import android.content.Context
import com.dokar.quickjs.QuickJs
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * The web app's maths engine, run in QuickJS (assets/engine/math.js, built from
 * mobile/engine/entry.jsx). It plans the session, writes every question from the same templates
 * as the browser, and renders each figure to SVG with the browser's own components.
 *
 * One runtime for the life of the app, used from one thread: QuickJS is not thread-safe, and
 * loading the bundle costs about a tenth of a second, which is worth paying once.
 */
class MathEngine(private val context: Context) : PuzzleRenderer {
    private val thread: CoroutineDispatcher = Executors.newSingleThreadExecutor { r -> Thread(r, "tuto-math") }.asCoroutineDispatcher()
    private val lock = Mutex()
    private var js: QuickJs? = null

    private suspend fun runtime(): QuickJs {
        js?.let { return it }
        val code = context.assets.open("engine/math.js").bufferedReader().use { it.readText() }
        val q = QuickJs.create(thread)
        q.maxStackSize = 1024L * 1024L
        q.evaluate<Any?>(code, "math.js")
        js = q
        return q
    }

    private var puzzleLoaded = false

    /** The puzzle drawings (assets/engine/puzzle.js), loaded into the same runtime on first use. */
    override suspend fun drawPuzzle(specs: List<JSONObject?>, px: Int): List<String?> = withContext(thread) {
        lock.withLock {
            val q = runtime()
            if (!puzzleLoaded) {
                q.evaluate<Any?>(context.assets.open("engine/puzzle.js").bufferedReader().use { it.readText() }, "puzzle.js")
                puzzleLoaded = true
            }
            val arr = JSONArray(specs.map { it ?: JSONObject.NULL })
            val out = JSONArray(q.evaluate<String>("TutoPuzzle.draw(${JSONObject.quote(arr.toString())}, $px)", "draw.js"))
            (0 until out.length()).map { if (out.isNull(it)) null else out.optString(it) }
        }
    }

    suspend fun buildSession(age: Int, plan: MathPlan?, lang: String, seenTopics: List<String>, seenKeys: List<String>): MathSession =
        withContext(thread) {
            lock.withLock {
                val opts = JSONObject()
                    .put("age", age)
                    .put("level", plan?.level ?: JSONObject.NULL)
                    .put("lang", lang)
                    .put("count", 10)
                    .put("weighting", JSONObject().put("focusTopicId", plan?.focusTopicId ?: JSONObject.NULL).put("weakTopicIds", JSONArray(plan?.weakTopicIds ?: emptyList<String>())))
                    .put("seenTopics", JSONArray(seenTopics))
                    .put("seenKeys", JSONArray(seenKeys))
                val arg = JSONObject.quote(opts.toString())
                val out = runtime().evaluate<String>("TutoMath.buildSession($arg)", "call.js")
                MathSession.from(JSONObject(out))
            }
        }

    companion object {
        /** MathScreen's sameAnswer, in Kotlin because it runs on every key press. Kept identical. */
        fun sameAnswer(given: String?, expected: String): Boolean {
            if (given == null || given.trim().isEmpty()) return false
            val b = expected.toDoubleOrNull()
            if (b == null || !b.isFinite()) return given.trim() == expected.trim()
            val a = given.trim().toDoubleOrNull() ?: return false
            return a.isFinite() && kotlin.math.abs(a - b) < 1e-9
        }
    }
}

data class MathOption(val value: String, val label: String, val why: String?)

data class MathQuestion(
    val topicId: String?,
    val topicName: String?,
    val question: String,
    val answer: String,
    /** integer | decimal | choice */
    val format: String,
    val options: List<MathOption>,
    val hints: List<String>,
    val operandKey: String?,
    val visual: JSONObject?,
    /** SVG the engine rendered, or null. */
    val svg: String?,
    /** A figure the tablet draws itself (count, pictogram, shapes, prices, digital). */
    val nativeFigure: String?,
)

data class MathSession(val level: Int, val schoolYear: String, val questions: List<MathQuestion>) {
    companion object {
        fun from(j: JSONObject) = MathSession(
            level = j.optInt("level"),
            schoolYear = j.optString("school_year"),
            questions = j.optJSONArray("questions").objects().map { q ->
                val fig = q.optJSONObject("figure")
                MathQuestion(
                    topicId = q.optStringOrNull("topic_id"),
                    topicName = q.optStringOrNull("topic_name"),
                    question = q.optString("question"),
                    // Numbers come through JSON as 13 or 0.5; the web compares on the string form.
                    answer = q.opt("answer").let { if (it is Number && it.toDouble() % 1.0 == 0.0) it.toLong().toString() else it.toString() },
                    format = q.optString("format", "integer"),
                    options = q.optJSONArray("options").objects().map { o -> MathOption(o.optString("value"), o.optString("label"), o.optStringOrNull("why")) },
                    hints = q.optJSONArray("hints")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList(),
                    operandKey = q.optStringOrNull("operand_key"),
                    visual = q.optJSONObject("visual"),
                    svg = fig?.optStringOrNull("svg"),
                    nativeFigure = fig?.optStringOrNull("native"),
                )
            },
        )
    }
}

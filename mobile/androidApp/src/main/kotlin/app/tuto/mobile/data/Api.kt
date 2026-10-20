package app.tuto.mobile.data

import app.tuto.mobile.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * The Express server the web app talks to, and nothing else. The child side of the web app reads
 * and writes only through these endpoints, so the tablet does exactly the same: every reward and
 * every level is still decided on the server.
 *
 * An interface so the device test can put a fake server in front of the real screens.
 */
interface TutoApi {
    suspend fun call(method: String, path: String, body: JSONObject? = null): JSONObject = throw IOException("not supported")
    suspend fun familyChildren(code: String): List<ChildSummary>
    suspend fun verifyPin(code: String, pin: String, childId: String? = null): PinResult
    suspend fun forgotPin(code: String, childId: String): Unit = throw IOException("not supported")
    suspend fun todaySummary(childId: String): Today
    suspend fun mathPlan(childId: String): MathPlan
    suspend fun saveMathSession(childId: String, body: JSONObject): MathSaved
    suspend fun rewards(childId: String): List<Reward> = emptyList()
    suspend fun gems(childId: String): Int = 0
    suspend fun rewardClaims(childId: String): List<Claim> = emptyList()
    suspend fun claimReward(childId: String, rewardId: String): Claim = throw IOException("not supported")
    suspend fun rewardSuggestions(childId: String): List<Suggestion> = emptyList()
    suspend fun suggestReward(childId: String, name: String, icon: String, gems: Int): Suggestion = throw IOException("not supported")
    suspend fun startPuzzle(childId: String): PuzzleSession = throw IOException("not supported")
    suspend fun answerPuzzle(sessionId: String, index: Int, chosen: Int, lang: String, skip: Boolean = false): PuzzleAnswer = throw IOException("not supported")
    suspend fun finishPuzzle(sessionId: String): PuzzleResult = throw IOException("not supported")
    suspend fun puzzleHint(sessionId: String, index: Int, lang: String): JSONObject = throw IOException("not supported")
    suspend fun startPuzzleReview(childId: String, reviewId: String): PuzzleSession = throw IOException("not supported")
    suspend fun finishPuzzleReview(childId: String, reviewId: String): PuzzleResult = throw IOException("not supported")
    suspend fun declinePuzzleReview(childId: String, reviewId: String): Unit = throw IOException("not supported")
}

class HttpTutoApi(private val base: String = BuildConfig.SERVER_URL) : TutoApi {
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    private suspend fun request(method: String, path: String, body: JSONObject? = null): Pair<Int, JSONObject> =
        withContext(Dispatchers.IO) {
            val conn = (URL(base + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 15_000
                readTimeout = 120_000
                setRequestProperty("Accept", "application/json")
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
            }
            try {
                if (body != null) conn.outputStream.use { it.write(body.toString().toByteArray()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                code to (if (text.isBlank()) JSONObject() else runCatching { JSONObject(text) }.getOrElse { throw IOException("Invalid JSON response", it) })
            } finally {
                conn.disconnect()
            }
        }

    override suspend fun call(method: String, path: String, body: JSONObject?): JSONObject {
        require(path.startsWith("/api/"))
        val (status, json) = request(method, path, body)
        if (status !in 200..299) throw ApiFailure(status, json)
        return json
    }

    override suspend fun familyChildren(code: String): List<ChildSummary> {
        val (status, json) = request("GET", "/api/family/${enc(code)}/children")
        if (status !in 200..299) throw IOException("server $status")
        return json.optJSONArray("children").objects().map(ChildSummary::from)
    }

    override suspend fun verifyPin(code: String, pin: String, childId: String?): PinResult {
        val (status, json) = request("POST", "/api/family/${enc(code)}/verify-pin", JSONObject().put("pin", pin).apply { childId?.let { put("child_id", it) } })
        return when {
            status in 200..299 && json.optJSONObject("child") != null -> PinResult.Ok(Child.from(json.getJSONObject("child")))
            status == 401 -> PinResult.Wrong(json.optInt("attempts_left", -1))
            status == 429 -> PinResult.Locked(json.optInt("retry_in_seconds", 60))
            else -> throw IOException("server $status")
        }
    }

    override suspend fun forgotPin(code: String, childId: String) {
        val (status, json) = request("POST", "/api/family/${enc(code)}/forgot-pin", JSONObject().put("child_id", childId))
        if (status !in 200..299 || !json.optBoolean("ok")) throw IOException("server $status")
    }

    override suspend fun todaySummary(childId: String): Today {
        val (status, json) = request("GET", "/api/children/${enc(childId)}/today-summary")
        // A fallback zero balance on a 500 is not the child's actual balance.
        if (status !in 200..299) throw IOException("server $status")
        return Today.from(json)
    }

    override suspend fun mathPlan(childId: String): MathPlan {
        val (status, json) = request("GET", "/api/children/${enc(childId)}/math-plan")
        if (status !in 200..299) throw IOException("server $status")
        return MathPlan.from(json)
    }

    override suspend fun saveMathSession(childId: String, body: JSONObject): MathSaved {
        val (status, json) = request("POST", "/api/children/${enc(childId)}/math-session", body)
        if (status !in 200..299) throw IOException("server $status")
        return MathSaved(
            gemsEarned = if (json.has("gems_earned") && !json.isNull("gems_earned")) json.optInt("gems_earned") else null,
            capped = json.optBoolean("capped", false),
            levelChange = json.optString("level_change", "same"),
            review = json.optJSONObject("review"),
        )
    }

    override suspend fun rewards(childId: String): List<Reward> {
        val (status, json) = request("GET", "/api/children/${enc(childId)}/rewards")
        if (status !in 200..299) throw IOException("server $status")
        return json.optJSONArray("rewards").objects().map(Reward::from)
    }

    override suspend fun gems(childId: String): Int {
        val (status, json) = request("GET", "/api/children/${enc(childId)}/gems")
        if (status !in 200..299) throw IOException("server $status")
        return json.optInt("gems")
    }

    override suspend fun rewardClaims(childId: String): List<Claim> {
        val (status, json) = request("GET", "/api/children/${enc(childId)}/reward-claims")
        if (status !in 200..299) throw IOException("server $status")
        return json.optJSONArray("claims").objects().map(Claim::from)
    }

    override suspend fun claimReward(childId: String, rewardId: String): Claim {
        val (status, json) = request("POST", "/api/children/${enc(childId)}/reward-claims", JSONObject().put("reward_id", rewardId))
        if (status !in 200..299 || json.optJSONObject("claim") == null) throw ServerRefused(json.optString("error", "server $status"))
        return Claim.from(json.getJSONObject("claim"))
    }

    override suspend fun rewardSuggestions(childId: String): List<Suggestion> {
        val (status, json) = request("GET", "/api/children/${enc(childId)}/reward-suggestions")
        if (status !in 200..299) throw IOException("server $status")
        return json.optJSONArray("suggestions").objects().map(Suggestion::from)
    }

    override suspend fun suggestReward(childId: String, name: String, icon: String, gems: Int): Suggestion {
        val body = JSONObject().put("name", name).put("icon", icon).put("gems", gems)
        val (status, json) = request("POST", "/api/children/${enc(childId)}/reward-suggestions", body)
        if (status !in 200..299 || json.optJSONObject("suggestion") == null) throw ServerRefused(json.optString("error", "server $status"))
        return Suggestion.from(json.getJSONObject("suggestion"))
    }

    // Icons off: they are drawn with the web's icon font, which the tablet does not carry. The web
    // asks for the same sheet whenever that font fails to load.
    override suspend fun startPuzzle(childId: String): PuzzleSession {
        val (status, json) = request("POST", "/api/children/${enc(childId)}/puzzle-session", JSONObject().put("icons", false))
        if (status !in 200..299) throw ServerRefused(json.optString("error", "server $status"))
        return PuzzleSession.from(json)
    }

    override suspend fun answerPuzzle(sessionId: String, index: Int, chosen: Int, lang: String, skip: Boolean): PuzzleAnswer {
        val body = JSONObject().put("question_index", index).put("chosen_index", chosen).put("lang", lang).put("skip", skip)
        val (status, json) = request("POST", "/api/puzzle-sessions/${enc(sessionId)}/answer", body)
        if (status !in 200..299) throw IOException("server $status")
        return PuzzleAnswer(json.optBoolean("correct"), json.optInt("correct_index", -1), json.optStringOrNull("why"), json.optBoolean("retry"))
    }

    override suspend fun finishPuzzle(sessionId: String): PuzzleResult {
        val (status, json) = request("POST", "/api/puzzle-sessions/${enc(sessionId)}/finish")
        if (status !in 200..299) throw IOException("server $status")
        return PuzzleResult(json.optInt("correct"), json.optInt("total"), json.optInt("gems_earned"), json.optBoolean("capped"), json.optJSONObject("review"))
    }

    override suspend fun puzzleHint(sessionId: String, index: Int, lang: String): JSONObject {
        val (status, json) = request("POST", "/api/puzzle-sessions/${enc(sessionId)}/hint", JSONObject().put("question_index", index).put("lang", lang))
        if (status !in 200..299) throw IOException("server $status")
        return json
    }

    override suspend fun startPuzzleReview(childId: String, reviewId: String): PuzzleSession {
        val (status, json) = request("POST", "/api/children/${enc(childId)}/puzzle-review/${enc(reviewId)}/start")
        if (status !in 200..299) throw IOException("server $status")
        return PuzzleSession.from(json)
    }

    override suspend fun finishPuzzleReview(childId: String, reviewId: String): PuzzleResult {
        val (status, json) = request("POST", "/api/children/${enc(childId)}/puzzle-review/${enc(reviewId)}/finish")
        if (status !in 200..299) throw IOException("server $status")
        return PuzzleResult(json.optInt("correct"), json.optInt("asked"), json.optInt("gems_earned"), false)
    }

    override suspend fun declinePuzzleReview(childId: String, reviewId: String) {
        val (status, json) = request("POST", "/api/children/${enc(childId)}/puzzle-review/${enc(reviewId)}/decline")
        if (status !in 200..299 || !json.optBoolean("ok")) throw IOException("server $status")
    }
}

/** The server said no, and said why ("not enough gems", "too many pending requests"). */
class ServerRefused(val reason: String) : IOException(reason)

sealed interface PinResult {
    data class Ok(val child: Child) : PinResult
    data class Wrong(val attemptsLeft: Int) : PinResult
    data class Locked(val retrySeconds: Int) : PinResult
}

data class MathSaved(val gemsEarned: Int?, val capped: Boolean, val levelChange: String, val review: JSONObject? = null)

internal fun JSONArray?.objects(): List<JSONObject> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it) }

internal fun JSONObject.optStringOrNull(key: String): String? =
    if (has(key) && !isNull(key)) optString(key) else null

class ApiFailure(val status: Int, val body: JSONObject): IOException(body.optString("error", "Request failed ($status)"))

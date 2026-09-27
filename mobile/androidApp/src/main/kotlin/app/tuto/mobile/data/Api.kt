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
    suspend fun familyChildren(code: String): List<ChildSummary>
    suspend fun verifyPin(code: String, pin: String): PinResult
    suspend fun todaySummary(childId: String): Today
    suspend fun mathPlan(childId: String): MathPlan
    suspend fun saveMathSession(childId: String, body: JSONObject): MathSaved
}

class HttpTutoApi(private val base: String = BuildConfig.SERVER_URL) : TutoApi {
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    private suspend fun request(method: String, path: String, body: JSONObject? = null): Pair<Int, JSONObject> =
        withContext(Dispatchers.IO) {
            val conn = (URL(base + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 15_000
                readTimeout = 20_000
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
                code to (if (text.isBlank()) JSONObject() else runCatching { JSONObject(text) }.getOrElse { JSONObject() })
            } finally {
                conn.disconnect()
            }
        }

    override suspend fun familyChildren(code: String): List<ChildSummary> {
        val (status, json) = request("GET", "/api/family/${enc(code)}/children")
        if (status !in 200..299) throw IOException("server $status")
        return json.optJSONArray("children").objects().map(ChildSummary::from)
    }

    override suspend fun verifyPin(code: String, pin: String): PinResult {
        val (status, json) = request("POST", "/api/family/${enc(code)}/verify-pin", JSONObject().put("pin", pin))
        return when {
            status in 200..299 && json.optJSONObject("child") != null -> PinResult.Ok(Child.from(json.getJSONObject("child")))
            status == 401 -> PinResult.Wrong(json.optInt("attempts_left", -1))
            status == 429 -> PinResult.Locked(json.optInt("retry_in_seconds", 600))
            else -> throw IOException("server $status")
        }
    }

    override suspend fun todaySummary(childId: String): Today {
        val (status, json) = request("GET", "/api/children/${enc(childId)}/today-summary")
        // The server answers 500 with a zeroed summary rather than nothing; that is still a
        // usable home screen, so only a missing body counts as a failure.
        if (status !in 200..299 && !json.has("activities")) throw IOException("server $status")
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
        )
    }
}

sealed interface PinResult {
    data class Ok(val child: Child) : PinResult
    data class Wrong(val attemptsLeft: Int) : PinResult
    data class Locked(val retrySeconds: Int) : PinResult
}

data class MathSaved(val gemsEarned: Int?, val capped: Boolean, val levelChange: String)

internal fun JSONArray?.objects(): List<JSONObject> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it) }

internal fun JSONObject.optStringOrNull(key: String): String? =
    if (has(key) && !isNull(key)) optString(key) else null

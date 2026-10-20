package app.tuto.mobile.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * What the web app keeps in localStorage, kept in SharedPreferences: the family code this device
 * joined, the child signed in, and the recent maths topics and operands that stop the same
 * question coming back a day later.
 */
class Session(context: Context) {
    private val prefs = context.getSharedPreferences("tuto", Context.MODE_PRIVATE)

    var familyCode: String?
        get() = prefs.getString("family_code", null)
        set(v) = prefs.edit().putString("family_code", v).apply()

    var child: Child?
        get() = prefs.getString("child", null)?.let { runCatching { Child.from(JSONObject(it)) }.getOrNull() }
        set(v) = prefs.edit().putString("child", v?.raw?.toString()).apply()

    fun pendingMath(childId: String): JSONObject? = prefs.getString("pending-math-$childId", null)?.let { runCatching { JSONObject(it) }.getOrNull() }
    fun pendingMath(childId: String, value: JSONObject?) { prefs.edit().putString("pending-math-$childId", value?.toString()).apply() }

    fun signOut() { child = null }

    // Same caps as the web (SEEN_CAP): long enough to span a few sessions, short enough that a
    // topic comes round again in its turn.
    fun seen(kind: String, childId: String, level: String): List<String> =
        prefs.getString(key(kind, childId, level), null)?.let { s ->
            runCatching { JSONArray(s).let { a -> (0 until a.length()).map { a.optString(it) } } }.getOrNull()
        } ?: emptyList()

    fun remember(kind: String, childId: String, level: String, items: List<String>) {
        val next = (seen(kind, childId, level) + items.filter { it.isNotBlank() }).takeLast(SEEN_CAP)
        prefs.edit().putString(key(kind, childId, level), JSONArray(next).toString()).apply()
    }

    private fun key(kind: String, childId: String, level: String) = "math_${kind}_${childId}_$level"

    companion object { const val SEEN_CAP = 60 }
}

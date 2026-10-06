package app.tuto.mobile

import android.content.Context
import androidx.compose.runtime.*
import app.tuto.mobile.data.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.LocalDate
import java.time.Period
import java.util.UUID

class ParentRun(val cloud: Cloud, val api: TutoApi, private val scope: CoroutineScope, context: Context) {
    var unlocked by mutableStateOf(false)
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null)
    var page by mutableStateOf("children")
    var profile by mutableStateOf(JSONObject()); private set
    var children by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var selected by mutableStateOf<JSONObject?>(null)
    var detail by mutableStateOf(JSONObject()); private set
    var messages by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var week by mutableStateOf<JSONObject?>(null)
    var weekOffset by mutableIntStateOf(0)
    val language get() = profile.optJSONObject("prefs")?.optString("language", "en") ?: "en"
    private var polling: Job? = null
    private val cache = context.getSharedPreferences("tuto-parent-chat", Context.MODE_PRIVATE)
    fun work(block: suspend () -> Unit) {
        if (busy) return
        busy = true; error = null; notice = null
        scope.launch { try { block() } catch (e: Exception) { error = if (e is ApiFailure && e.status == 401) "Please sign in again." else "The request failed. Nothing is shown as saved until the server confirms it." } finally { busy = false } }
    }
    fun lock() { unlocked = false; messages = emptyList(); polling?.cancel(); cloud.cancelOAuth() }
    suspend fun signIn(email: String, password: String) { cloud.signIn(email, password); load(); unlocked = true; page = "children" }
    suspend fun load() {
        val id = cloud.parentId ?: error("Sign in required")
        profile = cloud.rows("parents", "id=eq.${enc(id)}&select=*", parent = true).single()
        if (profile.optString("family_code").let { it.isBlank() || it == "null" }) {
            val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; val random = SecureRandom()
            val code = (1..8).map { chars[random.nextInt(chars.length)] }.joinToString("")
            cloud.rows("parents", "id=eq.${enc(id)}&family_code=is.null", "PATCH", JSONObject().put("family_code", code), true)
            profile = cloud.rows("parents", "id=eq.${enc(id)}", parent = true).single()
        }
        children = cloud.rows("children", "parent_id=eq.${enc(id)}&select=*&order=created_at", parent = true)
    }
    suspend fun loadChild(child: JSONObject) {
        selected = child; val id = enc(child.getString("id"))
        val d = JSONObject()
        d.put("ledger", JSONArray(cloud.rows("bt_ledger", "child_id=eq.$id&select=*&order=created_at.desc&limit=100", parent = true)))
        d.put("submissions", JSONArray(cloud.rows("submissions", "child_id=eq.$id&select=*&order=created_at.desc&limit=60", parent = true)))
        d.put("rewards", JSONArray(cloud.rows("rewards", "child_id=eq.$id&archived_at=is.null&order=bt_cost", parent = true)))
        d.put("paintings", cloud.parentCall("GET", "/api/parent/children/$id/paintings").optJSONArray("paintings"))
        d.put("contributions", api.call("GET", "/api/contributions?child_id=$id&scope=pending").optJSONArray("contributions"))
        d.put("claims", api.call("GET", "/api/children/$id/reward-claims").optJSONArray("claims"))
        d.put("suggestions", api.call("GET", "/api/children/$id/reward-suggestions").optJSONArray("suggestions"))
        d.optJSONArray("submissions").objects().filter { it.optString("status") == "pending" }.forEach { row ->
            row.put("photos", cloud.parentCall("GET", "/api/submissions/${enc(row.getString("id"))}/photos").optJSONArray("photos"))
        }
        d.optJSONArray("contributions").objects().filter { !it.optString("photo_url").let { v -> v.isBlank() || v == "null" } }.forEach { row -> row.put("photo", cloud.parentCall("GET", "/api/contributions/${enc(row.getString("id"))}/photo").optString("photo")) }
        detail = d; page = "child"
    }
    suspend fun decision(kind: String, row: JSONObject, approve: Boolean, cost: Int? = null) {
        val body = JSONObject().put("parent_id", cloud.parentId)
        if (cost != null) body.put("gems", cost).put("name", row.optString("name")).put("icon", row.optString("icon", "⭐"))
        cloud.parentCall("POST", "/api/$kind/${enc(row.getString("id"))}/${if (approve) "approve" else "reject"}", body)
        loadChild(selected!!)
    }
    suspend fun savePrefs(patch: JSONObject) {
        val prefs = cloud.updatePrefs { original -> ParentRules.mergeEdits(profile.optJSONObject("prefs") ?: JSONObject(), patch, original) }
        profile = JSONObject(profile.toString()).put("prefs", prefs)
    }
    suspend fun saveChild(name: String, birth: String, language: String, pin: String, id: String? = null) {
        val birthday = birth.takeIf { it.isNotBlank() }?.let(LocalDate::parse)
        val age = birthday?.let { Period.between(it, LocalDate.now()).years } ?: selected?.optInt("age") ?: 0
        require(birthday != null || id != null)
        require(name.isNotBlank() && age in 1..18)
        val body = JSONObject().put("name", name.trim()).put("age", age).put("language", language).apply { if (birthday != null) put("birth_date",birth) }
        if (pin.isNotBlank()) {
            require(pin.matches(Regex("[0-9]{4}")) && pin !in setOf("0000", "1111", "1234", "4321"))
            val hash = MessageDigest.getInstance("SHA-256").digest(pin.toByteArray()).joinToString("") { "%02x".format(it) }
            require(children.none { it.optString("id") != id && it.optString("pin_hash") == hash })
            body.put("pin_hash", hash)
        } else require(id != null)
        val saved = if (id == null) cloud.rows("children", "", "POST", body.put("parent_id", cloud.parentId), true).single()
            else cloud.rows("children", "id=eq.${enc(id)}&parent_id=eq.${enc(cloud.parentId!!)}", "PATCH", body, true).single()
        load(); loadChild(saved)
    }
    suspend fun saveTasks(settings: JSONObject, variety: String) {
        val id = selected!!.getString("id")
        selected = cloud.rows("children", "id=eq.${enc(id)}&parent_id=eq.${enc(cloud.parentId!!)}", "PATCH", JSONObject().put("task_settings", settings).apply { if (selected!!.has("english_variety")) put("english_variety", if (variety == "auto") JSONObject.NULL else variety) }, true).single()
        page = "child"
    }
    suspend fun loadWeek(offset: Int = weekOffset) { weekOffset = offset; week = cloud.parentCall("GET", "/api/parent/children/${enc(selected!!.getString("id"))}/week?offset=$offset"); page = "week" }
    suspend fun loadChat() {
        val j = cloud.parentCall("GET", "/api/parent/chat")
        if (j.optBoolean("available")) messages = j.optJSONArray("items").objects()
        else if (messages.isEmpty()) messages = runCatching { JSONArray(cache.getString(cloud.parentId, "[]")).objects() }.getOrDefault(emptyList())
        pollChat()
    }
    private fun pollChat() {
        polling?.cancel()
        if (messages.none { it.optString("status") == "pending" }) return
        polling = scope.launch {
            repeat(72) {
                delay(2500)
                if (!unlocked) return@launch
                runCatching { cloud.parentCall("GET", "/api/parent/chat") }.onSuccess { if (it.optBoolean("available")) messages = it.optJSONArray("items").objects() }
                if (messages.none { it.optString("status") == "pending" }) return@launch
            }
        }
    }
    suspend fun ask(question: String) {
        require(question.isNotBlank() && question.length <= 1000)
        val tmp = JSONObject().put("id", UUID.randomUUID().toString()).put("question", question).put("status", "pending")
        messages = messages + tmp
        try {
            val j = cloud.parentCall("POST", "/api/parent/chat", JSONObject().put("text", question))
            val item = j.optJSONObject("item") ?: JSONObject(tmp.toString()).put("status", "answered").put("answer", j.optJSONArray("replies")?.let { a -> (0 until a.length()).joinToString("\n\n") { a.getString(it) } }.orEmpty()).put("photos", j.optJSONArray("photos"))
            messages = messages.map { if (it === tmp) item else it }; cache.edit().putString(cloud.parentId, JSONArray(messages.takeLast(60)).toString()).apply(); pollChat()
        } catch (e: Exception) { messages = messages.map { if (it === tmp) JSONObject(it.toString()).put("status", "failed") else it }; throw e }
    }
}

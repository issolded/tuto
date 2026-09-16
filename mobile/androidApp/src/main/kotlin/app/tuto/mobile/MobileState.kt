package app.tuto.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.compose.runtime.*
import app.tuto.core.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class MobileState(application: Application) : AndroidViewModel(application) {
    private val prefs = application.getSharedPreferences("tuto-native-preview", 0)
    var theme by mutableStateOf(runCatching { ThemeChoice.valueOf(prefs.getString("theme", "MORPH")!!) }.getOrDefault(ThemeChoice.MORPH)); private set
    var turkish by mutableStateOf(prefs.getBoolean("tr", true)); private set
    var name by mutableStateOf(prefs.getString("name", "Alex") ?: "Alex"); private set
    var page by mutableStateOf("home")
    var session by mutableStateOf<Session?>(readSession()); private set
    var wallet by mutableStateOf(readWallet()); private set
    var selected by mutableStateOf<Int?>(null)
    var helped by mutableStateOf(false)
    var feedback by mutableStateOf<Boolean?>(null)
    var message by mutableStateOf<String?>(null)
    init { if (session != null) page = if (session!!.finished) "result" else "quiz" }
    fun text(tr: String, en: String) = if (turkish) tr else en
    fun chooseTheme(value: ThemeChoice) { theme = value; prefs.edit().putString("theme", value.name).apply() }
    fun setLanguage(value: Boolean) { turkish = value; prefs.edit().putBoolean("tr", value).apply() }
    fun updateName(value: String) { name = value.take(30); prefs.edit().putString("name", name).apply() }
    fun start(subject: Subject) {
        session = Practice.start(UUID.randomUUID().toString(), subject, System.nanoTime().toInt(), turkish)
        selected = null; helped = false; feedback = null; page = "quiz"; persist()
    }
    fun check() {
        if (feedback != null) return
        val s = session ?: return
        val choice = selected ?: return
        feedback = choice == s.current?.answer
        session = s.answer(choice, helped)
        if (session!!.finished) wallet = wallet.credit(session!!, System.currentTimeMillis())
        persist()
    }
    fun next() {
        selected = null; helped = false; feedback = null
        if (session?.finished == true) page = "result"
    }
    fun leavePractice() { page = "home"; selected = null; feedback = null; helped = false }
    fun resume() { selected = null; feedback = null; helped = false; page = if (session?.finished == true) "result" else "quiz" }
    fun redeem() {
        if (wallet.balance < 20) return
        wallet = wallet.redeem(UUID.randomUUID().toString(), 20, System.currentTimeMillis())
        message = text("15 dakikalık istek kaydedildi. Ebeveyninle birlikte kullan; uygulamalar otomatik açılmaz.", "15-minute request recorded. Agree with your parent; apps are not unlocked automatically.")
        persist()
    }
    private fun persist() {
        val entries = JSONArray()
        wallet.entries.forEach { entries.put(JSONObject().put("id", it.id).put("label", it.label).put("gems", it.gems).put("time", it.timestamp)) }
        val editor = prefs.edit().putString("wallet", entries.toString())
        val s = session
        if (s != null) {
            val qs = JSONArray()
            s.questions.forEach { q -> qs.put(JSONObject().put("id", q.id).put("family", q.family).put("prompt", q.prompt).put("choices", JSONArray(q.choices)).put("answer", q.answer).put("hint", q.hint).put("shapes", JSONArray(q.shapes))) }
            val ats = JSONArray()
            s.attempts.forEach { a -> ats.put(JSONObject().put("qid", a.questionId).put("family", a.family).put("selected", a.selected).put("correct", a.correct).put("helped", a.helped)) }
            editor.putString("session", JSONObject().put("id", s.id).put("subject", s.subject.name).put("questions", qs).put("attempts", ats).toString())
        }
        // Wallet and session completion persisted in the same preference transaction.
        editor.commit()
    }
    private fun readWallet(): Wallet = runCatching {
        val list = JSONArray(prefs.getString("wallet", "[]"))
        Wallet((0 until list.length()).map { val e = list.getJSONObject(it); LedgerEntry(e.getString("id"), e.getString("label"), e.getInt("gems"), e.getLong("time")) })
    }.getOrDefault(Wallet())
    private fun readSession(): Session? = runCatching {
        val raw = prefs.getString("session", null) ?: return null
        val s = JSONObject(raw); val qs = s.getJSONArray("questions"); val ats = s.getJSONArray("attempts")
        Session(s.getString("id"), Subject.valueOf(s.getString("subject")), (0 until qs.length()).map {
            val q = qs.getJSONObject(it); val choices = q.getJSONArray("choices"); val shapes = q.getJSONArray("shapes")
            Question(q.getString("id"), q.getString("family"), q.getString("prompt"), (0 until choices.length()).map(choices::getString), q.getInt("answer"), q.getString("hint"), (0 until shapes.length()).map(shapes::getInt))
        }, (0 until ats.length()).map { val a = ats.getJSONObject(it); Attempt(a.getString("qid"), a.getString("family"), a.getInt("selected"), a.getBoolean("correct"), a.getBoolean("helped")) })
    }.getOrNull()
}

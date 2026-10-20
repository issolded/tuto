package app.tuto.core
import kotlinx.serialization.json.*

/** Swift bridge; scoring and wallet mutations delegate to the shared domain. */
class PreviewBridge(snapshot: String) {
    private var session: Session? = null
    private var wallet = Wallet()
    private var selected: Int? = null
    private var helped = false
    private var feedback: Boolean? = null
    init { if (snapshot.isNotEmpty()) restore(snapshot) }
    fun start(id: String, subject: String, seed: Int, turkish: Boolean) {
        session = Practice.start(id, Subject.valueOf(subject), seed, turkish)
        selected = null; helped = false; feedback = null
    }
    fun select(index: Int) { if (feedback == null && session?.current?.choices?.indices?.contains(index) == true) selected = index }
    fun hint() { if (feedback == null) helped = true }
    fun check(timestamp: Long) {
        if (feedback != null) return
        val s = session ?: return
        val q = s.current ?: return
        val i = selected ?: return
        feedback = i == q.answer
        session = s.answer(i, helped)
        wallet = wallet.credit(session!!, timestamp)
    }
    fun next() { selected = null; helped = false; feedback = null }
    fun redeem(id: String, timestamp: Long) { wallet = wallet.redeem(id, 20, timestamp) }
    fun snapshot(): String = buildJsonObject {
        put("version", 1); put("balance", wallet.balance)
        put("selected", selected?.let(::JsonPrimitive) ?: JsonNull)
        put("helped", helped); put("feedback", feedback?.let(::JsonPrimitive) ?: JsonNull)
        putJsonArray("entries") { wallet.entries.forEach { e -> add(buildJsonObject { put("id",e.id); put("label",e.label); put("gems",e.gems); put("timestamp",e.timestamp) }) } }
        val s = session
        if (s != null) put("session", buildJsonObject {
            put("id", s.id); put("subject", s.subject.name); put("finished", s.finished)
            put("correctCount",s.correctCount); put("independentCount",s.independentCount)
            putJsonArray("questions") { s.questions.forEach { q -> add(buildJsonObject {
                put("id",q.id); put("family",q.family); put("prompt",q.prompt); put("answer",q.answer); put("hint",q.hint)
                put("choices",JsonArray(q.choices.map(::JsonPrimitive))); put("shapes",JsonArray(q.shapes.map(::JsonPrimitive)))
            }) } }
            putJsonArray("attempts") { s.attempts.forEach { a -> add(buildJsonObject { put("selected",a.selected); put("helped",a.helped) }) } }
        })
    }.toString()
    private fun restore(raw: String) {
        // A malformed local snapshot is preserved by the Swift caller; fail closed to an empty preview.
        runCatching {
            val root = Json.parseToJsonElement(raw).jsonObject
            require(root["version"]!!.jsonPrimitive.int == 1)
            val restoredWallet = Wallet(root["entries"]!!.jsonArray.map {
                val e=it.jsonObject
                LedgerEntry(e["id"]!!.jsonPrimitive.content,e["label"]!!.jsonPrimitive.content,e["gems"]!!.jsonPrimitive.int,e["timestamp"]!!.jsonPrimitive.long)
            })
            val restoredSession = root["session"]?.jsonObject?.let { s ->
                var result = Session(s["id"]!!.jsonPrimitive.content, Subject.valueOf(s["subject"]!!.jsonPrimitive.content), s["questions"]!!.jsonArray.map {
                    val q=it.jsonObject
                    Question(q["id"]!!.jsonPrimitive.content,q["family"]!!.jsonPrimitive.content,q["prompt"]!!.jsonPrimitive.content,
                        q["choices"]!!.jsonArray.map { v -> v.jsonPrimitive.content },q["answer"]!!.jsonPrimitive.int,q["hint"]!!.jsonPrimitive.content,q["shapes"]!!.jsonArray.map { v -> v.jsonPrimitive.int })
                })
                s["attempts"]!!.jsonArray.forEach { val a=it.jsonObject; result=result.answer(a["selected"]!!.jsonPrimitive.int,a["helped"]!!.jsonPrimitive.boolean) }
                result
            }
            val restoredSelected=root["selected"]?.jsonPrimitive?.intOrNull
            val restoredHelped=root["helped"]!!.jsonPrimitive.boolean
            val restoredFeedback=root["feedback"]?.jsonPrimitive?.booleanOrNull
            wallet=restoredWallet; session=restoredSession
            selected=restoredSelected; helped=restoredHelped; feedback=restoredFeedback
        }
    }
}

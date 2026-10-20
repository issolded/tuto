package app.tuto.core

import kotlin.random.Random

enum class Subject { MATH, PATTERNS }
enum class ThemeChoice { CLASSIC, MORPH }
data class Question(val id: String, val family: String, val prompt: String, val choices: List<String>, val answer: Int, val hint: String, val shapes: List<Int> = emptyList())
data class Attempt(val questionId: String, val family: String, val selected: Int, val correct: Boolean, val helped: Boolean)
data class Session(val id: String, val subject: Subject, val questions: List<Question>, val attempts: List<Attempt> = emptyList()) {
    val finished get() = attempts.size == questions.size
    val current get() = questions.getOrNull(attempts.size)
    val correctCount get() = attempts.count { it.correct }
    val independentCount get() = attempts.count { it.correct && !it.helped }
    // Preview policy: reward completing practice, not a claim about mastery.
    val previewGems get() = if (finished) 10 else 0
    fun answer(index: Int, helped: Boolean): Session {
        val q = current ?: return this
        require(index in q.choices.indices)
        return copy(attempts = attempts + Attempt(q.id, q.family, index, index == q.answer, helped))
    }
}
object Practice {
    fun start(id: String, subject: Subject, seed: Int, turkish: Boolean): Session {
        val random = Random(seed)
        val pairs = (1..9).flatMap { a -> (1..9).map { b -> a to b } }.shuffled(random).take(5)
        val questions = pairs.mapIndexed { i, (a, b) ->
            if (subject == Subject.MATH) {
                val subtraction = i % 2 == 1
                val result = if (subtraction) a else a + b
                val options = listOf(result, result + 1, result + 2, (result - 1).coerceAtLeast(0)).distinct().shuffled(random)
                Question("$id/$i", if (subtraction) "math.subtract.within20.v1" else "math.add.within20.v1",
                    if (subtraction) "${a+b} − $b = ?" else "$a + $b = ?", options.map { it.toString() }, options.indexOf(result),
                    if (turkish) (if (subtraction) "$b adım geri say." else "$a sayısından başla, $b adım ileri say.")
                    else (if (subtraction) "Count back $b steps." else "Start at $a and count forward $b steps."))
            } else {
                val first = i % 4
                val second = (first + 1) % 4
                val pattern = if (i < 3) listOf(first, second, first, second, first) else listOf(first, first, second, first, first)
                val names = if (turkish) listOf("Daire", "Üçgen", "Kare", "Beşgen") else listOf("Circle", "Triangle", "Square", "Pentagon")
                Question("$id/$i", if (i < 3) "nvr.pattern.ab.v1" else "nvr.pattern.aab.v1",
                    if (turkish) "Sırada hangi şekil var?" else "Which shape comes next?", names, second,
                    if (turkish) "Tekrar eden küçük şekil grubunu bul." else "Find the small group of shapes that repeats.", pattern)
            }
        }
        return Session(id, subject, questions)
    }
}
data class LedgerEntry(val id: String, val label: String, val gems: Int, val timestamp: Long)
data class Wallet(val entries: List<LedgerEntry> = emptyList()) {
    val balance get() = entries.sumOf { it.gems }
    fun credit(session: Session, timestamp: Long): Wallet {
        if (!session.finished || entries.any { it.id == session.id }) return this
        return copy(entries = entries + LedgerEntry(session.id, session.subject.name, session.previewGems, timestamp))
    }
    fun redeem(id: String, cost: Int, timestamp: Long): Wallet {
        require(cost > 0)
        if (balance < cost || entries.any { it.id == id }) return this
        return copy(entries = entries + LedgerEntry(id, "SCREEN_TIME_REQUEST", -cost, timestamp))
    }
}
// Platform-specific implementations must distinguish measured usage from enforceable access.
interface ScreenTimePort {
    fun hasUsagePermission(): Boolean
    fun measuredMinutesToday(packageName: String): Long?
}

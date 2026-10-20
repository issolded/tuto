package app.tuto.core
import kotlin.test.*

class LearningTest {
    @Test fun generatedAnswersAndChoicesAreValid() {
        for (seed in 0..100) for (subject in Subject.entries) {
            val s = Practice.start("s$seed", subject, seed, false)
            assertEquals(5, s.questions.size)
            for (q in s.questions) {
                assertEquals(q.choices.size, q.choices.distinct().size)
                assertTrue(q.answer in q.choices.indices)
                if (subject == Subject.MATH) {
                    val numbers = Regex("\\d+").findAll(q.prompt).map { it.value.toInt() }.toList()
                    val expected = if ('−' in q.prompt) numbers[0] - numbers[1] else numbers[0] + numbers[1]
                    assertEquals(expected.toString(), q.choices[q.answer])
                } else assertEquals(q.shapes[if (q.family.contains("aab")) 2 else 1], q.answer)
            }
        }
    }
    @Test fun completionCannotAwardTwice() {
        var s = Practice.start("one", Subject.MATH, 42, false)
        assertEquals(0, Wallet().credit(s, 1).balance)
        while (!s.finished) s = s.answer(s.current!!.answer, false)
        val wallet = Wallet().credit(s, 1).credit(s, 2)
        assertEquals(10, wallet.balance)
        assertEquals(5, s.independentCount)
        assertEquals(s, s.answer(0, false))
    }
    @Test fun insufficientBalanceAndDuplicateRedemptionDoNotSpend() {
        val wallet = Wallet(listOf(LedgerEntry("earned", "MATH", 20, 1)))
        assertEquals(wallet, wallet.redeem("r", 30, 2))
        val spent = wallet.redeem("r", 20, 2)
        assertEquals(0, spent.balance)
        assertEquals(spent, spent.redeem("r", 20, 3))
    }
    @Test fun assistanceIsNotIndependentSuccess() {
        var s = Practice.start("h", Subject.MATH, 2, true)
        while (!s.finished) s = s.answer(s.current!!.answer, true)
        assertEquals(5, s.correctCount)
        assertEquals(0, s.independentCount)
    }
}

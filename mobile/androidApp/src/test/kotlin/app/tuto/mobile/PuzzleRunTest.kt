package app.tuto.mobile

import app.tuto.mobile.data.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.advanceUntilIdle
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

/** State/contract tests: no device, real account or parent notification is touched. */
@OptIn(ExperimentalCoroutinesApi::class)
class PuzzleRunTest {
    private val child = Child.from(JSONObject("""{"id":"test-child","name":"Test","age":7,"language":"en"}"""))
    private val renderer = object : PuzzleRenderer {
        override suspend fun drawPuzzle(specs: List<JSONObject?>, px: Int) = specs.map { "<svg/>" }
    }
    private class Api : TutoApi {
        val sheet = PuzzleSession("s1", "7-8", listOf(PuzzleQuestion("sequence", "row", "puzzle_stem_next", emptyList(), emptyList(), listOf(PuzzleOption("A", null), PuzzleOption("B", null)))), 30, true)
        var firstTry = true
        var finishCalls = 0
        var startCalls = 0
        var failFinish = false
        var declined: String? = null
        var reviewFinished: String? = null
        override suspend fun familyChildren(code: String) = emptyList<ChildSummary>()
        override suspend fun verifyPin(code: String, pin: String, childId: String?) = PinResult.Wrong(4)
        override suspend fun todaySummary(childId: String) = Today.EMPTY
        override suspend fun mathPlan(childId: String) = MathPlan(null, null, emptyList())
        override suspend fun saveMathSession(childId: String, body: JSONObject) = MathSaved(0, false, "same")
        override suspend fun startPuzzle(childId: String): PuzzleSession { startCalls++; return sheet }
        override suspend fun answerPuzzle(sessionId: String, index: Int, chosen: Int, lang: String, skip: Boolean): PuzzleAnswer {
            if (!skip && chosen == 0 && firstTry) { firstTry = false; return PuzzleAnswer(false, -1, null, true) }
            return PuzzleAnswer(!skip && chosen == 1, 1, "Look at the pattern.")
        }
        override suspend fun puzzleHint(sessionId: String, index: Int, lang: String) = JSONObject().put("text", "Look at the pattern.").put("eliminate", 0)
        override suspend fun finishPuzzle(sessionId: String): PuzzleResult {
            finishCalls++
            if (failFinish) throw IOException("offline")
            return PuzzleResult(0, 1, 0, false, JSONObject().put("id", "r1").put("max_gems", 2))
        }
        override suspend fun startPuzzleReview(childId: String, reviewId: String) = sheet.copy(sessionId = reviewId, review = true)
        override suspend fun declinePuzzleReview(childId: String, reviewId: String) { declined = reviewId }
        override suspend fun finishPuzzleReview(childId: String, reviewId: String): PuzzleResult {
            reviewFinished = reviewId
            return PuzzleResult(1, 1, 2, false)
        }
    }

    @Test fun retryAndHintDoNotSettleQuestion() = runTest {
        val api = Api(); val run = PuzzleRun(this, api, renderer, child)
        run.start(); runCurrent(); run.begin()
        run.pick(0); run.send(); runCurrent()
        assertTrue(run.retryNeeded); assertNull(run.answer); assertEquals(0, run.index)
        run.pick(0); assertNull(run.picked) // The rejected option cannot be selected again.
        run.hint(); runCurrent()
        assertEquals(1, run.hintCount); assertEquals(listOf("Look at the pattern."), run.hints)
        assertEquals(0, api.finishCalls)
    }

    @Test fun skippedQuestionCanLeadToReviewAndItsOwnFinishEndpoint() = runTest {
        val api = Api(); val run = PuzzleRun(this, api, renderer, child)
        run.start(); runCurrent(); run.begin(); run.send(skip = true); runCurrent()
        assertFalse(run.answer!!.correct)
        run.next(); runCurrent(); assertEquals("r1", run.reviewToClose)
        run.startReview(); runCurrent()
        assertTrue(run.session!!.review); assertTrue(run.session!!.willPay); assertEquals(2, run.session!!.gems)
        run.begin(); run.pick(1); run.send(); advanceUntilIdle()
        assertEquals("r1", api.reviewFinished); assertEquals(1, api.finishCalls)
        assertEquals(2, run.result!!.gemsEarned); assertNull(run.reviewToClose)
    }

    @Test fun decliningOfferedReviewWaitsForServerBeforeLeaving() = runTest {
        val api = Api(); val run = PuzzleRun(this, api, renderer, child)
        run.start(); runCurrent(); run.begin(); run.send(skip = true); runCurrent(); run.next(); runCurrent()
        var left = false
        run.declineThen { left = true }
        assertFalse(left)
        runCurrent(); assertTrue(left); assertEquals("r1", api.declined); assertNull(run.reviewToClose)
    }

    @Test fun finishingFailureRetriesSameSessionInsteadOfCreatingAnother() = runTest {
        val api = Api().also { it.failFinish = true }; val run = PuzzleRun(this, api, renderer, child)
        run.start(); runCurrent(); run.begin(); run.send(skip = true); runCurrent(); run.next(); runCurrent()
        assertEquals(PuzzleRun.Phase.Failed, run.phase)
        api.failFinish = false; run.retry(); runCurrent()
        assertEquals(PuzzleRun.Phase.Result, run.phase); assertEquals(2, api.finishCalls); assertEquals(1, api.startCalls)
    }
}

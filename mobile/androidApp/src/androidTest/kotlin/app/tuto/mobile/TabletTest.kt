package app.tuto.mobile

import android.graphics.Bitmap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToString
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import app.tuto.mobile.data.Child
import app.tuto.mobile.data.ChildSummary
import app.tuto.mobile.data.MathPlan
import app.tuto.mobile.data.MathSaved
import app.tuto.mobile.data.PinResult
import app.tuto.mobile.data.PuzzleAnswer
import app.tuto.mobile.data.PuzzleResult
import app.tuto.mobile.data.PuzzleSession
import app.tuto.mobile.data.Today
import app.tuto.mobile.data.TutoApi
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

/**
 * The real screens and the real maths engine, in front of a fake server: family code, PIN, home,
 * a full maths sitting answered correctly, and what the server is sent at the end.
 */
class TabletTest {
    @org.junit.Before fun isolateCloud() { Services.cloudFactory = { context -> object : app.tuto.mobile.data.Cloud(context) {
        override suspend fun rows(table: String, query: String, method: String, body: Any?, parent: Boolean) = emptyList<JSONObject>()
    } } }
    @org.junit.After fun resetCloud() { Services.cloudFactory = null; Services.api = app.tuto.mobile.data.HttpTutoApi() }
    @get:Rule val compose = createEmptyComposeRule()

    private class FakeApi(val siblings: Boolean = false) : TutoApi {
        var saved: JSONObject? = null
        var mathReviewResult: JSONObject? = null
        var verifiedChild: String? = null
        var forgotChild: String? = null
        override suspend fun forgotPin(code: String, childId: String) { forgotChild = childId }
        override suspend fun familyChildren(code: String) =
            if (code == "TUTO42") listOf(ChildSummary("child-1", "Ada", 7)) + (if (siblings) listOf(ChildSummary("child-2", "Test sibling", 9)) else emptyList()) else emptyList()
        override suspend fun verifyPin(code: String, pin: String, childId: String?): PinResult {
            verifiedChild = childId
            return if (pin == "1234" && childId == "child-1") PinResult.Ok(Child.from(JSONObject("""{"id":"child-1","name":"Ada","age":7,"language":"en","task_settings":{"math":{"gems":20}}}""")))
            else PinResult.Wrong(4)
        }
        override suspend fun todaySummary(childId: String) = Today.from(JSONObject(
            """{"today":2,"activities":{"reading":0,"math":0,"puzzle":0},"streak":4,"gems":42,"nearestGoal":{"id":"g","name":"Roblox 15 min","icon":"🎮","bt_cost":60},"hasAnyGoals":true}""",
        ))
        override suspend fun mathPlan(childId: String) = MathPlan(null, null, emptyList())
        override suspend fun saveMathSession(childId: String, body: JSONObject): MathSaved {
            saved = body
            return MathSaved(gemsEarned = 20, capped = false, levelChange = "same", review = JSONObject("""{"id":"math-review-test","picks":[{"idx":0}]}"""))
        }
        override suspend fun call(method:String,path:String,body:JSONObject?):JSONObject {
            if(path.endsWith("/math-review/math-review-test/finish")) {
                mathReviewResult=body
                return JSONObject().put("gems_earned",2)
            }
            if(path.contains("/math-review/math-review-test/")) return JSONObject()
            error("Unexpected test request: $path")
        }

        // A real sheet from server/puzzle (age 7, icons off), with each right answer's index kept
        // in a test-only field, as the server keeps it on its side.
        private val sheet = JSONObject(
            InstrumentationRegistry.getInstrumentation().context.assets.open("puzzle-sheet.json").bufferedReader().use { it.readText() },
        )
        private val key = sheet.getJSONArray("questions").let { a -> (0 until a.length()).map { a.getJSONObject(it).getInt("answer") } }
        var right = 0
        var answered = 0
        private val retried = mutableSetOf<Int>()
        var offerReview = false
        var shortPuzzle = false
        var declinedReview: String? = null
        var finishedReview: String? = null
        override suspend fun puzzleHint(sessionId: String, index: Int, lang: String) = JSONObject().put("text", "Look at the pattern.")
        override suspend fun declinePuzzleReview(childId: String, reviewId: String) { declinedReview = reviewId }
        override suspend fun startPuzzleReview(childId: String, reviewId: String) = PuzzleSession.from(sheet).copy(sessionId = reviewId, questions = PuzzleSession.from(sheet).questions.take(1), review = true)
        override suspend fun finishPuzzleReview(childId: String, reviewId: String): PuzzleResult {
            finishedReview = reviewId
            return PuzzleResult(1, 1, 1, false)
        }
        override suspend fun startPuzzle(childId: String) = PuzzleSession.from(sheet).let { if (shortPuzzle) it.copy(questions = it.questions.take(1)) else it }
        override suspend fun answerPuzzle(sessionId: String, index: Int, chosen: Int, lang: String, skip: Boolean): PuzzleAnswer {
            val ok = !skip && chosen == key[index]
            if (!skip && !ok && retried.add(index)) return PuzzleAnswer(false, -1, null, retry = true)
            answered++
            if (ok) right++
            return PuzzleAnswer(ok, key[index], if (ok) null else "That one is different.")
        }
        override suspend fun finishPuzzle(sessionId: String) = PuzzleResult(right, if (shortPuzzle) 1 else key.size, 30, false, if (offerReview) JSONObject().put("id", "review-1").put("count", 1).put("max_gems", 1) else null)
        fun answerFor(index: Int) = key[index]
    }

    private fun shot(name: String) {
        compose.waitForIdle()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val dir = File(instrumentation.targetContext.getExternalFilesDir(null), "screenshots").apply { mkdirs() }
        requireNotNull(instrumentation.uiAutomation.takeScreenshot()).let { bitmap ->
            File(dir, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
    }

    /** Waits, and on a timeout says which step it was and what the sitting looked like. */
    private fun waitFor(step: String, timeoutMs: Long = 15_000, condition: () -> Boolean) {
        try {
            compose.waitUntil(timeoutMs) { condition() }
        } catch (e: Throwable) {
            runCatching { shot("failure-" + step.replace(Regex("[^a-zA-Z0-9]+"), "-")) }
            val run = Services.currentMath
            val state = run?.let { "phase=${it.phase} index=${it.index} input='${it.input}' feedback=${it.feedback} answer=${it.question?.answer} format=${it.question?.format} options=${it.question?.options?.map { o -> o.value }}" } ?: "no sitting"
            val tree = runCatching { compose.onRoot(useUnmergedTree = false).printToString(maxDepth = 12) }.getOrDefault("?").take(3000)
            throw AssertionError("Timed out at step '$step' — $state\n$tree", e)
        }
    }
    /** Scrolls to the node first when it sits in a scrolling layout; taps it either way. */
    private fun tap(tag: String) {
        val node = compose.onNodeWithTag(tag)
        runCatching { node.performScrollTo() }
        compose.waitForIdle()
        node.assertIsDisplayed().performClick()
    }
    private fun exists(tag: String) = compose.onAllNodes(hasTestTag(tag)).fetchSemanticsNodes().isNotEmpty()
    private fun textExists(text: String, substring: Boolean = false) = compose.onAllNodes(hasText(text, substring = substring)).fetchSemanticsNodes().isNotEmpty()

    private fun freshApi(): FakeApi {
        InstrumentationRegistry.getInstrumentation().targetContext.getSharedPreferences("tuto", 0).edit().clear().commit()
        return FakeApi().also { Services.api = it }
    }

    private fun signIn() {
        compose.onNodeWithText("Family code").performTextInput("tuto42")
        compose.onNodeWithText("Family code").performImeAction()
        InstrumentationRegistry.getInstrumentation().uiAutomation.waitForIdle(300, 5000)
        waitFor("pin screen") { textExists("Enter your PIN") }
        listOf("1", "2", "3", "4").forEach { compose.onNodeWithTag("key_$it").performClick() }
        waitFor("home with gems") { textExists("Ada") && textExists("42") }
    }

    @Test fun siblingsRequireAnExplicitSelection() {
        InstrumentationRegistry.getInstrumentation().targetContext.getSharedPreferences("tuto", 0).edit().clear().commit()
        val api = FakeApi(siblings = true)
        Services.api = api
        ActivityScenario.launch(MainActivity::class.java).use {
            compose.onNodeWithText("Family code").performTextInput("tuto42")
            compose.onNodeWithText("Family code").performImeAction()
        InstrumentationRegistry.getInstrumentation().uiAutomation.waitForIdle(300, 5000)
            waitFor("sibling picker") { exists("child_child-2") }
            tap("child_child-2")
            compose.onNodeWithTag("child_child-2").assertIsSelected()
            tap("forgot-pin")
            waitFor("forgot PIN request accepted") { textExists("Request received", substring = true) }
            assertEquals("child-2", api.forgotChild)
            listOf("1", "2", "3", "4").forEach { tap("key_$it") }
            waitFor("selected sibling rejected") { textExists("That's not the right PIN", substring = true) }
            assertEquals("child-2", api.verifiedChild)
            tap("child_child-1")
            listOf("1", "2", "3", "4").forEach { tap("key_$it") }
            waitFor("selected child signed in") { textExists("42") }
            assertEquals("child-1", api.verifiedChild)
        }
    }

    @Test fun aFullPuzzleSitting() {
        val api = freshApi().also { it.offerReview = true }
        ActivityScenario.launch(MainActivity::class.java).use {
            signIn()
            tap("quest_puzzle")
            waitFor("puzzle welcome", 30_000) { Services.currentPuzzle?.phase == PuzzleRun.Phase.Welcome }
            val run = Services.currentPuzzle!!
            assertEquals(10, run.total)
            // Every figure the server sent was drawn by the bundled engine.
            run.session!!.questions.forEachIndexed { i, q ->
                val d = run.drawings[i]
                q.prompt.forEachIndexed { j, spec -> if (spec != null) assertTrue("q$i prompt $j undrawn", d.prompt[j]?.contains("<svg") == true) }
                q.options.forEachIndexed { j, o -> if (o.spec != null) assertTrue("q$i option $j undrawn", d.options[j]?.contains("<svg") == true) }
            }
            shot("05-puzzle-welcome")
            compose.onNodeWithText("Let's go", substring = true).performClick()
            waitFor("puzzle asking") { run.phase == PuzzleRun.Phase.Asking }

            // The first answer wrong on purpose, the rest right.
            for (i in 0 until run.total) {
                waitFor("puzzle $i shown") { run.index == i && run.answer == null && !run.sending }
                if (i == 0) shot("06-puzzle-question")
                val right = api.answerFor(i)
                val pick = if (i == 0) (right + 1) % run.question!!.options.size else right
                tap("puzzle_option_$pick")
                compose.onNodeWithText("Send", substring = true).performClick()
                if (i == 0) {
                    waitFor("puzzle first wrong stays on same question") { run.retryNeeded && !run.sending }
                    assertEquals(0, run.index)
                    assertEquals(null, run.answer)
                    compose.onNodeWithText("Hint").performScrollTo().performClick()
                    waitFor("hint loaded") { run.hintCount == 1 && !run.sending }
                    compose.onNodeWithText("I don’t know").performScrollTo().performClick()
                }
                waitFor("puzzle $i answered") { run.answer != null || run.index != i || run.phase != PuzzleRun.Phase.Asking }
                if (i == 0) {
                    assertTrue(run.answer?.correct == false)
                    shot("07-puzzle-wrong")
                    compose.onNodeWithText("Next").performClick()
                }
            }
            waitFor("puzzle result", 20_000) { run.phase == PuzzleRun.Phase.Result }
            assertEquals(10, api.answered)
            assertEquals(9, run.result!!.correct)
            shot("08-puzzle-result")
            compose.onNodeWithText("Not now").performScrollTo().performClick()
            waitFor("back home") { textExists("My Math") }
            assertEquals("review-1", api.declinedReview)
        }
    }

    @Test fun completePuzzleReviewAndBottomNavigation() {
        val api = freshApi().also { it.offerReview = true; it.shortPuzzle = true }
        ActivityScenario.launch(MainActivity::class.java).use {
            signIn()
            tap("nav-settings")
            waitFor("settings via bottom navigation") { textExists("Switch child") }
            tap("nav-home")
            tap("quest_puzzle")
            waitFor("short puzzle ready", 30_000) { Services.currentPuzzle?.phase == PuzzleRun.Phase.Welcome }
            val run = Services.currentPuzzle!!
            compose.onNodeWithText("Let's go", substring = true).performScrollTo().performClick()
            compose.onNodeWithText("I don’t know").performScrollTo().performClick()
            waitFor("skip settled") { run.answer != null }
            compose.onNodeWithText("Next").performClick()
            waitFor("review offered") { run.phase == PuzzleRun.Phase.Result }
            compose.onNodeWithText("Practise").performScrollTo().performClick()
            waitFor("review ready") { run.phase == PuzzleRun.Phase.Welcome && run.session?.review == true }
            compose.onNodeWithText("Let's go", substring = true).performScrollTo().performClick()
            tap("puzzle_option_${api.answerFor(0)}")
            compose.onNodeWithText("Send", substring = true).performClick()
            waitFor("review finished") { run.phase == PuzzleRun.Phase.Result && api.finishedReview != null }
            assertEquals("review-1", api.finishedReview)
            assertEquals(null, api.declinedReview)
            assertEquals(1, run.result!!.gemsEarned)
        }
    }

    @Test fun familyPinHomeAndAFullMathsSitting() {
        val api = freshApi()

        ActivityScenario.launch(MainActivity::class.java).use {
            // Family code.
            compose.onNodeWithText("Family code").performTextInput("tuto42")
            shot("01-setup")
            compose.onNodeWithText("Family code").performImeAction()
        InstrumentationRegistry.getInstrumentation().uiAutomation.waitForIdle(300, 5000)

            // PIN: a wrong one is refused, the right one signs Ada in.
            waitFor("pin screen") { textExists("Enter your PIN") }
            listOf("9", "9", "9", "9").forEach { compose.onNodeWithTag("key_$it").performClick() }
            waitFor("wrong pin message") { textExists("not the right PIN", substring = true) }
            listOf("1", "2", "3", "4").forEach { compose.onNodeWithTag("key_$it").performClick() }

            // Home, with the server's figures.
            waitFor("home with gems") { textExists("Ada") && textExists("42") }
            compose.onNodeWithText("My Math").assertExists()
            compose.onNodeWithText("4 days").assertExists()
            shot("02-home")

            // A full sitting, every answer taken from the engine's own answer key.
            tap("quest_math")
            waitFor("maths sitting ready", 30_000) { Services.currentMath?.phase == MathRun.Phase.Asking }
            val run = Services.currentMath!!
            val total = run.total
            assertEquals(10, total)
            var shotFigure = false
            for (i in 0 until total) {
                waitFor("question $i shown") { run.index == i && run.feedback == null }
                val q = run.question!!
                if (!shotFigure && (q.svg != null || q.nativeFigure != null)) { shot("03-question-with-figure"); shotFigure = true }
                if (i == 0) {
                    shot("03-question-first")
                    compose.onNodeWithText("Hint").performScrollTo().performClick()
                }
                if (q.format == "choice" && q.options.isNotEmpty()) {
                    tap("option_${q.answer}")
                } else {
                    q.answer.forEach { ch -> tap("key_$ch") }
                    compose.onNodeWithText("Check").performScrollTo().assertIsDisplayed().performClick()
                }
                waitFor("question $i accepted") { run.feedback is MathRun.Feedback.Correct || run.phase != MathRun.Phase.Asking }
            }

            // The server is told what happened, question by question.
            waitFor("result", 20_000) { run.phase == MathRun.Phase.Result }
            val body = requireNotNull(api.saved)
            assertEquals(10, body.getInt("questions_total"))
            assertEquals(10, body.getInt("questions_correct"))
            assertEquals(100, body.getInt("accuracy"))
            assertEquals(10, body.getJSONArray("attempts").length())
            assertTrue(body.getJSONArray("attempts").getJSONObject(0).getBoolean("correct"))
            waitFor("result text") { textExists("10 out of 10 right") }
            compose.onNodeWithText("+20 Gems").assertExists()
            shot("04-result")

            // A fresh reinforcement must not inherit help flags from the original sitting:
            // the server rejects helped results when deciding reinforcement rewards.
            assertTrue(body.getJSONArray("attempts").getJSONObject(0).getBoolean("help_shown"))
            compose.onNodeWithText("Practise these skills").performScrollTo().performClick()
            waitFor("maths review ready",30_000) { run.phase==MathRun.Phase.Asking && run.reviewId!=null }
            val reviewQuestion=run.question!!
            if(reviewQuestion.format=="choice" && reviewQuestion.options.isNotEmpty()) tap("option_${reviewQuestion.answer}")
            else {
                reviewQuestion.answer.forEach { ch -> tap("key_$ch") }
                compose.onNodeWithText("Check").performScrollTo().performClick()
            }
            waitFor("maths review recorded",20_000) { run.phase==MathRun.Phase.Result && api.mathReviewResult!=null }
            val reviewAnswer=api.mathReviewResult!!.getJSONArray("results").getJSONObject(0)
            assertTrue(reviewAnswer.getBoolean("correct"))
            assertFalse(reviewAnswer.getBoolean("help_shown"))
            assertFalse(reviewAnswer.getBoolean("help_used"))
            assertEquals(0,reviewAnswer.getInt("wrong_tries"))

            compose.onNodeWithText("Home").performClick()
            waitFor("back home") { textExists("My Math") }
        }
    }
}

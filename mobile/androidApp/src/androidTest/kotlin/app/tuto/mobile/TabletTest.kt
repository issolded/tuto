package app.tuto.mobile

import android.graphics.Bitmap
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToString
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
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
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

/**
 * The real screens and the real maths engine, in front of a fake server: family code, PIN, home,
 * a full maths sitting answered correctly, and what the server is sent at the end.
 */
class TabletTest {
    @get:Rule val compose = createEmptyComposeRule()

    private class FakeApi : TutoApi {
        var saved: JSONObject? = null
        override suspend fun familyChildren(code: String) =
            if (code == "TUTO42") listOf(ChildSummary("child-1", "Ada", 7)) else emptyList()
        override suspend fun verifyPin(code: String, pin: String): PinResult =
            if (pin == "1234") PinResult.Ok(Child.from(JSONObject("""{"id":"child-1","name":"Ada","age":7,"language":"en","task_settings":{"math":{"gems":20}}}""")))
            else PinResult.Wrong(4)
        override suspend fun todaySummary(childId: String) = Today.from(JSONObject(
            """{"today":2,"activities":{"reading":0,"math":0,"puzzle":0},"streak":4,"gems":42,"nearestGoal":{"id":"g","name":"Roblox 15 min","icon":"🎮","bt_cost":60},"hasAnyGoals":true}""",
        ))
        override suspend fun mathPlan(childId: String) = MathPlan(null, null, emptyList())
        override suspend fun saveMathSession(childId: String, body: JSONObject): MathSaved {
            saved = body
            return MathSaved(gemsEarned = 20, capped = false, levelChange = "same")
        }

        // A real sheet from server/puzzle (age 7, icons off), with each right answer's index kept
        // in a test-only field, as the server keeps it on its side.
        private val sheet = JSONObject(
            InstrumentationRegistry.getInstrumentation().context.assets.open("puzzle-sheet.json").bufferedReader().use { it.readText() },
        )
        private val key = sheet.getJSONArray("questions").let { a -> (0 until a.length()).map { a.getJSONObject(it).getInt("answer") } }
        var right = 0
        var answered = 0
        override suspend fun startPuzzle(childId: String) = PuzzleSession.from(sheet)
        override suspend fun answerPuzzle(sessionId: String, index: Int, chosen: Int, lang: String): PuzzleAnswer {
            answered++
            val ok = chosen == key[index]
            if (ok) right++
            return PuzzleAnswer(ok, key[index], if (ok) null else "That one is different.")
        }
        override suspend fun finishPuzzle(sessionId: String) = PuzzleResult(right, key.size, 30, false)
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
            val run = Services.currentMath
            val state = run?.let { "phase=${it.phase} index=${it.index} input='${it.input}' feedback=${it.feedback} answer=${it.question?.answer} format=${it.question?.format} options=${it.question?.options?.map { o -> o.value }}" } ?: "no sitting"
            val tree = runCatching { compose.onRoot(useUnmergedTree = false).printToString(maxDepth = 12) }.getOrDefault("?").take(3000)
            throw AssertionError("Timed out at step '$step' — $state\n$tree", e)
        }
    }
    private fun exists(tag: String) = compose.onAllNodes(hasTestTag(tag)).fetchSemanticsNodes().isNotEmpty()
    private fun textExists(text: String, substring: Boolean = false) = compose.onAllNodes(hasText(text, substring = substring)).fetchSemanticsNodes().isNotEmpty()

    private fun freshApi(): FakeApi {
        InstrumentationRegistry.getInstrumentation().targetContext.getSharedPreferences("tuto", 0).edit().clear().commit()
        return FakeApi().also { Services.api = it }
    }

    private fun signIn() {
        compose.onNodeWithText("Family code").performTextInput("tuto42")
        compose.onNodeWithText("Continue").performClick()
        waitFor("pin screen") { textExists("Enter your PIN") }
        listOf("1", "2", "3", "4").forEach { compose.onNodeWithTag("key_$it").performClick() }
        waitFor("home with gems") { textExists("Ada") && textExists("42") }
    }

    @Test fun aFullPuzzleSitting() {
        val api = freshApi()
        ActivityScenario.launch(MainActivity::class.java).use {
            signIn()
            compose.onNodeWithTag("quest_puzzle").performClick()
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
                compose.onNodeWithTag("puzzle_option_$pick").performScrollTo().performClick()
                compose.onNodeWithText("Send", substring = true).performClick()
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
            compose.onNodeWithText("Home").performClick()
            waitFor("back home") { textExists("My Math") }
        }
    }

    @Test fun familyPinHomeAndAFullMathsSitting() {
        val api = freshApi()

        ActivityScenario.launch(MainActivity::class.java).use {
            // Family code.
            compose.onNodeWithText("Family code").performTextInput("tuto42")
            shot("01-setup")
            compose.onNodeWithText("Continue").performClick()

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
            compose.onNodeWithText("Start").performClick()
            waitFor("maths sitting ready", 30_000) { Services.currentMath?.phase == MathRun.Phase.Asking }
            val run = Services.currentMath!!
            val total = run.total
            assertEquals(10, total)
            var shotFigure = false
            for (i in 0 until total) {
                waitFor("question $i shown") { run.index == i && run.feedback == null }
                val q = run.question!!
                if (!shotFigure && (q.svg != null || q.nativeFigure != null)) { shot("03-question-with-figure"); shotFigure = true }
                if (i == 0) shot("03-question-first")
                if (q.format == "choice" && q.options.isNotEmpty()) {
                    compose.onNodeWithTag("option_${q.answer}").performScrollTo().performClick()
                } else {
                    q.answer.forEach { ch -> compose.onNodeWithTag("key_$ch").performClick() }
                    compose.onNodeWithText("Check").performClick()
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

            compose.onNodeWithText("Home").performClick()
            waitFor("back home") { textExists("My Math") }
        }
    }
}

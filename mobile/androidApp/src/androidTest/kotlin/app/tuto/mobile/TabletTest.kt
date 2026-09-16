package app.tuto.mobile

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import android.graphics.Bitmap
import java.io.File
import org.junit.Rule
import org.junit.Test

class TabletTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private fun shot(name:String) {
        compose.waitForIdle()
        val instrumentation=InstrumentationRegistry.getInstrumentation()
        val dir=File(instrumentation.targetContext.getExternalFilesDir(null),"screenshots").apply{mkdirs()}
        instrumentation.uiAutomation.takeScreenshot().let { bitmap->File(dir,"$name.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)};bitmap.recycle() }
    }
    @Test fun englishStudioNavigationAndSavedContent() {
        compose.onNodeWithText("Home",useUnmergedTree=true).assertIsDisplayed()
        compose.onNodeWithText("Make today",substring=true).assertExists()
        shot("01-home")
        compose.onNodeWithText("Read").performClick()
        compose.onNodeWithText("+ Add my book").performClick()
        compose.onNodeWithText("Book title").performTextInput("The Explorer")
        compose.onNodeWithText("Total pages").performTextInput("120")
        compose.onNodeWithText("Add to my library").performScrollTo().performClick()
        compose.onNodeWithText("The Explorer").performScrollTo().assertIsDisplayed()
        shot("02-library")
        compose.onNodeWithText("My tree").performClick()
        compose.onNodeWithText("+  Made my bed").performScrollTo().performClick()
        compose.onNodeWithText("1 contributions today").performScrollTo().assertIsDisplayed()
        shot("03-tree")
        compose.onNodeWithText("Home").performClick()
        compose.onNodeWithText("Science",useUnmergedTree=true).performScrollTo().performClick()
        compose.onNodeWithText("Science explorer").assertIsDisplayed()
        shot("04-science")
        compose.onAllNodesWithText("Let's investigate →")[0].performScrollTo().performClick()
        compose.onNodeWithText("○  Roots").performScrollTo().performClick()
        compose.onNodeWithText("Check my thinking").performScrollTo().performClick()
        compose.onNodeWithText("That's it!").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Finish investigation").performScrollTo().performClick()
        compose.onNodeWithText("Explored on this device").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Create").performClick()
        compose.onNodeWithText("Write a story").performScrollTo().performClick()
        compose.onNodeWithText("Give your story a title").performScrollTo().performTextInput("My tree adventure")
        compose.onNodeWithText("Once upon an idea…").performScrollTo().performTextInput("A dragon found a book.")
        compose.onNodeWithText("Save my story").performScrollTo().performClick()
        compose.onNodeWithText("My tree adventure").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Create").performClick()
        compose.onNodeWithText("Draw something").performScrollTo().performClick()
        compose.onNodeWithText("Find a drawing").performTextInput("cat")
        compose.onNodeWithText("Cat",useUnmergedTree=true).performClick()
        compose.onNodeWithText("Next step →").performScrollTo().performClick()
        compose.onNodeWithText("Step 2 of",substring=true).performScrollTo().assertIsDisplayed()
        shot("05-drawing")
        compose.onNodeWithText("More").performClick()
        compose.onNodeWithText("My style & language  →").performScrollTo().performClick()
        compose.onNodeWithText("Classic",useUnmergedTree=true).performScrollTo().performClick()
        compose.onNodeWithText("Home").performClick()
        shot("06-classic")
        compose.onNodeWithText("◆ 0").assertIsDisplayed()
        // Recreation preserves the reading record and contribution.
        compose.activityRule.scenario.recreate()
        compose.onNodeWithText("Read").performClick()
        compose.onNodeWithText("The Explorer").performScrollTo().assertIsDisplayed()
    }
}

package app.tuto.mobile

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import androidx.compose.ui.test.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.data.Strings
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import app.tuto.mobile.ui.*
import org.json.JSONObject
import org.junit.Test
import org.junit.Rule
import org.junit.Assert.*
import java.io.File

class PaperPlayTest {
    @get:Rule val compose = createComposeRule()
    private fun shot(name:String) {
        val inst=InstrumentationRegistry.getInstrumentation()
        val dir=File(inst.targetContext.getExternalFilesDir(null),"screenshots").apply { mkdirs() }
        compose.waitForIdle()
        inst.uiAutomation.takeScreenshot()?.let { bitmap -> File(dir,"$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) };bitmap.recycle() }
    }
    @Test fun shelfFiltersRealRecordsAndOpensSelectedBook() {
        val book=JSONObject("""{"id":"b","title":"The woodland adventure","completed":true,"completed_at":"2026-09-01"}""")
        val draft=JSONObject("""{"id":"s","title":"My unfinished story","status":"in_progress"}""")
        var opened:String?=null
        compose.setContent { TestTheme { FeaturePage("Library",{}) {
            LibraryBrowser(listOf(book),listOf(draft),true,{},false,true,true,{}, {},{b,_->opened=b.getString("id")},{},{_,_->})
        } } }
        compose.onNodeWithText("My unfinished story").assertDoesNotExist()
        compose.onNodeWithText("The woodland adventure").performScrollTo().performClick()
        compose.onNodeWithText("Open").performClick()
        assertEquals("b",opened)
        shot("paper-library")
        compose.onNodeWithText("Search books and stories").performScrollTo().performTextInput("missing")
        compose.onNodeWithText("The woodland adventure").assertDoesNotExist()
    }
    @Test fun drawingKeepsNextReachableAndEnlargementCloses() {
        var next=0
        compose.setContent { TestTheme { DrawingStudio("Draw a fox", "",2,6,"Add two pointed ears.",{}, {},{next++}) } }
        compose.onNodeWithTag("drawing-reference").assertIsDisplayed()
        compose.onNodeWithText("Next").assertIsDisplayed().performClick()
        assertEquals(1,next)
        shot("paper-drawing")
        compose.onNodeWithTag("drawing-enlarge").performScrollTo().performClick()
        compose.onNodeWithText("Reset").assertIsDisplayed()
        compose.onNodeWithText("Close").performClick()
        compose.onNodeWithText("Next").assertIsDisplayed()
    }
    @Test fun allMascotClipsAreBundledPlayableAndSilent() {
        val ctx=InstrumentationRegistry.getInstrumentation().targetContext
        FoxPose.entries.forEach { pose ->
            MediaMetadataRetriever().use { reader ->
                ctx.resources.openRawResourceFd(pose.clip).use { reader.setDataSource(it.fileDescriptor,it.startOffset,it.length) }
                assertTrue(reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)!!.toLong() in 3900..5200)
                assertEquals("yes",reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO))
                assertNull(reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO))
                assertNotNull(reader.getFrameAtTime(1000000))
            }
        }
    }
}

@Composable private fun TestTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalStrings provides Strings(JSONObject(), "en")) {
        TutoTheme(content)
    }
}

package app.tuto.mobile

import androidx.compose.ui.graphics.asAndroidBitmap
import android.graphics.Bitmap
import android.graphics.BitmapFactory
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
        compose.onAllNodes(isRoot()).let { roots -> roots[roots.fetchSemanticsNodes().lastIndex] }.captureToImage().asAndroidBitmap().let { bitmap -> File(dir,"$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) } }
    }
    @Test fun shelfFiltersRealRecordsAndOpensSelectedBook() {
        val book=JSONObject("""{"id":"b","title":"The woodland adventure","completed":true,"completed_at":"2026-09-01"}""")
        val draft=JSONObject("""{"id":"s","title":"My unfinished story","status":"in_progress"}""")
        var opened:String?=null
        compose.setContent { TestTheme { FeaturePage("Library",{}, showHeader=false) {
            LibraryBrowser(listOf(book),listOf(draft),true,{},false,true,true,{}, {},{b,_->opened=b.getString("id")},{},{_,_->})
        } } }
        compose.onNodeWithTag("reading-room").performScrollTo()
        shot("paper-room")
        compose.onNodeWithText("My unfinished story").assertDoesNotExist()
        compose.onNodeWithText("The woodland adventure").performScrollTo().performClick()
        shot("bookshelf-detail")
        compose.onNodeWithText("Open").performClick()
        assertEquals("b",opened)
        shot("paper-library")
        compose.onNodeWithText("Search and filters").performScrollTo().performClick()
        compose.onNodeWithText("Search books and stories").performScrollTo().performTextInput("missing")
        compose.onNodeWithText("The woodland adventure").assertDoesNotExist()
    }
    @Test fun roomActionsOpenExistingBooksNewBooksStoriesAndExactAwards() {
        val book=JSONObject("""{"id":"active","title":"My current book","completed":false}""")
        var opened=""; var newBooks=0; var stories=0
        compose.setContent { TestTheme { FeaturePage("Library",{},showHeader=false) {
            LibraryBrowser(listOf(book),emptyList(),true,{},false,true,true,{newBooks++},{stories++},{b,_->opened=b.getString("id")},{},{_,_->})
        } } }
        compose.onNodeWithTag("choose-book").performScrollTo().performClick()
        compose.onNodeWithTag("choose-active").performClick()
        assertEquals("active",opened)
        compose.onNodeWithTag("choose-book").performScrollTo().performClick()
        compose.onNodeWithTag("add-new-book").performClick()
        assertEquals(1,newBooks)
        compose.onNodeWithTag("new-story").performScrollTo().performClick()
        assertEquals(1,stories)
        compose.onNodeWithTag("reading-award-150").performScrollTo().performClick()
        compose.onNodeWithText("150-book award").assertIsDisplayed()
        compose.onNodeWithText("150 more completed books to fill this shelf. Every book counts once.").assertIsDisplayed()
        compose.onNodeWithText("Close").performClick()
        compose.onNodeWithTag("reading-award-200").assertDoesNotExist()
    }
    @Test fun roomAnimationDecodesWithTransparentExteriorAndOpaqueCharacter() {
        val ctx=InstrumentationRegistry.getInstrumentation().targetContext
        val source=android.graphics.ImageDecoder.createSource(ctx.resources,app.tuto.mobile.R.raw.fox_reading_room)
        val animation=android.graphics.ImageDecoder.decodeDrawable(source)
        assertTrue(animation is android.graphics.drawable.AnimatedImageDrawable)
        assertTrue(animation.intrinsicWidth>=480)
        val bitmap=android.graphics.ImageDecoder.decodeBitmap(source) { decoder,_,_->decoder.allocator=android.graphics.ImageDecoder.ALLOCATOR_SOFTWARE }
        assertEquals(0, android.graphics.Color.alpha(bitmap.getPixel(0,0)))
        assertEquals(255, android.graphics.Color.alpha(bitmap.getPixel(bitmap.width/2,bitmap.height/2)))
        (animation as android.graphics.drawable.AnimatedImageDrawable).stop()
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
            assertNotNull("Missing fallback poster for $pose", BitmapFactory.decodeResource(ctx.resources, pose.poster))
            MediaMetadataRetriever().use { reader ->
                ctx.resources.openRawResourceFd(pose.clip).use { reader.setDataSource(it.fileDescriptor,it.startOffset,it.length) }
                assertTrue(reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)!!.toLong() in 3900..5200)
                assertEquals("yes",reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO))
                assertNull(reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO))
                assertNotNull("Cannot decode $pose", reader.getFrameAtTime(1000000))
            }
        }
    }
}

@Composable private fun TestTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalStrings provides Strings(JSONObject(), "en")) {
        TutoTheme(content)
    }
}

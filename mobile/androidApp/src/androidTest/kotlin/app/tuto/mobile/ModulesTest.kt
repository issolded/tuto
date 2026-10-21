package app.tuto.mobile

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.lifecycle.ViewModelProvider
import app.tuto.mobile.data.*
import org.json.JSONObject
import org.json.JSONArray
import org.junit.*
import org.junit.Assert.*

/** Real Compose screens against isolated test data: these never write production records. */
class ModulesTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val child = Child.from(JSONObject("""{"id":"module-test","name":"Test learner","age":9,"language":"en"}"""))
    private class Api : TutoApi {
        val calls=mutableListOf<String>()
        var literacyAnswered=false
        override suspend fun familyChildren(code:String)=emptyList<ChildSummary>()
        override suspend fun verifyPin(code:String,pin:String,childId:String?)=PinResult.Wrong(4)
        override suspend fun todaySummary(childId:String)=Today.EMPTY
        override suspend fun mathPlan(childId:String)=MathPlan(null,null,emptyList())
        override suspend fun saveMathSession(childId:String,body:JSONObject)=MathSaved(0,false,"same")
        override suspend fun call(method:String,path:String,body:JSONObject?):JSONObject {
            calls+=path
            return when {
                path.endsWith("/literacy/next") -> if(literacyAnswered) JSONObject("""{"sitting_id":"lit-test","done":true,"gems_earned":3}""") else JSONObject("""{"sitting_id":"lit-test","n":1,"of":1,"item":{"id":"i","prompt":{"text":"Choose cat"},"questions":[{"id":"q","options":[{"id":"a","text":"cat"},{"id":"b","text":"dog"}]}]}}""")
                path.startsWith("/api/literacy-sittings/") -> {literacyAnswered=true;JSONObject("""{"results":[{"question_id":"q","correct":true,"key":["a"]}]}""")}
                path.endsWith("english-session") -> JSONObject("""{"session_id":"eng-test","questions":[{"type":"definition","stem_key":"eng_stem_definition","pick":1,"prompt":{"definition":"A pet that purrs"},"options":[{"text":"cat"},{"text":"dog"}]}]}""")
                path.endsWith("/answer") -> JSONObject("""{"correct":true,"chosen":[0],"correct_indices":[0]}""")
                path.endsWith("/finish") -> JSONObject("""{"correct":1,"total":1,"gems_earned":3}""")
                path.endsWith("/stories") -> JSONObject("""{"stories":[]}""")
                path.endsWith("/story-draft") -> JSONObject().put("story", JSONObject(body.toString()).put("revision",1).put("writing_source","typed").put("status","in_progress").put("transcribed_text",body!!.optString("text")))
                path.endsWith("/homework") -> JSONObject("""{"submissions":[{"id":"h1","date":"2026-10-06","pages":2,"status":"pending"}]}""")
                path.startsWith("/api/drawings") -> JSONObject("""{"drawings":[]}""")
                path.endsWith("/paintings") -> JSONObject("""{"paintings":[]}""")
                else -> JSONObject()
            }
        }
    }
    private lateinit var activeCloud:TestCloud
    private class TestCloud(context:Context):Cloud(context) {
        var childAge=9
        val books=mutableListOf(JSONObject("""{"id":"book-test","title":"Test library book","current_page":12,"total_pages":100,"completed":false}"""))
        @Volatile var pendingOAuth=false
        @Volatile var exchanged=false
        override val hasPendingOAuth get()=pendingOAuth
        override fun cancelOAuth() {pendingOAuth=false}
        override suspend fun completeGoogleOAuth(url:String) {
            require(pendingOAuth && OAuthPkce.code(url,1000,2000)=="test-code")
            pendingOAuth=false;exchanged=true
        }
        override val parentId get()="parent-test"
        override suspend fun signIn(email:String,password:String) { require(password=="test-password") }
        override suspend fun rows(table:String,query:String,method:String,body:Any?,parent:Boolean):List<JSONObject> = when(table) {
            "parents" -> listOf(JSONObject("""{"id":"parent-test","family_code":"TESTONLY","prefs":{"language":"en"}}"""))
            "children" -> listOf(JSONObject("""{"id":"module-test","name":"Test learner","age":9,"language":"en"}""").put("age",childAge))
            "books" -> {
                val id=query.substringAfter("id=eq.","").substringBefore("&")
                when(method){
                    "POST"->{books.add(JSONObject(body.toString()));listOf(books.last())}
                    "PATCH"->{val record=books.first{it.optString("id")==id};val patch=body as JSONObject;patch.keys().forEach{record.put(it,patch.get(it))};listOf(record)}
                    else->if(query.startsWith("id=eq."))books.filter{it.optString("id")==id}else books.toList()
                }
            }
            else -> emptyList()
        }
        override suspend fun parentCall(method:String,path:String,body:JSONObject?)=JSONObject()
    }
    private fun launch(api:Api):ActivityScenario<MainActivity> {
        val c=InstrumentationRegistry.getInstrumentation().targetContext
        c.getSharedPreferences("tuto",Context.MODE_PRIVATE).edit().clear().commit()
        c.getSharedPreferences("tuto-work-module-test",Context.MODE_PRIVATE).edit().clear().commit()
        c.getSharedPreferences("tuto-notebook-avatar-v1",Context.MODE_PRIVATE).edit().remove(child.id).commit()
        Services.api=api;Services.cloudFactory={TestCloud(it).also { c -> activeCloud=c }}
        return ActivityScenario.launch(MainActivity::class.java).also { a -> a.onActivity { ViewModelProvider(it)[TutoViewModel::class.java].signedIn(child) } }
    }
    private fun open(a:ActivityScenario<MainActivity>,type:String) { a.onActivity { ViewModelProvider(it)[TutoViewModel::class.java].open(type) };compose.waitForIdle() }
    @After fun reset() { Services.api=HttpTutoApi();Services.cloudFactory=null }
    private fun screenshot(name:String,activity:ActivityScenario<MainActivity>){
        activity.onActivity{(it.getSystemService(Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).hideSoftInputFromWindow(it.window.decorView.windowToken,0)}
        compose.waitForIdle()
        if(name=="bookshelf")compose.onNodeWithText("Back to my room").performScrollTo() else if(name!="word-hunt-complete")compose.onNodeWithText("Back").performScrollTo()
        val instrumentation=InstrumentationRegistry.getInstrumentation();instrumentation.waitForIdleSync();android.os.SystemClock.sleep(400)
        val dir=java.io.File(instrumentation.targetContext.getExternalFilesDir(null),"screenshots").apply{mkdirs()}
        instrumentation.uiAutomation.takeScreenshot().let{bitmap->java.io.File(dir,"sprint-$name.png").outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)};bitmap.recycle()}
    }
    @Test fun avatarControlsSaveIndependentFaceHairOutfitAndPet(){
        launch(Api()).use{activity->
            open(activity,"avatar")
            compose.onNodeWithTag("avatar-gender-1").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-choice-0-9").performScrollTo().performClick()
            compose.onNodeWithTag("Hair color-4").performScrollTo().performClick()
            compose.onNodeWithText("Face").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-choice-0-2").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-tab-1").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-choice-1-2").performScrollTo().performClick()
            compose.onNodeWithTag("Outfit color-3").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-tab-2").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-choice-2-1").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-tab-3").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-choice-3-2").performScrollTo().performClick()
            compose.onNodeWithTag("Pet color-3").performScrollTo().performClick()
            val context=InstrumentationRegistry.getInstrumentation().targetContext
            val saved=AvatarStore(context).read(child.id)
            assertEquals(9,saved.hair);assertEquals(2,saved.face);assertEquals(4,saved.hairColor);assertEquals(3,saved.shirt);assertEquals(2,saved.outfit);assertEquals(1,saved.accessory);assertEquals(2,saved.pet);assertEquals(3,saved.petColor)
            activity.recreate();activity.onActivity{assertEquals(saved,ViewModelProvider(it)[TutoViewModel::class.java].avatar)}
        }
    }
    @Test fun readingCanCreateUpdateAndReopenWithoutAssessment(){
        launch(Api()).use{a->
            open(a,"library");compose.onNodeWithTag("room-read").performScrollTo().performClick()
            compose.onNodeWithTag("book-title").performTextInput("The notebook adventure")
            compose.onNodeWithTag("book-total").performTextInput("120")
            compose.onNodeWithTag("book-current").performTextReplacement("30")
            compose.onNodeWithTag("book-save").performScrollTo().performClick();compose.waitForIdle()
            assertEquals(30,activeCloud.books.last().optInt("current_page"));screenshot("reading",a)
            compose.onNodeWithTag("book-current").performTextReplacement("120")
            compose.onNodeWithTag("book-save").performScrollTo().performClick();compose.waitForIdle();assertTrue(activeCloud.books.last().optBoolean("completed"))
            compose.onNodeWithText("My bookshelf").performScrollTo().performClick()
            compose.onNodeWithTag("books-filter-completed").performScrollTo().performClick()
            compose.onNodeWithText("The notebook adventure").assertExists();screenshot("bookshelf",a)
        }
    }
    @Test fun writingPagesAutosaveAndAvatarPersist(){
        val api=Api();launch(api).use{a->
            a.onActivity{val vm=ViewModelProvider(it)[TutoViewModel::class.java];vm.updateAvatar(Avatar(gender=1,hair=9,hairColor=4,face=2,pet=2,petColor=3))}
            val context=InstrumentationRegistry.getInstrumentation().targetContext
            assertEquals(9,AvatarStore(context).read(child.id).hair);assertEquals(3,AvatarStore(context).read(child.id).petColor)
            a.recreate();a.onActivity{assertEquals(4,ViewModelProvider(it)[TutoViewModel::class.java].avatar.hairColor)}
            open(a,"library");compose.onNodeWithTag("room-write").performScrollTo().performClick();compose.onNodeWithTag("new-story").performScrollTo().performClick()
            compose.onNodeWithText("Title").performTextInput("A new adventure")
            compose.onNodeWithTag("writing-page-0").performTextInput("My first page.")
            compose.onNodeWithTag("writing-page-1").performTextInput("My second page.")
            screenshot("writing",a)
            compose.onNodeWithTag("writing-next").performScrollTo().performClick();compose.onNodeWithTag("writing-page-0").performTextInput("My third page.")
            compose.onNodeWithTag("writing-previous").performScrollTo().performClick();compose.onNodeWithText("My first page.").assertExists()
            a.recreate();compose.onNodeWithText("My first page.").assertExists()
            compose.onNodeWithText("Save now").performScrollTo().performClick();compose.waitForIdle()
            assertTrue(api.calls.any{it.endsWith("story-draft")})
            assertTrue(context.getSharedPreferences("tuto-work-module-test",Context.MODE_PRIVATE).all.values.any{it.toString().contains("My third page.")})
        }
    }
    @Test fun olderChildCanPlayNineByNineSudoku(){
        launch(Api()).use{a->
            activeCloud.childAge=13
            a.onActivity{ViewModelProvider(it)[TutoViewModel::class.java].signedIn(child.copy(age=13))}
            open(a,"games");compose.onNodeWithTag("game-sudoku").performScrollTo().performClick()
            compose.onNodeWithTag("sudoku-cell-2").performScrollTo().performClick()
            compose.onNodeWithTag("sudoku-digit-9").performScrollTo().performClick()
            compose.onNodeWithTag("sudoku-cell-2").assertTextEquals("9")
            compose.onNodeWithText("Erase").performScrollTo().performClick();compose.onNodeWithTag("sudoku-cell-2").assertTextEquals("")
            screenshot("sudoku-advanced",a)
        }
    }
    @Test fun wordHuntCompletesAllDirectionsAndRetainsProgress(){
        launch(Api()).use{a->open(a,"games");compose.onNodeWithTag("game-words").performScrollTo().performClick()
            val letters=(0 until 49).map{i->compose.onNodeWithTag("word-cell-$i").fetchSemanticsNode().config[androidx.compose.ui.semantics.SemanticsProperties.Text].joinToString(""){it.text}.single()}
            val grid=app.tuto.mobile.games.NotebookPuzzles.WordGrid(7,letters,listOf("CAT","DOG","MOON","STAR","BIRD"))
            grid.words.forEachIndexed{index,word->
                val pair=(0 until 49).flatMap{start->(0 until 49).map{end->start to end}}.first{(start,end)->app.tuto.mobile.games.NotebookPuzzles.line(start,end,7).map{letters[it]}.joinToString("")==word}
                compose.onNodeWithTag("word-cell-${pair.first}").performScrollTo().performClick();compose.onNodeWithTag("word-cell-${pair.second}").performScrollTo().performClick()
                compose.onNodeWithTag("word-progress").assertTextContains("${index+1} / 5",substring=true)
            }
            compose.onNodeWithText("You did it!").assertExists();screenshot("word-hunt-complete",a)
            a.recreate();compose.onNodeWithTag("word-progress").assertTextContains("5 / 5",substring=true)
        }
    }
    @Test fun englishCanFinishFromRealControls() {
        val api=Api();launch(api).use { a ->
            open(a,"english")
            compose.onNodeWithText("cat").performScrollTo().performClick()
            compose.onNodeWithText("Send").performScrollTo().performClick()
            compose.onNodeWithText("Next").performScrollTo().performClick()
            compose.onNodeWithText("All done!").assertExists()
            assertTrue(api.calls.any { it.startsWith("/api/literacy-sittings/") })

        }
    }
    @Test fun libraryDraftAndHomeworkUseRealRoutesAcrossRotation() {
        val api=Api();launch(api).use { a ->
            open(a,"library");compose.onNodeWithTag("room-read").performScrollTo().performClick();compose.onNodeWithText("Test library book").assertExists();compose.onNodeWithText("Back").performScrollTo().performClick();compose.onNodeWithText("Back to my room").performScrollTo().performClick();compose.onNodeWithTag("room-write").performScrollTo().performClick()
            compose.onNodeWithTag("new-story").performScrollTo().performClick()
            compose.onNodeWithText("Title").performTextInput("Tablet story")
            compose.onNodeWithText("Your story").performTextInput("Today a little fox found a new book and read it with all of her friends.")
            a.recreate();compose.waitForIdle();compose.onNodeWithText("Tablet story").assertExists()
            compose.onNodeWithText("Save now").performScrollTo().performClick()
            compose.waitForIdle();assertTrue(api.calls.any { it.endsWith("story-draft") })
            open(a,"homework");compose.onNodeWithText("2026-10-06").assertExists()
            open(a,"drawing");compose.onNodeWithText("Free drawing").assertExists()
        }
    }
    @Test fun notebookScreensKeepRealControlsReachable() {
        launch(Api()).use { a ->
            fun capture(name:String) {
                compose.waitForIdle()
                val instrumentation=InstrumentationRegistry.getInstrumentation()
                instrumentation.waitForIdleSync()
                android.os.SystemClock.sleep(400) // Let SurfaceFlinger present the new native screen before capture.
                val dir=java.io.File(instrumentation.targetContext.getExternalFilesDir(null),"screenshots").apply{mkdirs()}
                instrumentation.uiAutomation.takeScreenshot().let { bitmap ->
                    java.io.File(dir,"notebook-$name.png").outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}
                    bitmap.recycle()
                }
            }
            compose.onNodeWithTag("nav-home").assertIsDisplayed()
            compose.mainClock.advanceTimeBy(300)
            compose.waitForIdle()
            InstrumentationRegistry.getInstrumentation().waitForIdleSync()
            capture("home")
            compose.onNodeWithTag("nav-me").performClick()
            capture("me")
            compose.onNodeWithTag("edit-avatar").performClick()
            compose.onNodeWithText("Create your avatar").assertExists()
            capture("avatar")
            compose.onNodeWithTag("avatar-tab-3").performScrollTo().performClick()
            capture("pets")
            compose.onNodeWithTag("avatar-choice-3-2").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-gender-1").performScrollTo().performClick()
            compose.onNodeWithTag("avatar-tab-1").performScrollTo().performClick()
            capture("girl-outfits")
            compose.onNodeWithText("Back").assertIsDisplayed().performClick()
            compose.onNodeWithTag("nav-goals").performClick()
            capture("goals")
            compose.onNodeWithTag("nav-games").performClick()
            compose.onNodeWithTag("game-memory").assertExists()
            capture("games")
            open(a,"library")
            compose.onNodeWithTag("room-write").assertExists()
            capture("stories")
            open(a,"explore")
            compose.onNodeWithText("Ay neden değişik görünür?").performScrollTo().performClick()
            compose.onNodeWithText("Devam").assertExists()
            capture("explore")
        }
    }
    @Test fun allSixGamesOpenRestartAndReturn() {
        launch(Api()).use { a ->
            open(a,"games")
            listOf("memory","tangram","words","sudoku","maze","pattern").forEach { id ->
                compose.onNodeWithTag("game-$id").performScrollTo().performClick()
                compose.onNodeWithTag("game-restart").performScrollTo().performClick()
                compose.onNodeWithText("Back").performScrollTo()
                compose.waitForIdle()
                val instrumentation=InstrumentationRegistry.getInstrumentation()
                instrumentation.waitForIdleSync()
                instrumentation.waitForIdleSync()
                android.os.SystemClock.sleep(400) // Let SurfaceFlinger present the new native screen before capture.
                val dir=java.io.File(instrumentation.targetContext.getExternalFilesDir(null),"screenshots").apply{mkdirs()}
                instrumentation.uiAutomation.takeScreenshot().let { bitmap ->
                    java.io.File(dir,"game-$id.png").outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}
                    bitmap.recycle()
                }
                compose.onNodeWithText("Back").performScrollTo().performClick()
                compose.onNodeWithTag("game-$id").assertExists()
            }
        }
    }
    @Test fun oauthDeepLinkRequiresInitiatedFlowAndUnlocksAfterExchange() {
        launch(Api()).use { a ->
            val url=OAuthPkce.REDIRECT+"?code=test-code"
            a.onActivity { ViewModelProvider(it)[TutoViewModel::class.java].parentOAuthCallback(url) }
            compose.onNodeWithText("Family code: TESTONLY").assertDoesNotExist()
            a.onActivity {
                activeCloud.pendingOAuth=true
                it.startActivity(Intent(it,MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP))
            }
            compose.waitUntil(15000) {activeCloud.exchanged}
            compose.onNodeWithText("Family code: TESTONLY").assertExists()
        }
    }
    @Test fun parentRequiresLoginAndLoadsOwnFamily() {
        val api=Api();launch(api).use { a ->
            open(a,"parent");compose.onNodeWithText("Family code: TESTONLY").assertDoesNotExist()
            compose.onNodeWithText("Email").performTextInput("parent@example.test")
            compose.onNodeWithText("Password").performTextInput("test-password")
            compose.onNodeWithText("Sign in").performScrollTo().performClick()
            compose.onNodeWithText("Family code: TESTONLY").assertExists()
            a.onActivity { ViewModelProvider(it)[TutoViewModel::class.java].home() }
            open(a,"parent");compose.onNodeWithText("Family code: TESTONLY").assertDoesNotExist()
        }
    }
}

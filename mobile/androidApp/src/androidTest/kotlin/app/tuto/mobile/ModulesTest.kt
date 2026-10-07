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
        override suspend fun familyChildren(code:String)=emptyList<ChildSummary>()
        override suspend fun verifyPin(code:String,pin:String,childId:String?)=PinResult.Wrong(4)
        override suspend fun todaySummary(childId:String)=Today.EMPTY
        override suspend fun mathPlan(childId:String)=MathPlan(null,null,emptyList())
        override suspend fun saveMathSession(childId:String,body:JSONObject)=MathSaved(0,false,"same")
        override suspend fun call(method:String,path:String,body:JSONObject?):JSONObject {
            calls+=path
            return when {
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
            "children" -> listOf(JSONObject("""{"id":"module-test","name":"Test learner","age":9,"language":"en"}"""))
            "books" -> listOf(JSONObject("""{"id":"book-test","title":"Test library book","current_page":12,"total_pages":100,"completed":false}"""))
            else -> emptyList()
        }
        override suspend fun parentCall(method:String,path:String,body:JSONObject?)=JSONObject()
    }
    private fun launch(api:Api):ActivityScenario<MainActivity> {
        val c=InstrumentationRegistry.getInstrumentation().targetContext
        c.getSharedPreferences("tuto",Context.MODE_PRIVATE).edit().clear().commit()
        c.getSharedPreferences("tuto-work-module-test",Context.MODE_PRIVATE).edit().clear().commit()
        Services.api=api;Services.cloudFactory={TestCloud(it).also { c -> activeCloud=c }}
        return ActivityScenario.launch(MainActivity::class.java).also { a -> a.onActivity { ViewModelProvider(it)[TutoViewModel::class.java].signedIn(child) } }
    }
    private fun open(a:ActivityScenario<MainActivity>,type:String) { a.onActivity { ViewModelProvider(it)[TutoViewModel::class.java].open(type) };compose.waitForIdle() }
    @After fun reset() { Services.api=HttpTutoApi();Services.cloudFactory=null }
    @Test fun englishCanFinishFromRealControls() {
        val api=Api();launch(api).use { a ->
            open(a,"english");compose.onNodeWithTag("english-begin").performScrollTo().performClick()
            compose.onNodeWithTag("english-option-0").performScrollTo().performClick()
            compose.onNodeWithTag("english-send").performScrollTo().performClick()
            compose.onNodeWithTag("english-next").performScrollTo().performClick()
            compose.onNodeWithText("1 / 1").assertExists()
            assertTrue(api.calls.any { it.endsWith("/finish") })
        }
    }
    @Test fun libraryDraftAndHomeworkUseRealRoutesAcrossRotation() {
        val api=Api();launch(api).use { a ->
            open(a,"library");compose.onNodeWithText("Continue reading").performScrollTo().performClick();compose.onNodeWithText("Test library book").assertExists()
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

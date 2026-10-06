package app.tuto.mobile

import app.tuto.mobile.data.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.runCurrent
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class EnglishRunTest {
    private val child = Child.from(JSONObject("""{"id":"test","name":"Test","age":9,"language":"tr"}"""))
    private class Api : TutoApi {
        var finishFails = false
        var starts = 0
        var finishes = 0
        var decline = false
        var retryFirst = false
        var pick = 2
        val requests = mutableListOf<Pair<String, JSONObject?>>()
        override suspend fun familyChildren(code:String) = emptyList<ChildSummary>()
        override suspend fun verifyPin(code:String,pin:String,childId:String?) = PinResult.Wrong(4)
        override suspend fun todaySummary(childId:String) = Today.EMPTY
        override suspend fun mathPlan(childId:String) = MathPlan(null,null, emptyList())
        override suspend fun saveMathSession(childId:String,body:JSONObject) = MathSaved(0,false,"same")
        override suspend fun call(method:String,path:String,body:JSONObject?):JSONObject {
            requests += path to body
            if (path.endsWith("/decline")) { decline=true; return JSONObject() }
            if (path.endsWith("/finish")) { finishes++; if(finishFails) throw IOException("offline"); return JSONObject("""{"correct":1,"total":1,"gems_earned":2,"review":{"id":"r1","count":1,"max_gems":2}}""") }
            if (path.endsWith("/answer")) { if(retryFirst) { retryFirst=false; return JSONObject("""{"retry":true}""") }; return JSONObject("""{"correct":true,"correct_indices":[0,2]}""") }
            if (path.endsWith("/hint")) return JSONObject("""{"text":"Try the other words","eliminate":1}""")
            starts++; return JSONObject("""{"session_id":"s1","questions":[{"pick":$pick,"options":[{"text":"cat"},{"text":"dog"},{"text":"hat"}]}]}""")
        }
    }
    @Test fun twoPicksRequiredAndDoubleSendCannotSubmitTwice() = runTest {
        val api=Api(); val run=EnglishRun(this,api,child);run.start();runCurrent();run.begin()
        run.pick(0);run.send();runCurrent();assertNull(run.answer)
        run.pick(2);run.send();run.send();runCurrent()
        assertEquals(1,api.requests.count { it.first.endsWith("/answer") });assertTrue(run.answer!!.optBoolean("correct"))
        assertEquals(2,api.requests.last().second!!.getJSONArray("chosen").length())
    }
    @Test fun lostFinishRetriesSameSessionAndDeclineAwaitsAcknowledgement() = runTest {
        val api=Api();val run=EnglishRun(this,api,child);run.start();runCurrent();run.begin();run.pick(0);run.pick(2);run.send();runCurrent()
        api.finishFails=true;run.next();runCurrent();assertEquals(EnglishRun.Phase.Failed,run.phase)
        api.finishFails=false;run.retry();runCurrent();assertEquals(1,api.starts);assertEquals(2,api.finishes)
        var left=false;run.close { left=true };assertFalse(left);runCurrent();assertTrue(left);assertTrue(api.decline)
    }
    @Test fun wrongSinglePickAndHintEliminateWithoutSettling() = runTest {
        val api=Api().apply { pick=1;retryFirst=true };val run=EnglishRun(this,api,child);run.start();runCurrent();run.begin()
        run.pick(0);run.send();runCurrent();assertTrue(run.retryNeeded);assertNull(run.answer)
        run.pick(0);assertTrue(run.picked.isEmpty());run.hint();runCurrent();run.pick(1);assertTrue(run.picked.isEmpty());assertEquals(0,api.finishes)
    }
}

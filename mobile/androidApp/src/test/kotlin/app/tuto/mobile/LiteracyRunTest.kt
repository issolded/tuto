package app.tuto.mobile
import app.tuto.mobile.data.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*

@OptIn(ExperimentalCoroutinesApi::class)
class LiteracyRunTest {
 private val child=Child.from(JSONObject("""{"id":"isolated","name":"Learner","age":11,"language":"tr"}"""))
 private class Api:TutoApi {
  var failAnswer=false;val calls=mutableListOf<Pair<String,JSONObject?>>()
  override suspend fun familyChildren(code:String)=emptyList<ChildSummary>()
  override suspend fun verifyPin(code:String,pin:String,childId:String?)=PinResult.Wrong(4)
  override suspend fun todaySummary(childId:String)=Today.EMPTY
  override suspend fun mathPlan(childId:String)=MathPlan(null,null,emptyList())
  override suspend fun saveMathSession(childId:String,body:JSONObject)=MathSaved(0,false,"same")
  override suspend fun call(method:String,path:String,body:JSONObject?):JSONObject {
   calls+=path to body
   if(path.endsWith("/answer")){if(failAnswer)error("connection lost");return JSONObject("""{"results":[{"question_id":"q","correct":true,"key":["cat"]}]}""")}
   return JSONObject("""{"sitting_id":"s","n":1,"of":10,"item":{"id":"i","prompt":{},"questions":[{"id":"q","mode":"build","letters":[{"id":"a","letter":"c"},{"id":"b","letter":"a"},{"id":"c","letter":"t"}]}]}}""")
  }
 }
 @Test fun wordUsesLettersNotTileIdsAndNeverLocallyAwardsGems()=runTest {
  val api=Api();val r=LiteracyRun(this,api,child);r.next();runCurrent();val q=r.questions.single()
  r.choose(q,"a");r.choose(q,"b");assertFalse(r.ready);r.choose(q,"c");assertTrue(r.ready)
  r.send();runCurrent();assertEquals("cat",api.calls.last().second!!.getJSONArray("answers").getJSONObject(0).getString("chosen"));assertEquals(0,r.gems);assertTrue(r.results!!.single().getBoolean("correct"))
 }
 @Test fun noSoundDiscardsItemWithoutSubmittingAWrongAnswer()=runTest {
  val api=Api();val r=LiteracyRun(this,api,child);r.next();runCurrent();r.next(true);runCurrent()
  assertTrue(api.calls.last().second!!.getBoolean("no_audio"));assertEquals("i",api.calls.last().second!!.getString("discard_item"));assertFalse(api.calls.any{it.first.endsWith("/answer")})
 }
 @Test fun uncertainSubmissionCannotBeSentTwice()=runTest {
  val api=Api().apply{failAnswer=true};val r=LiteracyRun(this,api,child);r.next();runCurrent();r.send(true);runCurrent();r.send(true);r.next();runCurrent()
  assertTrue(r.uncertainAnswer);assertEquals(1,api.calls.count{it.first.endsWith("/answer")})
 }
}

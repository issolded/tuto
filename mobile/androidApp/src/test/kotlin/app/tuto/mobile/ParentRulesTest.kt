package app.tuto.mobile
import app.tuto.mobile.data.ParentRules
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
class ParentRulesTest {
 @Test fun partialRulesKeepDefaultsAndRejectInvalidSchedules() {
  val r=ParentRules.complete(JSONObject().put("weekday",45));assertTrue(ParentRules.valid(r));assertEquals("allowed",r.getJSONObject("apps").getString("tuto"))
  assertFalse(ParentRules.valid(JSONObject(r.toString()).put("bedEnd","29:99")))
  assertFalse(ParentRules.valid(JSONObject(r.toString()).put("cap",20)))
 }
 @Test fun preferenceSavePreservesConcurrentUneditedLeaves() {
  val old=JSONObject("""{"approval_required":{"drawing":true,"submission":true},"language":"en"}""")
  val edited=JSONObject(old.toString());edited.getJSONObject("approval_required").put("drawing",false)
  val current=JSONObject(old.toString());current.getJSONObject("approval_required").put("submission",false);current.put("language","tr")
  val merged=ParentRules.mergeEdits(old,edited,current)
  assertFalse(merged.getJSONObject("approval_required").getBoolean("drawing"));assertFalse(merged.getJSONObject("approval_required").getBoolean("submission"));assertEquals("tr",merged.getString("language"))
 }
}

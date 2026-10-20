package app.tuto.mobile
import app.tuto.mobile.screentime.ScreenRules
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
import java.time.ZonedDateTime
class ScreenRulesTest {
 private fun policy()=JSONObject("""{"enabled":true,"weekday":60,"weekend":90,"weekendDays":[0,6],"start":"16:00","end":"20:00","apps":{"youtube":{"mode":"timed","limit":40},"roblox":{"mode":"timed","limit":30},"tuto":{"mode":"allowed","limit":0}}}""")
 private val now=ZonedDateTime.parse("2026-10-20T17:00:00+04:00[Asia/Dubai]")
 @Test fun budgetsAreSharedAndAppLimitWinsWhenReached(){
  assertEquals("app",ScreenRules.reason(policy(),"roblox",mapOf("roblox" to 1800),now))
  assertEquals("daily",ScreenRules.reason(policy(),"youtube",mapOf("roblox" to 1800,"youtube" to 1800),now))
  assertNull(ScreenRules.reason(policy(),"youtube",mapOf("roblox" to 1800,"youtube" to 1200,"tuto" to 18000),now))
 }
 @Test fun scheduleWorksAcrossMidnightAndZeroIsABlock(){
  val p=policy().put("start","20:00").put("end","07:00")
  assertEquals("schedule",ScreenRules.reason(p,"youtube",emptyMap(),now))
  assertNull(ScreenRules.reason(p,"youtube",emptyMap(),now.withHour(22)))
  p.put("weekday",0);assertEquals("daily",ScreenRules.reason(p,"youtube",emptyMap(),now.withHour(22)))
 }
 @Test fun disabledAndAllowedAppsAreNotBlocked(){
  assertNull(ScreenRules.reason(policy().put("enabled",false),"roblox",mapOf("roblox" to 10000),now))
  assertNull(ScreenRules.reason(policy(),"tuto",mapOf("tuto" to 18000),now.withHour(23)))
 }
 @Test fun boughtMinutesExtendBothBudgetsButExpireAndNeverBypassBlocks(){
  val bonus=JSONObject().put("day","2026-10-20").put("bonus",JSONObject().put("roblox",15))
  val usage=mapOf("roblox" to 1800L,"youtube" to 1800L)
  assertNull(ScreenRules.reason(policy(),"roblox",usage,now,bonus))
  assertEquals("daily",ScreenRules.reason(policy(),"roblox",usage,now.plusDays(1),bonus))
  assertEquals("schedule",ScreenRules.reason(policy(),"roblox",usage,now.withHour(23),bonus))
  val blocked=policy();blocked.getJSONObject("apps").getJSONObject("roblox").put("mode","blocked")
  assertEquals("blocked",ScreenRules.reason(blocked,"roblox",usage,now,bonus))
  assertEquals("app",ScreenRules.reason(policy(),"youtube",mapOf("youtube" to 2400L),now,bonus))
 }
}

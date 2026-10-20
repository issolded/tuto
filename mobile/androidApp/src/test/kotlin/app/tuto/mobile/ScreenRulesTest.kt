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
}

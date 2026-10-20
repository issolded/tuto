package app.tuto.mobile
import app.tuto.mobile.screentime.UsageBuckets
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
import java.time.Instant
import java.time.ZoneId
class UsageBucketsTest {
 @Test fun midnightSplitsWithoutLosingSubsecondTime(){
  val rows=JSONObject();val from=Instant.parse("2026-10-20T19:59:59.500Z").toEpochMilli()
  UsageBuckets.credit(rows,"youtube","YouTube",from,from+1500,ZoneId.of("Asia/Dubai"))
  assertEquals(500,rows.getJSONObject("2026-10-20|youtube").getLong("ms"))
  assertEquals(1000,rows.getJSONObject("2026-10-21|youtube").getLong("ms"))
 }
 @Test fun daylightSavingDayCanBe25Hours(){
  val z=ZoneId.of("Europe/London");val a=java.time.LocalDate.parse("2026-10-25").atStartOfDay(z).toInstant().toEpochMilli()
  val b=java.time.LocalDate.parse("2026-10-26").atStartOfDay(z).toInstant().toEpochMilli();val rows=JSONObject()
  UsageBuckets.credit(rows,"tuto","Tuto",a,b,z)
  assertEquals(90000000,rows.getJSONObject("2026-10-25|tuto").getLong("ms"))
 }
 @Test fun backwardsAndEmptyIntervalsDoNotCreateMeasurements(){val rows=JSONObject();UsageBuckets.credit(rows,"x","x",1000,999,ZoneId.of("UTC"));assertEquals(0,rows.length())}
}

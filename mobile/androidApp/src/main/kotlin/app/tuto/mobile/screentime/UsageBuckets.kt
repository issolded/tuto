package app.tuto.mobile.screentime
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
/** Split an interval at local midnights, preserving milliseconds until presentation/upload. */
object UsageBuckets {
 fun credit(rows:JSONObject,pkg:String,label:String,from:Long,to:Long,zone:ZoneId) {
  if(pkg.isBlank() || to<=from)return
  var cursor=from
  while(cursor<to) {
   val date=Instant.ofEpochMilli(cursor).atZone(zone).toLocalDate()
   val end=minOf(to,date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli())
   val key="$date|$pkg"
   val row=rows.optJSONObject(key)?:JSONObject().put("day",date.toString()).put("package",pkg).put("label",label).put("ms",0L)
   row.put("ms",row.optLong("ms")+end-cursor);rows.put(key,row);cursor=end
  }
 }
}

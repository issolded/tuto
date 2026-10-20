package app.tuto.mobile.screentime

import org.json.JSONObject
import java.time.ZonedDateTime

object ScreenRules {
    fun reason(policy:JSONObject, pkg:String, seconds:Map<String,Long>, now:ZonedDateTime):String? {
        if(!policy.optBoolean("enabled")) return null
        val apps=policy.optJSONObject("apps") ?: return null
        val app=apps.optJSONObject(pkg) ?: return null
        val mode=app.optString("mode","allowed")
        if(mode=="allowed") return null
        if(mode=="blocked") return "blocked"
        val start=policy.optString("start","00:00"); val end=policy.optString("end","00:00")
        val time=now.toLocalTime().toString().take(5)
        if(start!=end && !(if(start<end) time>=start && time<end else time>=start || time<end)) return "schedule"
        val weekend=policy.optJSONArray("weekendDays")?.let { a->(0 until a.length()).any { a.optInt(it)==now.dayOfWeek.value%7 } } ?: false
        val total=apps.keys().asSequence().filter { apps.optJSONObject(it)?.optString("mode")=="timed" }.sumOf { seconds[it] ?: 0L }
        if(total>=policy.optLong(if(weekend)"weekend" else "weekday",60)*60) return "daily"
        if((seconds[pkg] ?: 0L)>=app.optLong("limit",1440)*60) return "app"
        return null
    }
}

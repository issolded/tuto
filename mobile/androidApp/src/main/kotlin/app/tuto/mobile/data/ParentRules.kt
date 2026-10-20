package app.tuto.mobile.data

import org.json.JSONObject

/** Same persisted contract as src/lib/screenControl.js; this is a plan, not Android enforcement. */
object ParentRules {
    private val defaults = """{"weekday":30,"weekend":60,"cap":120,"gemsPerMinute":2,"earnedCap":30,"approval":true,"bedtime":true,"bedStart":"20:30","bedEnd":"07:00","school":true,"schoolStart":"08:00","schoolEnd":"15:00","apps":{"roblox":"timed","youtube":"timed","minecraft":"timed","tuto":"allowed"},"learnFirst":false,"learnNeed":1,"holiday":false,"holidayFrom":"","holidayTo":"","extra":null}"""
    fun complete(value: JSONObject): JSONObject {
        val result = JSONObject(defaults)
        value.keys().forEach { k -> result.put(k, value.get(k)) }
        val apps = JSONObject(defaults).getJSONObject("apps")
        value.optJSONObject("apps")?.let { old -> old.keys().forEach { apps.put(it, old.get(it)) } }
        result.put("apps", apps)
        return result
    }
    fun valid(r: JSONObject): Boolean {
        val time = Regex("([01][0-9]|2[0-3]):[0-5][0-9]")
        val day = Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}")
        return listOf("weekday", "weekend", "cap", "earnedCap").all { r.optInt(it, -1) in 0..480 } &&
            r.optInt("cap") >= maxOf(r.optInt("weekday"), r.optInt("weekend"), r.optInt("earnedCap")) &&
            r.optInt("gemsPerMinute") in 1..100 && r.optInt("learnNeed") in 1..5 &&
            listOf("bedStart", "bedEnd", "schoolStart", "schoolEnd").all { time.matches(r.optString(it)) } &&
            (!r.optBoolean("bedtime") || r.optString("bedStart") != r.optString("bedEnd")) &&
            (!r.optBoolean("school") || r.optString("schoolStart") != r.optString("schoolEnd")) &&
            listOf("roblox", "youtube", "minecraft", "tuto").all { r.optJSONObject("apps")?.optString(it) in setOf("timed", "allowed", "blocked") } &&
            r.optJSONObject("apps")?.optString("tuto") == "allowed" &&
            (!r.optBoolean("holiday") || (day.matches(r.optString("holidayFrom")) && day.matches(r.optString("holidayTo")) && r.optString("holidayFrom") <= r.optString("holidayTo"))) &&
            (r.isNull("extra") || (r.optJSONObject("extra")?.let { day.matches(it.optString("date")) && it.optInt("minutes", -1) in 0..120 } == true))
    }
    /** Apply only edited leaves onto the latest server version, preserving other-device edits. */
    fun mergeEdits(original: JSONObject, edited: JSONObject, current: JSONObject): JSONObject {
        val out = JSONObject(current.toString())
        edited.keys().forEach { key ->
            val old = original.opt(key); val next = edited.opt(key)
            if (old is JSONObject && next is JSONObject) out.put(key, mergeEdits(old, next, current.optJSONObject(key) ?: JSONObject()))
            else if (old?.toString() != next?.toString()) out.put(key, next)
        }
        return out
    }
}

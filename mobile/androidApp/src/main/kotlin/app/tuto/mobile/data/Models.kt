package app.tuto.mobile.data

import org.json.JSONObject

data class ChildSummary(val id: String, val name: String, val age: Int?) {
    companion object {
        fun from(j: JSONObject) = ChildSummary(j.optString("id"), j.optString("name"), if (j.has("age") && !j.isNull("age")) j.optInt("age") else null)
    }
}

/** The child as verify-pin returns it. Kept as JSON too, so it survives a restart unchanged. */
data class Child(
    val id: String,
    val name: String,
    val age: Int,
    /** children.language — the language the CHILD reads. Never the parent's prefs.language. */
    val language: String,
    /** Per-activity settings the parent chose: active, gems, daily_cap. */
    val taskSettings: JSONObject,
    val raw: JSONObject,
) {
    /** Whether the parent has this activity switched on. Missing means on, as on the web. */
    fun active(type: String): Boolean = taskSettings.optJSONObject(type)?.optBoolean("active", true) ?: true
    fun gemsFor(type: String): Int? = taskSettings.optJSONObject(type)?.let { if (it.has("gems")) it.optInt("gems") else null }

    companion object {
        private val KNOWN = setOf("en", "tr", "es")
        fun from(j: JSONObject) = Child(
            id = j.optString("id"),
            name = j.optString("name"),
            age = if (j.has("age") && !j.isNull("age")) j.optInt("age") else 7,
            language = j.optString("language").takeIf { it in KNOWN } ?: "en",
            taskSettings = j.optJSONObject("task_settings") ?: JSONObject(),
            raw = j,
        )
    }
}

data class Goal(val id: String, val name: String, val icon: String, val cost: Int)

/** /api/children/:id/today-summary — the same figures the web home reads. */
data class Today(
    val treeToday: Int,
    val activities: Map<String, Int>,
    val streak: Int,
    val mathLevel: Int?,
    val gems: Int,
    val nearestGoal: Goal?,
    val hasAnyGoals: Boolean,
    val bonusActive: Boolean,
    val bonusGems: Int,
    val bonusTypes: List<String>,
    val bonusEarned: Boolean,
) {
    fun done(type: String) = (activities[type] ?: 0) > 0

    companion object {
        val EMPTY = Today(0, emptyMap(), 0, null, 0, null, false, false, 0, emptyList(), false)
        fun from(j: JSONObject): Today {
            val acts = j.optJSONObject("activities")
            val map = buildMap { acts?.keys()?.forEach { k -> put(k, acts.optInt(k)) } }
            val goal = j.optJSONObject("nearestGoal")?.let {
                Goal(it.optString("id"), it.optString("name"), it.optString("icon"), it.optInt("bt_cost"))
            }
            val bonus = j.optJSONObject("bonus")
            return Today(
                treeToday = j.optInt("today"),
                activities = map,
                streak = j.optInt("streak"),
                mathLevel = if (j.has("mathLevel") && !j.isNull("mathLevel")) j.optInt("mathLevel") else null,
                gems = j.optInt("gems"),
                nearestGoal = goal,
                hasAnyGoals = j.optBoolean("hasAnyGoals"),
                bonusActive = bonus?.optBoolean("active") ?: false,
                bonusGems = bonus?.optInt("gems") ?: 0,
                bonusTypes = bonus?.optJSONArray("types")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList(),
                bonusEarned = bonus?.optBoolean("earned") ?: false,
            )
        }
    }
}

data class MathPlan(val level: Int?, val focusTopicId: String?, val weakTopicIds: List<String>) {
    companion object {
        fun from(j: JSONObject) = MathPlan(
            level = if (j.has("level") && !j.isNull("level")) j.optInt("level") else null,
            focusTopicId = j.optJSONObject("focus")?.optStringOrNull("topic_id"),
            weakTopicIds = j.optJSONArray("weak_topic_ids")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList(),
        )
    }
}

data class Reward(val id: String, val name: String, val icon: String, val cost: Int) {
    companion object { fun from(j: JSONObject) = Reward(j.optString("id"), j.optString("name"), j.optString("icon").ifEmpty { "🎁" }, j.optInt("bt_cost")) }
}

data class Claim(val id: String, val rewardId: String, val status: String) {
    companion object { fun from(j: JSONObject) = Claim(j.optString("id"), j.optString("reward_id"), j.optString("status")) }
}

data class Suggestion(val id: String, val name: String, val icon: String, val gems: Int?, val status: String) {
    companion object {
        fun from(j: JSONObject) = Suggestion(
            j.optString("id"), j.optString("name"), j.optString("icon").ifEmpty { "🎁" },
            if (j.has("suggested_gems") && !j.isNull("suggested_gems")) j.optInt("suggested_gems") else null, j.optString("status"),
        )
    }
}

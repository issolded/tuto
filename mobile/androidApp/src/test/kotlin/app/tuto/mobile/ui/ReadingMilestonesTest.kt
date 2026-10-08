package app.tuto.mobile.ui

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class ReadingMilestonesTest {
    @Test fun unfinishedMissingIdsAndRepeatedRowsDoNotEarnAnotherBook() {
        val finished = JSONObject().put("id", "read-book").put("completed", true)
        val active = JSONObject().put("id", "active").put("completed", false)
        val malformed = JSONObject().put("completed", true)
        assertEquals(1, completedBookCount(listOf(finished, JSONObject(finished.toString()), active, malformed)))
    }
    @Test fun allFourMilestonesUnlockAtTheirExactThresholds() {
        assertEquals(listOf(10, 50, 100, 150), ReadingMilestones)
        for (threshold in ReadingMilestones) {
            val records = (1..threshold).map { JSONObject().put("id", "book-$it").put("completed", true) }
            assertEquals(threshold, completedBookCount(records))
            assertEquals(threshold - 1, completedBookCount(records.dropLast(1)))
        }
    }
}

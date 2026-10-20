package app.tuto.mobile.data

import org.json.JSONObject

interface PuzzleRenderer {
    suspend fun drawPuzzle(specs: List<JSONObject?>, px: Int): List<String?>
}

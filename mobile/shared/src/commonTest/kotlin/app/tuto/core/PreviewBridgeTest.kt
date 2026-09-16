package app.tuto.core
import kotlin.test.*
import kotlinx.serialization.json.*
class PreviewBridgeTest {
    @Test fun restartPreservesHintFeedbackAndSingleReward() {
        var bridge=PreviewBridge("")
        bridge.start("one","MATH",123,true); bridge.hint()
        bridge=PreviewBridge(bridge.snapshot())
        assertTrue(Json.parseToJsonElement(bridge.snapshot()).jsonObject["helped"]!!.jsonPrimitive.boolean)
        repeat(5) {
            val q=Json.parseToJsonElement(bridge.snapshot()).jsonObject["session"]!!.jsonObject["questions"]!!.jsonArray[it].jsonObject
            bridge.select(q["answer"]!!.jsonPrimitive.int); bridge.check(1L)
            bridge=PreviewBridge(bridge.snapshot()); bridge.check(2L); bridge.next()
        }
        val state=Json.parseToJsonElement(bridge.snapshot()).jsonObject
        assertEquals(10,state["balance"]!!.jsonPrimitive.int)
        assertEquals(4,state["session"]!!.jsonObject["independentCount"]!!.jsonPrimitive.int)
        assertEquals(1,state["entries"]!!.jsonArray.size)
    }
}

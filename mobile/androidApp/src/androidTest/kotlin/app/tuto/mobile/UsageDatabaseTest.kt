package app.tuto.mobile

import androidx.test.platform.app.InstrumentationRegistry
import app.tuto.mobile.screentime.UsageDatabase
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/** Uses real Android SQLite; exercises retries and concurrent collection during upload. */
class UsageDatabaseTest {
 private fun row(ms:Long)=JSONObject().put("day","2026-10-20").put("package","app.test").put("label","Test").put("ms",ms)
 @Test fun uploadAcknowledgesOnlyItsSnapshotAndRetryDoesNotLoseNewUsage(){
  val ctx=InstrumentationRegistry.getInstrumentation().targetContext
  val db=UsageDatabase(ctx)
  try {
   db.reset(1000);db.add(row(1500))
   val uploaded=db.pending();assertEquals(1,uploaded.single().getInt("seconds"))
   db.add(row(1500));db.acknowledge(uploaded,"2026-07-01")
   assertEquals(3,db.pending().single().getInt("seconds"))
   db.acknowledge(uploaded,"2026-07-01")
   assertEquals(3000L,db.pending().single().getLong("ms"))
   db.acknowledge(db.pending(),"2026-07-01")
   assertTrue(db.pending().isEmpty());assertEquals(3L,db.today("2026-10-20")["app.test"])
  } finally {db.reset(0);db.close()}
 }
 @Test fun failedTransactionRollsBackCountersAndReplayCursorTogether(){
  val ctx=InstrumentationRegistry.getInstrumentation().targetContext
  val helper=UsageDatabase(ctx)
  try {
   helper.reset(1000)
   val db=helper.writableDatabase;db.beginTransaction()
   try {helper.add(row(2000));helper.writeState("cursor","3000")} finally {db.endTransaction()}
   assertEquals("1000",helper.readState("cursor","missing"));assertTrue(helper.pending().isEmpty())
  } finally {helper.reset(0);helper.close()}
 }
}

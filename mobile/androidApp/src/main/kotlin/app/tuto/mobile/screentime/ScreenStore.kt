package app.tuto.mobile.screentime

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import android.provider.Settings
import app.tuto.mobile.BuildConfig
import app.tuto.mobile.data.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import org.json.JSONArray
import java.time.Instant
import java.time.ZoneId

/** One device identity, independent of the child's educational PIN/session. */
class ScreenStore(private val context:Context) {
    private val prefs=context.getSharedPreferences("tuto-screen",Context.MODE_PRIVATE)
    private val secret=ParentCredentials(context,"screen-device")
    val paired get()=secret.read()!=null
    val policy get()=JSONObject(prefs.getString("policy","{}")!!)
    val zone get()=runCatching {ZoneId.of(policy.optString("timezone","Asia/Dubai"))}.getOrDefault(ZoneId.of("Asia/Dubai"))
    val usageAccess get()=(context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager).checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,Process.myUid(),context.packageName)==AppOpsManager.MODE_ALLOWED
    val accessibility get()=Settings.Secure.getString(context.contentResolver,Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty().split(':').any { it=="${context.packageName}/${ScreenAccessService::class.java.name}" || it=="${context.packageName}/.screentime.ScreenAccessService" }
    val notificationsEnabled get()=androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled()
    fun showNotification() {
        if(!paired || !notificationsEnabled)return
        val manager=context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        manager.createNotificationChannel(android.app.NotificationChannel("screen-time","Tuto screen time",android.app.NotificationManager.IMPORTANCE_LOW))
        val pending=android.app.PendingIntent.getActivity(context,0,android.content.Intent(context,app.tuto.mobile.MainActivity::class.java),android.app.PendingIntent.FLAG_IMMUTABLE)
        manager.notify(3001,androidx.core.app.NotificationCompat.Builder(context,"screen-time").setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("Tuto screen time").setContentText("App usage is shared with your linked parent").setOngoing(true).setContentIntent(pending).build())
    }
    val lastSync get()=prefs.getLong("sync",0)
    val childId get()=secret.read()?.optString("child_id").orEmpty()
    suspend fun enroll(code:String, expectedChild:String) {
        check(!paired)
        val j=JSONObject(http(BuildConfig.SERVER_URL+"/api/device-screen/enroll","POST",JSONObject().put("code",code).put("child_id",expectedChild).put("name",android.os.Build.MODEL).toString().toByteArray()))
        // The parent-owned pairing code is authoritative, never a user-supplied child UUID.
        require(j.optString("child_id")==expectedChild) {"Pairing code belongs to another child"}
        prefs.edit().clear().commit()
        secret.write(j)
        showNotification()
        prefs.edit().putLong("since",System.currentTimeMillis()).putLong("cursor",System.currentTimeMillis()).apply()
        ScreenSyncWorker.schedule(context)
        sync()
    }
    fun collect():Unit = synchronized(collectLock) {
        if(!paired || !usageAccess || !notificationsEnabled) return
        val now=System.currentTimeMillis();val from=prefs.getLong("cursor",now)
        if(now<from) return // Do not credit time twice after a backwards clock change.
        val rows=JSONObject(prefs.getString("rows","{}")!!)
        var pkg=prefs.getString("foreground","").orEmpty()
        var visible=prefs.getBoolean("visible",false)
        var at=from
        fun credit(until:Long) {
            var cursor=at
            if(visible && pkg.isNotBlank()) {
                while(cursor<until) {
                    val date=Instant.ofEpochMilli(cursor).atZone(zone).toLocalDate()
                    val end=minOf(until,date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli())
                    val key="$date|$pkg";val row=rows.optJSONObject(key) ?: JSONObject().put("day",date.toString()).put("package",pkg).put("label",label(pkg)).put("ms",0L)
                    row.put("ms",row.optLong("ms")+end-cursor);rows.put(key,row);cursor=end
                }
            }
            at=until
        }
        val events=(context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager).queryEvents(from,now) ?: return
        val e=UsageEvents.Event()
        while(events.hasNextEvent()) {
            events.getNextEvent(e);if(e.timeStamp<from || e.timeStamp>now)continue
            credit(e.timeStamp)
            when(e.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED->{pkg=e.packageName.orEmpty();visible=true}
                UsageEvents.Event.ACTIVITY_PAUSED->if(pkg==e.packageName){pkg=""}
                UsageEvents.Event.SCREEN_NON_INTERACTIVE,UsageEvents.Event.KEYGUARD_SHOWN->{visible=false;pkg=""}
                UsageEvents.Event.DEVICE_SHUTDOWN->{visible=false;pkg=""}
            }
        }
        credit(now)
        // Keep a rolling 93-day local retry cache; server holds report history.
        val cutoff=Instant.ofEpochMilli(now).atZone(zone).toLocalDate().minusDays(93).toString()
        rows.keys().asSequence().toList().filter {it.take(10)<cutoff}.forEach(rows::remove)
        prefs.edit().putString("rows",rows.toString()).putLong("cursor",now).putString("foreground",pkg).putBoolean("visible",visible).commit()
        Unit
    }
    private fun label(pkg:String)=runCatching {context.packageManager.getApplicationLabel(context.packageManager.getApplicationInfo(pkg,0)).toString()}.getOrDefault(pkg)
    fun today():Map<String,Long> {
        val day=Instant.now().atZone(zone).toLocalDate().toString();val rows=JSONObject(prefs.getString("rows","{}")!!)
        return rows.keys().asSequence().filter {it.startsWith("$day|")}.associate { val r=rows.getJSONObject(it);r.getString("package") to r.optLong("ms")/1000 }
    }
    suspend fun sync()=syncMutex.withLock {
        val auth=secret.read() ?: return@withLock
        showNotification()
        collect()
        val rows=JSONObject(prefs.getString("rows","{}")!!)
        val data=rows.keys().asSequence().map { rows.getJSONObject(it).let { r->JSONObject().put("day",r.getString("day")).put("package",r.getString("package")).put("label",r.getString("label")).put("seconds",(r.optLong("ms")/1000).coerceAtMost(90000)) } }.toList()
        for(batch in (if(data.isEmpty()) listOf(emptyList()) else data.chunked(3000))) {
            val body=JSONObject().put("rows",JSONArray(batch)).put("applied_revision",prefs.getLong("revision",0)).put("status",JSONObject().put("usage_access",usageAccess).put("accessibility",accessibility).put("notifications",notificationsEnabled).put("timezone",zone.id).put("measured_since",Instant.ofEpochMilli(prefs.getLong("since",System.currentTimeMillis())).toString()))
            try {
                val response=JSONObject(http(BuildConfig.SERVER_URL+"/api/device-screen/sync","POST",body.toString().toByteArray(),mapOf("Authorization" to "Bearer ${auth.getString("token")}")))
                prefs.edit().putString("policy",response.getJSONObject("policy").toString()).putLong("revision",response.getLong("revision")).putLong("sync",System.currentTimeMillis()).commit()
            } catch(e:ApiFailure) {
                if(e.status==401) {(context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager).cancel(3001);secret.write(null);prefs.edit().putString("policy","{}").commit()}
                throw e
            }
        }
    }
    companion object { private val syncMutex=Mutex(); private val collectLock=Any() }
}

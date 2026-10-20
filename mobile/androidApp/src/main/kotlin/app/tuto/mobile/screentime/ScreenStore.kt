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
    private val usage=UsageDatabase(context)
    private val secret=ParentCredentials(context,"screen-device")
    val paired get()=secret.read()!=null
    val policy get()=JSONObject(prefs.getString("policy","{}")!!)
    val zone get()=runCatching {ZoneId.of(policy.optString("timezone","Asia/Dubai"))}.getOrDefault(ZoneId.of("Asia/Dubai"))
    val usageAccess get()=(context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager).checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,Process.myUid(),context.packageName)==AppOpsManager.MODE_ALLOWED
    val accessibility get()=Settings.Secure.getString(context.contentResolver,Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty().split(':').any { it=="${context.packageName}/${ScreenAccessService::class.java.name}" || it=="${context.packageName}/.screentime.ScreenAccessService" }
    val notificationsEnabled get()=androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled()
    fun showNotification() {
        if(!paired || !notificationsEnabled)return
        if(android.os.Build.VERSION.SDK_INT>=33 && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)return
        val manager=context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        manager.createNotificationChannel(android.app.NotificationChannel("screen-time","Tuto screen time",android.app.NotificationManager.IMPORTANCE_LOW))
        val pending=android.app.PendingIntent.getActivity(context,0,android.content.Intent(context,app.tuto.mobile.MainActivity::class.java),android.app.PendingIntent.FLAG_IMMUTABLE)
        manager.notify(3001,androidx.core.app.NotificationCompat.Builder(context,"screen-time").setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("Tuto screen time").setContentText("App usage is shared with your linked parent").setOngoing(true).setContentIntent(pending).build())
    }
    val shop get()=JSONObject(prefs.getString("shop","{}")!!)
    val pendingPurchase get()=prefs.getString("purchase_pending",null)?.let {JSONObject(it)}
    suspend fun loadShop()=syncMutex.withLock {
        val auth=secret.read() ?: error("not_paired")
        val result=JSONObject(http(BuildConfig.SERVER_URL+"/api/device-screen/shop",headers=mapOf("Authorization" to "Bearer ${auth.getString("token")}")))
        prefs.edit().putString("shop",result.toString()).commit()
        result
    }
    suspend fun buyMinutes(pkg:String,expectedChild:String)=syncMutex.withLock {
        val auth=secret.read() ?: error("not_paired")
        require(auth.optString("child_id")==expectedChild)
        val request=pendingPurchase ?: JSONObject().put("request_id",java.util.UUID.randomUUID().toString()).put("package",pkg).put("revision",shop.optLong("revision"))
        require(request.optString("package")==pkg)
        check(prefs.edit().putString("purchase_pending",request.toString()).commit())
        try {
            val result=JSONObject(http(BuildConfig.SERVER_URL+"/api/device-screen/purchase","POST",request.toString().toByteArray(),mapOf("Authorization" to "Bearer ${auth.getString("token")}")))
            prefs.edit().putString("shop",result.toString()).remove("purchase_pending").commit()
            result
        } catch(e:ApiFailure) {
            if(e.status in listOf(400,401,403,409))prefs.edit().remove("purchase_pending").commit()
            throw e
        }
    }
    val lastSync get()=prefs.getLong("sync",0)
    val childId get()=secret.read()?.optString("child_id").orEmpty()
    suspend fun enroll(code:String, expectedChild:String) {
        check(!paired)
        val j=JSONObject(http(BuildConfig.SERVER_URL+"/api/device-screen/enroll","POST",JSONObject().put("code",code).put("child_id",expectedChild).put("name",android.os.Build.MODEL).toString().toByteArray()))
        // The parent-owned pairing code is authoritative, never a user-supplied child UUID.
        require(j.optString("child_id")==expectedChild) {"Pairing code belongs to another child"}
        prefs.edit().clear().commit()
        usage.reset(System.currentTimeMillis())
        secret.write(j)
        showNotification()
        prefs.edit().putLong("since",System.currentTimeMillis()).putLong("cursor",System.currentTimeMillis()).apply()
        ScreenSyncWorker.schedule(context)
        sync()
    }
    fun collect():Unit = synchronized(collectLock) {
        if(!paired) return
        val db=usage.writableDatabase
        db.beginTransaction()
        try {
            val now=System.currentTimeMillis()
            if(!usageAccess || !notificationsEnabled) {
                usage.writeState("cursor",now.toString());usage.writeState("foreground","");usage.writeState("visible","false")
                db.setTransactionSuccessful();return
            }
            val from=usage.readState("cursor",now.toString()).toLong()
            if(now<from)return
            var pkg=usage.readState("foreground","")
            var visible=usage.readState("visible","false").toBoolean()
            var at=from
            fun credit(until:Long) {
                if(visible && pkg.isNotBlank()) {
                    val increments=JSONObject()
                    UsageBuckets.credit(increments,pkg,label(pkg),at,until,zone)
                    increments.keys().forEach {usage.add(increments.getJSONObject(it))}
                }
                at=until
            }
            val events=(context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager).queryEvents(from,now) ?: return
            val e=UsageEvents.Event()
            while(events.hasNextEvent()) {
                events.getNextEvent(e);if(e.timeStamp<from || e.timeStamp>now)continue
                if(e.eventType==UsageEvents.Event.DEVICE_STARTUP) {visible=false;pkg="";at=e.timeStamp;continue}
                credit(e.timeStamp)
                when(e.eventType) {
                    UsageEvents.Event.ACTIVITY_RESUMED->{pkg=e.packageName.orEmpty();visible=true}
                    UsageEvents.Event.ACTIVITY_PAUSED->if(pkg==e.packageName){pkg=""}
                    UsageEvents.Event.SCREEN_NON_INTERACTIVE,UsageEvents.Event.KEYGUARD_SHOWN,UsageEvents.Event.DEVICE_SHUTDOWN->{visible=false;pkg=""}
                }
            }
            credit(now)
            usage.writeState("cursor",now.toString());usage.writeState("foreground",pkg);usage.writeState("visible",visible.toString())
            db.setTransactionSuccessful()
        } finally {db.endTransaction()}
    }
    private fun label(pkg:String)=runCatching {context.packageManager.getApplicationLabel(context.packageManager.getApplicationInfo(pkg,0)).toString()}.getOrDefault(pkg)
    fun today():Map<String,Long> = usage.today(Instant.now().atZone(zone).toLocalDate().toString())
    suspend fun sync()=syncMutex.withLock {
        val auth=secret.read() ?: return@withLock
        showNotification()
        collect()
        val data=usage.pending()
        for(batch in (if(data.isEmpty()) listOf(emptyList()) else data.chunked(3000))) {
            val body=JSONObject().put("rows",JSONArray(batch)).put("applied_revision",prefs.getLong("revision",0)).put("status",JSONObject().put("usage_access",usageAccess).put("accessibility",accessibility).put("notifications",notificationsEnabled).put("timezone",zone.id).put("measured_since",Instant.ofEpochMilli(prefs.getLong("since",System.currentTimeMillis())).toString()))
            try {
                val response=JSONObject(http(BuildConfig.SERVER_URL+"/api/device-screen/sync","POST",body.toString().toByteArray(),mapOf("Authorization" to "Bearer ${auth.getString("token")}")))
                usage.acknowledge(batch,Instant.now().atZone(zone).toLocalDate().minusDays(93).toString())
                prefs.edit().putString("shop",response.optJSONObject("shop")?.toString()?:"{}").putString("policy",response.getJSONObject("policy").toString()).putLong("revision",response.getLong("revision")).putLong("sync",System.currentTimeMillis()).commit()
            } catch(e:ApiFailure) {
                if(e.status==401) {(context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager).cancel(3001);secret.write(null);prefs.edit().putString("policy","{}").commit()}
                throw e
            }
        }
    }
    companion object { private val syncMutex=Mutex(); private val collectLock=Any() }
}

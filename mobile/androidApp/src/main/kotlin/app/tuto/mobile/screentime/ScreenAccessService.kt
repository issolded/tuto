package app.tuto.mobile.screentime

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import android.view.WindowManager
import android.view.Gravity
import android.graphics.Color
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Button
import kotlinx.coroutines.*
import java.time.ZonedDateTime

/** Only package/window events; never requests view contents or reads messages/screens. */
class ScreenAccessService:AccessibilityService() {
 private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main)
 private lateinit var store:ScreenStore
 private var foreground=""
 private var overlay:LinearLayout?=null
 private var tick=0
 override fun onServiceConnected() {
  store=ScreenStore(this);store.showNotification();ScreenSyncWorker.schedule(this)
  scope.launch {while(isActive){
   withContext(Dispatchers.IO){store.collect()}
   enforce()
   if(tick++%30==0) launch {runCatching {store.sync()}}
   delay(2000)
  }}
 }
 override fun onAccessibilityEvent(event:AccessibilityEvent?) {
  if(event?.eventType==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
   val pkg=event.packageName?.toString().orEmpty()
   if(pkg.isNotEmpty() && pkg!=packageName) foreground=pkg
   else if(pkg==packageName && overlay==null) foreground=pkg
   if(::store.isInitialized)enforce()
  }
 }
 private fun enforce() {
  if(!store.paired || !store.usageAccess || !store.notificationsEnabled){hide();return}
  val reason=ScreenRules.reason(store.policy,foreground,store.today(),ZonedDateTime.now(store.zone))
  if(reason==null){hide();return}
  if(overlay!=null)return
  // Return to the launcher so blocked video/game time does not keep accruing behind the shield.
  performGlobalAction(GLOBAL_ACTION_HOME)
  val layout=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER;setPadding(48,48,48,48);setBackgroundColor(Color.rgb(250,247,241))}
  fun text(en:String,tr:String,es:String)=when(resources.configuration.locales[0].language){"tr"->tr;"es"->es;else->en}
  layout.addView(TextView(this).apply {this.text=text("Time for a break","Mola zamanı","Hora de descansar");textSize=28f;setTextColor(Color.rgb(15,36,70));gravity=Gravity.CENTER})
  layout.addView(TextView(this).apply {this.text=text("Your parent's screen-time rule applies. Ask your parent to change it.","Ebeveyninin ekran süresi kuralı geçerli. Değişiklik için ebeveynine sor.","Se aplica la regla familiar de tiempo de pantalla. Pide un cambio a tu familia.");textSize=18f;gravity=Gravity.CENTER})
  layout.addView(Button(this).apply {this.text=text("Home","Ana ekran","Inicio");setOnClickListener {performGlobalAction(GLOBAL_ACTION_HOME);foreground="";hide()}})
  val params=WindowManager.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT,WindowManager.LayoutParams.MATCH_PARENT,WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,android.graphics.PixelFormat.OPAQUE)
  runCatching {(getSystemService(WINDOW_SERVICE) as WindowManager).addView(layout,params);overlay=layout}
 }
 private fun hide(){overlay?.let {runCatching {(getSystemService(WINDOW_SERVICE) as WindowManager).removeView(it)}};overlay=null}
 override fun onInterrupt(){hide()}
 override fun onDestroy(){hide();scope.cancel();super.onDestroy()}
}

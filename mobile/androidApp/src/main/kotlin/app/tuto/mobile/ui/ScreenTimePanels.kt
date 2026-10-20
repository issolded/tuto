package app.tuto.mobile.ui

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.tuto.mobile.data.*
import app.tuto.mobile.ParentRun
import app.tuto.mobile.screentime.*
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.time.Instant

@Composable fun DeviceScreenSetup(childId:String) {
 val s=LocalStrings.current;val context=LocalContext.current;val store=remember {ScreenStore(context)};val scope=rememberCoroutineScope()
 var code by remember {mutableStateOf("")};var busy by remember {mutableStateOf(false)};var note by remember {mutableStateOf("")};var refresh by remember {mutableIntStateOf(0)}
 var consent by remember {mutableStateOf(false)}
 Card(Modifier.fillMaxWidth()) {Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
  Text(s.say("Screen time","Ekran süresi","Tiempo de pantalla"),style=MaterialTheme.typography.titleLarge)
  Text(s.say("This device reports app names and foreground usage durations to your linked parent. It does not read messages or screen contents. Limits apply on this device, even when another child signs into Tuto.","Bu cihaz, uygulama adlarını ve ön plandaki kullanım sürelerini bağlı ebeveyne gönderir. Mesajları veya ekran içeriklerini okumaz. Tuto'ya başka çocuk girse de kurallar bu cihazda geçerlidir.","Este dispositivo envía nombres de aplicaciones y tiempo de uso a la familia vinculada. No lee mensajes ni pantallas. Las reglas siguen aplicándose aunque otro niño entre en Tuto."))
  if(!store.paired) {
   OutlinedTextField(code,{code=it.uppercase().filter(Char::isLetterOrDigit).take(12)},label={Text(s.say("Parent pairing code","Ebeveyn eşleştirme kodu","Código de vinculación"))})
   Row {Checkbox(consent,{consent=it});Text(s.say("My parent agrees to usage reporting and app limits.","Ebeveynim kullanım raporlamasını ve uygulama limitlerini onaylıyor.","Mi familia acepta los informes de uso y límites."))}
   Button({busy=true;scope.launch {try {store.enroll(code,childId);refresh++;note=s.say("Connected","Bağlandı","Conectado")}catch(e:Exception){note=s.say("Could not connect. Check the code and server setup.","Bağlanamadı. Kodu ve sunucu kurulumunu kontrol edin.","No se pudo conectar. Comprueba el código y la configuración.")}finally{busy=false}}},enabled=consent&&code.length==12&&!busy){Text(s.say("Connect","Bağlan","Conectar"))}
  } else {
   Text(s.say("Linked to child","Bağlı çocuk","Vinculado al niño")+": "+store.childId.take(8))
   Text("${s.say("Usage access","Kullanım erişimi","Acceso al uso")}: ${store.usageAccess} · ${s.say("Protection","Koruma","Protección")}: ${store.accessibility}")
   if(android.os.Build.VERSION.SDK_INT>=33) Button({(context as? android.app.Activity)?.requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),3001)}) {Text(s.say("Allow visible monitoring notification","Görünür kullanım bildirimi için izin ver","Permitir notificación visible de supervisión"))}
   Text(s.say("Usage reporting and limits require notifications to be enabled.","Kullanım raporu ve limitler için bildirimler etkin olmalı.","Los informes y límites requieren notificaciones activadas."))
   Button({context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))}) {Text(s.say("Allow usage access","Kullanım erişimine izin ver","Permitir acceso al uso"))}
   Button({context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))}) {Text(s.say("Enable Tuto protection","Tuto korumasını etkinleştir","Activar protección Tuto"))}
   Text(s.say("Accessibility is used only to identify the active app and show the parent's restriction. Enable Tuto in the Android settings after reviewing this disclosure.","Erişilebilirlik yalnızca aktif uygulamayı belirlemek ve ebeveyn kısıtlamasını göstermek için kullanılır. Bu açıklamayı okuduktan sonra Android ayarlarında Tuto'yu etkinleştirin.","La accesibilidad identifica la aplicación activa y muestra la restricción familiar. Activa Tuto en Ajustes tras leer este aviso."))
   Button({busy=true;scope.launch {try{store.sync();refresh++;note=s.say("Synced","Eşitlendi","Sincronizado")}catch(e:Exception){note=s.say("Connection failed","Bağlantı başarısız","Error de conexión")}finally{busy=false}}},enabled=!busy){Text(s.say("Refresh permissions & sync","İzinleri yenile ve eşitle","Actualizar permisos y sincronizar"))}
   if(refresh>=0 && store.lastSync>0)Text(Instant.ofEpochMilli(store.lastSync).atZone(store.zone).toString())
  }
  if(note.isNotBlank())Text(note)
 }}
}

@OptIn(ExperimentalLayoutApi::class)
@Composable fun NativeScreenDashboard(p:ParentRun) {
 val s=LocalStrings.current;val scope=rememberCoroutineScope();val id=p.selected!!.getString("id")
 var state by remember(id){mutableStateOf<JSONObject?>(null)};var policy by remember(id){mutableStateOf(JSONObject())};var rows by remember(id){mutableStateOf<List<JSONObject>?>(null)}
 var period by remember {mutableStateOf("day")};var day by remember {mutableStateOf(LocalDate.now())};var device by remember {mutableStateOf("")};var code by remember {mutableStateOf("")}
 var revoke by remember {mutableStateOf<String?>(null)}
 var error by remember {mutableStateOf("")};var busy by remember {mutableStateOf(false)};var saved by remember {mutableStateOf(false)}
 val root="/api/parent/children/${enc(id)}/device-screen"
 suspend fun load(){val j=p.cloud.parentCall("GET",root);state=j;policy=j.getJSONObject("policy")}
 fun act(block:suspend()->Unit){if(busy)return;busy=true;error="";scope.launch{try{block()}catch(e:Exception){error=s.say("Could not save/load. Check connection, server setup, or refresh changed rules.","Kaydedilemedi/yüklenemedi. Bağlantıyı, sunucu kurulumunu kontrol edin veya değişen kuralları yenileyin.","No se pudo guardar/cargar. Comprueba conexión, configuración o actualiza las reglas.")}finally{busy=false}}}
 fun edit(k:String,v:Any){policy=JSONObject(policy.toString()).put(k,v);saved=false}
 LaunchedEffect(id){try{load();day=LocalDate.now(ZoneId.of(policy.optString("timezone","Asia/Dubai")))}catch(e:Exception){error=s.say("Device screen time is not ready on the server.","Sunucuda cihaz ekran süresi henüz hazır değil.","El tiempo de pantalla aún no está listo en el servidor.")}}
 val from=when(period){"week"->day.minusDays((day.dayOfWeek.value-1).toLong());"month"->day.withDayOfMonth(1);else->day}
 val to=when(period){"week"->from.plusDays(6);"month"->from.plusMonths(1).minusDays(1);else->from}
 LaunchedEffect(id,from,to,device){rows=null;try{rows=p.cloud.parentCall("GET","$root/usage?from=$from&to=$to"+if(device.isBlank())"" else "&device=${enc(device)}").optJSONArray("rows").objects()}catch(e:Exception){error=s.say("Usage data unavailable","Kullanım verisine ulaşılamadı","Uso no disponible")}}
 if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
 if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
 if(state==null){Button({act{load()}}){Text(s.say("Retry","Tekrar dene","Reintentar"))};return}
 Text(s.say("Device usage","Cihaz kullanımı","Uso del dispositivo"),style=MaterialTheme.typography.headlineSmall)
 FlowRow {listOf("day" to s.say("Day","Gün","Día"),"week" to s.say("Week","Hafta","Semana"),"month" to s.say("Month","Ay","Mes")).forEach {(v,label)->FilterChip(period==v,{period=v},label={Text(label)})}}
 Row {TextButton({day=when(period){"week"->day.minusWeeks(1);"month"->day.minusMonths(1);else->day.minusDays(1)}}){Text("←")};Text("$from — $to");TextButton({day=when(period){"week"->day.plusWeeks(1);"month"->day.plusMonths(1);else->day.plusDays(1)}}){Text("→")}}
 val devices=state!!.optJSONArray("devices").objects()
 FlowRow {FilterChip(device.isBlank(),{device=""},label={Text(s.say("All devices (sum)","Tüm cihazlar (toplam)","Todos (suma)"))});devices.forEach {d->FilterChip(device==d.optString("id"),{device=d.optString("id")},label={Text(d.optString("name"))})}}
 fun duration(n:Long)="${n/3600}h ${(n%3600)/60}m"
 val total=rows?.sumOf {it.optLong("seconds")} ?: 0
 Text(duration(total),style=MaterialTheme.typography.headlineLarge)
 if(rows==null)Text(s.say("Loading","Yükleniyor","Cargando"))
 else if(rows!!.isEmpty())Text(s.say("No measurements received. This does not mean zero use.","Ölçüm alınmadı. Bu, sıfır kullanım anlamına gelmez.","No se recibieron mediciones. No significa uso cero."))
 rows.orEmpty().groupBy {it.optString("package")}.entries.sortedByDescending {it.value.sumOf {r->r.optLong("seconds")}}.forEach {(_,list)->val seconds=list.sumOf {it.optLong("seconds")};Text("${list.first().optString("label")} · ${duration(seconds)}");LinearProgressIndicator(progress={if(total>0)seconds.toFloat()/total else 0f},modifier=Modifier.fillMaxWidth())}
 rows.orEmpty().groupBy {it.optString("day")}.toSortedMap().forEach {(date,list)->Text("$date · ${duration(list.sumOf {it.optLong("seconds")})}")}
 Text(s.say("Foreground use, not attention. Small video windows may be undercounted in this pilot.","Ön plandaki kullanım ölçülür; dikkat süresi değildir. Küçük video pencereleri pilotta eksik sayılabilir.","Uso en primer plano, no atención. Las ventanas pequeñas de vídeo pueden contarse de menos."))
 devices.forEach {d->Card(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp)){
  Text(d.optString("name"));Text(d.optString("last_seen").takeUnless{it=="null"}?:s.say("Not connected","Bağlanmadı","Sin conexión"))
  Text(if(!d.isNull("revoked_at"))s.say("Revoked","Kaldırıldı","Revocado") else if(!d.isNull("last_seen") && d.optLong("applied_revision")==state!!.optLong("revision"))s.say("Latest rules acknowledged","Son kurallar doğrulandı","Reglas confirmadas") else s.say("Waiting for device","Cihaz bekleniyor","Esperando dispositivo"))
  Text("${s.say("Usage / protection permissions","Kullanım / koruma izinleri","Permisos de uso / protección")}: ${d.optJSONObject("status")?.optBoolean("usage_access")} / ${d.optJSONObject("status")?.optBoolean("accessibility")}")
  if(d.isNull("revoked_at"))TextButton({revoke=d.getString("id")},enabled=!busy){Text(s.say("Revoke device","Cihazı kaldır","Revocar dispositivo"))}
 }}}
 if(revoke!=null)AlertDialog(onDismissRequest={revoke=null},title={Text(s.say("Revoke this device?","Bu cihaz kaldırılsın mı?","¿Revocar dispositivo?"))},text={Text(s.say("Monitoring and limits stop after its next sync.","Ölçüm ve limitler sonraki bağlantıda durur.","La medición y los límites se detienen tras sincronizar."))},confirmButton={TextButton({val target=revoke!!;revoke=null;act{p.cloud.parentCall("POST","$root/revoke/${enc(target)}",JSONObject());load()}}){Text(s.say("Revoke","Kaldır","Revocar"))}},dismissButton={TextButton({revoke=null}){Text(s.say("Cancel","İptal","Cancelar"))}})
 Button({act{code=p.cloud.parentCall("POST","$root/pair",JSONObject()).getString("code");load()}},enabled=!busy){Text(s.say("Link child Android device","Çocuk Android cihazını bağla","Vincular Android del niño"))}
 if(code.isNotBlank())Text("$code\n"+s.say("10 minutes. Enter in child Settings → Screen time.","10 dakika. Çocuk Ayarlar → Ekran süresi alanına girin.","10 minutos. Introduce en Ajustes → Tiempo de pantalla."))
 Text(s.say("Rules","Kurallar","Reglas"),style=MaterialTheme.typography.headlineSmall)
 Row{Switch(policy.optBoolean("enabled"),{edit("enabled",it)},enabled=!busy);Text(s.say("Apply limits","Limitleri uygula","Aplicar límites"))}
 listOf("weekday" to s.say("Weekday minutes","Hafta içi dakika","Minutos entre semana"),"weekend" to s.say("Weekend minutes","Hafta sonu dakika","Minutos fin de semana")).forEach {(key,label)->OutlinedTextField(policy.optInt(key).toString(),{it.toIntOrNull()?.takeIf {n->n in 0..1440}?.let {n->edit(key,n)}},label={Text(label)},enabled=!busy)}
 OutlinedTextField(policy.optString("timezone"),{edit("timezone",it)},label={Text(s.say("Time zone","Saat dilimi","Zona horaria"))},enabled=!busy)
 FlowRow {listOf(listOf(0,6) to s.say("Sat–Sun","Cmt–Paz","Sáb–dom"),listOf(5,6) to s.say("Fri–Sat","Cum–Cmt","Vie–sáb")).forEach {(days,label)->FilterChip(policy.optJSONArray("weekendDays").toString()==org.json.JSONArray(days).toString(),{edit("weekendDays",org.json.JSONArray(days))},label={Text(label)},enabled=!busy)}}
 listOf("start" to s.say("Allowed from HH:mm","İzin başlangıcı SS:dd","Permitido desde HH:mm"),"end" to s.say("Allowed until HH:mm","İzin bitişi SS:dd","Permitido hasta HH:mm")).forEach{(key,label)->OutlinedTextField(policy.optString(key),{edit(key,it)},label={Text(label)},enabled=!busy)}
 Text(s.say("Equal times allow all day. Usage limits still apply.","Saatler aynıysa gün boyu izin verilir. Süre limitleri geçerlidir.","Horas iguales permiten todo el día. Los límites siguen aplicándose."))
 val apps=policy.optJSONObject("apps")?:JSONObject()
 apps.keys().asSequence().toList().forEach {pkg->val a=apps.getJSONObject(pkg)
  Text(when(pkg){"com.google.android.youtube"->"YouTube";"com.netflix.mediaclient"->"Netflix";"com.roblox.client"->"Roblox";else->pkg})
  FlowRow {listOf("timed" to s.say("Timed","Süreli","Con límite"),"allowed" to s.say("Allowed","İzinli","Permitido"),"blocked" to s.say("Blocked","Engelli","Bloqueado")).forEach{(mode,label)->FilterChip(a.optString("mode")==mode,{edit("apps",JSONObject(apps.toString()).put(pkg,JSONObject(a.toString()).put("mode",mode)))},label={Text(label)},enabled=!busy)}}
  if(a.optString("mode")=="timed")OutlinedTextField(a.optInt("limit").toString(),{it.toIntOrNull()?.takeIf{n->n in 0..1440}?.let{n->edit("apps",JSONObject(apps.toString()).put(pkg,JSONObject(a.toString()).put("limit",n)))}},label={Text(s.say("App minutes/day","Uygulama dk/gün","Minutos/día"))},enabled=!busy)
 }
 Button({act{val j=p.cloud.parentCall("PUT",root,JSONObject().put("policy",policy).put("revision",state!!.optLong("revision")));state=JSONObject(state.toString()).put("revision",j.getLong("revision"));saved=true}},enabled=!busy){Text(s.say("Save rules","Kuralları kaydet","Guardar reglas"))}
 if(saved)Text(s.say("Saved; waiting for device acknowledgement.","Kaydedildi; cihazın doğrulaması bekleniyor.","Guardado; esperando confirmación del dispositivo."))
 Button({act{load()}},enabled=!busy){Text(s.say("Refresh device status","Cihaz durumunu yenile","Actualizar estado"))}
}

@Composable fun NativeMathSkip(p:ParentRun) {
 val s=LocalStrings.current;val scope=rememberCoroutineScope();val id=p.selected!!.getString("id");val root="/api/parent/children/${enc(id)}/math-skip"
 var data by remember(id){mutableStateOf<JSONObject?>(null)};var error by remember{mutableStateOf(false)};var busy by remember{mutableStateOf(false)}
 fun call(body:JSONObject?=null){if(busy)return;busy=true;scope.launch{try{data=p.cloud.parentCall(if(body==null)"GET" else "POST",root,body);error=false}catch(e:Exception){error=true}finally{busy=false}}}
 LaunchedEffect(id){call()}
 Text(s.say("Temporarily skipped maths topics","Geçici olarak atlanan matematik konuları","Temas de matemáticas omitidos temporalmente"),style=MaterialTheme.typography.titleLarge)
 if(error)FailureMessage{call()}
 val active=data?.optJSONArray("active").objects()
 active.forEach{a->Text(a.optString("name")+" · "+a.optString("until"));Button({call(JSONObject().put("topic_id",a.optString("topic_id")).put("resume",true))},enabled=!busy){Text(s.say("Resume","Geri ekle","Reanudar"))}}
 data?.optJSONArray("available").objects().forEach{a->if(active.none {it.optString("topic_id")==a.optString("id")})TextButton({call(JSONObject().put("topic_id",a.optString("id")).put("weeks",4))},enabled=!busy&&active.size<(data?.optInt("max")?:3)){Text(a.optString("name")+" · "+s.say("skip 4 weeks","4 hafta atla","omitir 4 semanas"))}}
}

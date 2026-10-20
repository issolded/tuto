package app.tuto.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.tuto.mobile.screentime.ScreenStore
import app.tuto.mobile.data.LocalStrings
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable fun ScreenTimeShop(childId:String,onPurchased:(Int)->Unit) {
 val s=LocalStrings.current;val context=LocalContext.current;val store=remember {ScreenStore(context)};val scope=rememberCoroutineScope()
 if(!store.paired || store.childId!=childId)return
 var data by remember {mutableStateOf<JSONObject?>(null)};var busy by remember {mutableStateOf(false)};var error by remember {mutableStateOf(false)};var success by remember {mutableStateOf(false)};var confirm by remember {mutableStateOf<String?>(null)}
 fun refresh(){if(busy)return;busy=true;scope.launch {try{store.sync();data=store.loadShop();error=false}catch(e:Exception){error=true}finally{busy=false}}}
 LaunchedEffect(childId){refresh()}
 val offer=data?.optJSONObject("offer");val pending=store.pendingPurchase
 val names=mapOf("com.google.android.youtube" to "YouTube","com.netflix.mediaclient" to "Netflix","com.roblox.client" to "Roblox")
 fun buy(pkg:String){busy=true;confirm=null;scope.launch{try{data=store.buyMinutes(pkg,childId);error=false;success=true;onPurchased(data!!.optInt("balance"))}catch(e:Exception){error=true;runCatching {data=store.loadShop()}}finally{busy=false}}}
 Card(Modifier.fillMaxWidth()){Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text(s.say("More time with Gems","Gem ile ek süre","Más tiempo con Gems"),style=MaterialTheme.typography.titleLarge)
  if(data!=null)Text("${data!!.optLong("balance")} Gems · ${data!!.optString("day")}")
  Text(s.say("Only on this device, until tonight. Blocked apps and your parent's allowed hours still apply.","Yalnızca bu cihazda, bu geceye kadar. Engelli uygulamalar ve ebeveyninin izin saatleri geçerli kalır.","Solo en este dispositivo, hasta esta noche. Se mantienen las apps bloqueadas y los horarios familiares."))
  if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
  if(error)Text(s.say("Purchase not confirmed. Refresh or retry the pending purchase; the same request is charged only once.","Satın alma doğrulanamadı. Yenile veya bekleyen işlemi tekrar dene; aynı işlem yalnız bir kez ücretlendirilir.","Compra no confirmada. Actualiza o reintenta la compra pendiente; la misma solicitud se cobra una sola vez."),color=MaterialTheme.colorScheme.error)
  if(success)Text(s.say("Time added. Your Gem balance is updated.","Süre eklendi. Gem bakiyen güncellendi.","Tiempo añadido. Saldo de Gems actualizado."))
  if(pending!=null)Button({buy(pending.getString("package"))},enabled=!busy){Text(s.say("Retry pending purchase","Bekleyen satın almayı tekrar dene","Reintentar compra pendiente"))}
  else if(offer?.optBoolean("enabled")==true && store.policy.optBoolean("enabled")) {
   Text("${offer.optInt("minutes")} "+s.say("minutes for","dakika için","minutos por")+" ${offer.optInt("gemCost")} Gems")
   Text(s.say("Purchased today","Bugün satın alınan","Comprado hoy")+": ${data!!.optInt("purchased_today")} / ${offer.optInt("dailyMax")} "+s.say("minutes","dakika","minutos"))
   names.forEach {(pkg,name)->if(store.policy.optJSONObject("apps")?.optJSONObject(pkg)?.optString("mode")=="timed")Button({confirm=pkg;success=false},enabled=!busy && data!!.optLong("balance")>=offer.optInt("gemCost") && data!!.optInt("purchased_today")+offer.optInt("minutes")<=offer.optInt("dailyMax")){Text(name+" · +${offer.optInt("minutes")} "+s.say("min","dk","min"))}}
  } else if(data!=null)Text(s.say("Your parent can enable Gem purchases in Screen time settings.","Ebeveynin ekran süresi ayarlarından Gem ile satın almayı açabilir.","Tu familia puede activar las compras con Gems en Tiempo de pantalla."))
  TextButton({refresh()},enabled=!busy){Text(s.say("Refresh","Yenile","Actualizar"))}
 }}
 if(confirm!=null && offer!=null)AlertDialog(onDismissRequest={confirm=null},title={Text(s.say("Buy extra time?","Ek süre satın al?","¿Comprar tiempo extra?"))},text={Text("${names[confirm]}: +${offer.optInt("minutes")} "+s.say("minutes today. Cost:","dakika bugün. Ücret:","minutos hoy. Precio:")+" ${offer.optInt("gemCost")} Gems")},confirmButton={TextButton({buy(confirm!!)},enabled=!busy){Text(s.say("Buy","Satın al","Comprar"))}},dismissButton={TextButton({confirm=null}){Text(s.say("Cancel","Vazgeç","Cancelar"))}})
}

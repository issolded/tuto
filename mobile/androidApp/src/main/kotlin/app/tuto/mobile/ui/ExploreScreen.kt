package app.tuto.mobile.ui

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.Canvas
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.*
import app.tuto.mobile.R
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.*

/** Offline Turkish review content from the supplied nine-pilot packet. No mastery or Gem writes. */
@OptIn(ExperimentalLayoutApi::class)
@Composable fun ExploreScreen(vm:TutoViewModel) {
 val context=LocalContext.current;val child=vm.child?:return;val s=LocalStrings.current
 val modules=remember{JSONArray(context.assets.open("explore_pilots_tr.json").bufferedReader().use{it.readText()}).objects()}
 val band=when{child.age<=8->0;child.age<=10->1;else->2}
 val prefs=remember{context.getSharedPreferences("tuto-explore-notebook-v1",Context.MODE_PRIVATE)}
 var topic by remember{mutableStateOf<JSONObject?>(null)}
 var page by remember{mutableIntStateOf(0)}
 var draft by remember{mutableStateOf(JSONObject())}
 var selection by remember{mutableStateOf(listOf<Int>())}
 var answer by remember{mutableStateOf("")}
 var showHint by remember{mutableStateOf(false)}
 var checked by remember{mutableStateOf(false)}
 var saved by remember{mutableStateOf(false)}
 fun savePage(){ val id=topic?.getString("id")?:return;val updated=JSONObject(draft.toString()).put("step-$page",JSONObject().put("selection",JSONArray(selection)).put("answer",answer).put("help",showHint));draft=updated;prefs.edit().putString("${child.id}:$id",updated.toString()).apply() }
 fun go(to:Int){savePage();page=to;checked=false;showHint=false;saved=false;val st=draft.optJSONObject("step-$to");selection=st?.optJSONArray("selection").ints();answer=st?.optString("answer").orEmpty()}
 BackHandler(topic!=null){savePage();topic=null}
 FeaturePage(s.say("Explore","Keşfet","Explorar"),{if(topic==null)vm.home() else {savePage();topic=null}}){
  if(topic==null){
   Text(s.say("Pilot collection · Turkish content","Pilot koleksiyon · Türkçe içerik","Colección piloto · contenido en turco"),color=Ink.soft)
   Text(s.say("Observe, try, explain. Your discoveries stay on this tablet.","Gözlemle, dene, anlat. Keşiflerin bu tablette saklanır.","Observa, prueba, explica. Tus descubrimientos se guardan en esta tableta."))
   modules.filter{it.getInt("band")==band}.forEach{m->OutlinedCard(onClick={topic=m;page=0;draft=runCatching{JSONObject(prefs.getString("${child.id}:${m.getString("id")}","{}")!!)}.getOrDefault(JSONObject());val st=draft.optJSONObject("step-0");selection=st?.optJSONArray("selection").ints();answer=st?.optString("answer").orEmpty();checked=false;showHint=false;saved=false},modifier=Modifier.fillMaxWidth()){
    Row(Modifier.padding(20.dp),horizontalArrangement=Arrangement.spacedBy(18.dp),verticalAlignment=Alignment.CenterVertically){PaperIcon(if(m.getString("topic")=="art")"drawing" else "explore",Modifier.size(60.dp));Column{Text(m.getString("title"),style=MaterialTheme.typography.titleLarge);Text("${m.getString("ages")} · 5 adım")}}
   }}
  }else{
   val module=topic!!;val id=module.getString("topic");val step=module.getJSONArray("steps").getJSONObject(page)
   Text(module.getString("title"),style=MaterialTheme.typography.headlineMedium)
   LinearProgressIndicator(progress={(page+1)/5f},modifier=Modifier.fillMaxWidth())
   Text("${page+1}/5 · ${step.getString("title")}",style=MaterialTheme.typography.titleLarge)
   Text(step.getString("text").replace("{prediction}",draft.optJSONObject("step-0")?.optString("answer").orEmpty()).replace("{creation}",draft.optJSONObject("step-3")?.optString("answer").orEmpty()))
   if(id=="moon"&&page in 1..3)MoonModel(band)
   if(id=="art"&&page in 0..3){
    Image(painterResource(R.drawable.explore_boating),"Teknede iki kişi; beyaz giysi, su ve eğik tekne kenarı.",Modifier.fillMaxWidth().height(300.dp))
    Text("Édouard Manet · Boating (1874) · The Met · Public Domain",style=MaterialTheme.typography.bodySmall)
   }
   if(id=="water"&&page in 1..3){
    Text("Kaynak → Arıtma → Depo ve dağıtım → Musluk",style=MaterialTheme.typography.titleMedium)
    if(band==2)Text("Hayalî veri / aynı süre\nÇınar: 100 giriş − 20 kayıp = 80 ulaşan\nAda: 100 giriş − 10 kayıp = 90 ulaşan\nOnarım modeli: 100 − 5 = 95 ulaşan")
   }
   Text(step.optString("task"),style=MaterialTheme.typography.titleMedium)
   val options=step.optJSONArray("options").strings()
   FlowRow(horizontalArrangement=Arrangement.spacedBy(10.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
    options.forEachIndexed{i,label->FilterChip(selected=i in selection,onClick={selection=if(i in selection)selection-i else selection+i;answer=selection.mapNotNull{options.getOrNull(it)}.joinToString(" / ");checked=false;savePage()},label={Text(label)},modifier=Modifier.widthIn(max=440.dp))}
   }
   if(options.isEmpty()||page==3)OutlinedTextField(value=answer,onValueChange={answer=it;checked=false;savePage()},label={Text("Kendi açıklamam")},modifier=Modifier.fillMaxWidth(),minLines=3)
   if(options.isNotEmpty())Text("Seçim sıram: "+selection.mapNotNull{options.getOrNull(it)}.joinToString(" → "),style=MaterialTheme.typography.bodySmall)
   Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){
    TextButton(onClick={showHint=!showHint;savePage()}){Text("İpucu")}
    if(page in 1..3)TextButton(onClick={checked=true}){Text("Örnekle karşılaştır")}
   }
   if(showHint){Fox(Modifier.size(140.dp),FoxPose.Hint,event=page);Text(step.optString("hint"))}
   if(checked){
    val key=step.optString("answerText")
    if(key.isNotBlank())Text("Örnek yanıt: $key")
    else Text("Yorumunu görünen ayrıntılara bağla. Tek bir doğru hikâye yok.")
    Text("Bu pilotta açıklamalar otomatik puanlanmaz. İstersen yanıtını değiştir.",style=MaterialTheme.typography.bodySmall)
   }
   if(page==4){
    Text("Keşif defterim",style=MaterialTheme.typography.titleLarge)
    (0..3).forEach{i->Text("${i+1}. "+draft.optJSONObject("step-$i")?.optString("answer").orEmpty())}
    if(saved){Fox(Modifier.size(170.dp),FoxPose.Success);Text("Kaydedildi. Keşfin bu tablette, kendi profilinde.")}
   }
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
    TextButton(onClick={go(page-1)},enabled=page>0){Text("Geri")}
    if(page<4)Button(onClick={go(page+1)},enabled=answer.isNotBlank()){Text("Devam")}
    else Button(onClick={savePage();prefs.edit().putBoolean("${child.id}:${module.getString("id")}:finished",true).apply();saved=true}){Text("Defterime kaydet")}
   }
  }
 }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable private fun MoonModel(band:Int){
 val names=listOf("Yeniay","Büyüyen hilal","İlk dördün","Büyüyen şişkin","Dolunay","Küçülen şişkin","Son dördün","Küçülen hilal")
 var stop by remember{mutableIntStateOf(if(band==0)1 else 0)}
 Text("Uzaydan model / Dünya’dan görünüm",style=MaterialTheme.typography.titleMedium)
 Canvas(Modifier.fillMaxWidth().height(200.dp)){
  val r=minOf(size.height*.36f,size.width*.18f);val earth=Offset(size.width*.25f,size.height*.5f)
  drawCircle(Color(0xFF7EA5BD),r*.23f,earth)
  drawCircle(Color(0xFFDDDDDD),r,earth,style=androidx.compose.ui.graphics.drawscope.Stroke(1.dp.toPx()))
  val angle=stop*PI/4;val moon=earth+Offset((cos(angle)*r).toFloat(),(-sin(angle)*r).toFloat());val mr=r*.13f
  drawCircle(Color(0xFF444444),mr,moon)
  drawArc(Color(0xFFF4C650),-90f,180f,true,moon-Offset(mr,mr),Size(mr*2,mr*2))
  val sun=Offset(size.width*.52f,size.height*.5f);drawCircle(Color(0xFFF4C650),r*.25f,sun)
  drawLine(Ink.soft,sun-Offset(r*.35f,0f),sun-Offset(r*.8f,0f),2.dp.toPx())
  val center=Offset(size.width*.80f,size.height*.5f);val radius=r*.85f
  drawCircle(Color(0xFF444444),radius,center)
  // Orthographic sphere: surface normal dot sunlight determines each visible pixel strip.
  val lightX=sin(angle);val lightZ=-cos(angle)
  val pixel=2.dp.toPx()
  var y=-radius
  while(y<=radius){var x=-radius;while(x<=radius){val nx=x/radius;val ny=y/radius;val z2=1-nx*nx-ny*ny;if(z2>=0&&nx*lightX+sqrt(z2)*lightZ>0)drawRect(Color(0xFFF4EBD3),center+Offset(x,y),Size(pixel,pixel));x+=pixel};y+=pixel}
 }
 Text("${names[stop]} · görünen aydınlık: ${((1-cos(stop*PI/4))*50).roundToInt()}%")
 FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){(if(band==0)listOf(1,2,4)else(0..7).toList()).forEach{i->FilterChip(selected=stop==i,onClick={stop=i},label={Text(names[i])})}}
 Text("Şema ölçekli değildir. Evreler Dünya’nın gölgesi değildir; tutulma ayrı olaydır.",style=MaterialTheme.typography.bodySmall)
}

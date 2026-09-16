package app.tuto.mobile

import android.graphics.BitmapFactory
import android.content.Context
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.*
import org.json.JSONArray
import org.json.JSONObject

@Composable fun DrawingPage(s:StudioState,p:Palette,wide:Boolean) {
    val context=LocalContext.current
    val catalogue=remember { context.assets.list("drawings")?.filter{it !in listOf("master","robot")&&context.assets.list("drawings/$it")?.any{f->f.endsWith(".webp")}==true}?.sorted()?:emptyList() }
    var selected by rememberSaveable{mutableStateOf(false)}
    var search by rememberSaveable{mutableStateOf("")}
    PageTitle("Make something yours","My drawings","Follow the original drawing guides, then add your own imagination.")
    if(!selected){
        OutlinedTextField(search,{search=it},label={Text("Find a drawing")},modifier=Modifier.fillMaxWidth())
        catalogue.filter{it.replace('-',' ').contains(search,ignoreCase=true)}.chunked(if(wide)4 else 2).forEach{row->Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){row.forEach{id->
            val files=remember(id){drawingFiles(context,id)}
            Surface(onClick={if(s.drawing!=id)s.chooseDrawing(id);selected=true},color=listOf(Rose,Lilac,Butter,Sky)[catalogue.indexOf(id)%4],shape=RoundedCornerShape(24.dp),modifier=Modifier.weight(1f)){
                Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                    files.lastOrNull()?.let{AssetArt("drawings/$id/$it",Modifier.fillMaxWidth().height(130.dp))}
                    Text(id.replace('-',' ').replaceFirstChar{it.uppercase()},style=MaterialTheme.typography.titleMedium)
                    Text("${files.size} guided steps",style=MaterialTheme.typography.labelMedium)
                }
            }
        };repeat((if(wide)4 else 2)-row.size){Spacer(Modifier.weight(1f))}}}
        if(catalogue.isEmpty())Text("Drawing assets could not be loaded.")
    }else{
        val files=remember(s.drawing){drawingFiles(context,s.drawing)}
        val descriptions=remember(s.drawing){runCatching{val data=context.assets.open("drawing_steps.json").bufferedReader().use{it.readText()};JSONObject(data).getJSONObject(s.drawing).optJSONArray("en")}.getOrNull()}
        val current=s.step.coerceIn(0,(files.size-1).coerceAtLeast(0))
        TextButton(onClick={selected=false}){Text("← All drawings")}
        Text(s.drawing.replace('-',' ').replaceFirstChar{it.uppercase()},style=MaterialTheme.typography.headlineMedium)
        Panel {Text("Step ${current+1} of ${files.size}",style=MaterialTheme.typography.labelLarge);files.getOrNull(current)?.let{AssetArt("drawings/${s.drawing}/$it",Modifier.fillMaxWidth().height(if(wide)340.dp else 260.dp), maxSide=1400)};descriptions?.optString(current)?.takeIf{it.isNotBlank()}?.let{Text(it)};Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){OutlinedButton(onClick={s.step(current-1)},enabled=current>0){Text("Previous")};Button(onClick={s.step(current+1)},enabled=current<files.lastIndex){Text("Next step →")}}}
        Text("Your sketchbook",style=MaterialTheme.typography.titleLarge)
        Text("Draw with your finger or stylus below, or follow the guide on paper.")
        key(s.drawing){DrawingPad(s.drawing,p)}
    }
}
fun drawingFiles(c:Context,id:String)=c.assets.list("drawings/$id")?.filter{it.endsWith(".webp")&&it.startsWith("step-") }?.sorted()?:emptyList()
@Composable fun AssetArt(path:String,modifier:Modifier,maxSide:Int=480) {
    val context=LocalContext.current
    val bitmap=remember(path,maxSide){runCatching{
        val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true}
        context.assets.open(path).use{BitmapFactory.decodeStream(it,null,bounds)}
        var sample=1
        while(maxOf(bounds.outWidth,bounds.outHeight)/sample>maxSide*2)sample*=2
        val options=BitmapFactory.Options().apply{inSampleSize=sample}
        context.assets.open(path).use{BitmapFactory.decodeStream(it,null,options)}?.asImageBitmap()
    }.getOrNull()}
    if(bitmap!=null)Image(bitmap,null,modifier.clip(RoundedCornerShape(16.dp)).background(Color.White),contentScale=ContentScale.Fit)
}
data class InkStroke(val color:Int,val points:List<Offset>)
@Composable fun DrawingPad(id:String,p:Palette) {
    val context=LocalContext.current
    val prefs=remember{context.getSharedPreferences("tuto-sketches",0)}
    var lines by remember { mutableStateOf(runCatching{val a=JSONArray(prefs.getString(id,"[]"));(0 until a.length()).map{i->val o=a.getJSONObject(i);val ps=o.getJSONArray("p");InkStroke(o.getInt("c"),(0 until ps.length()).map{j->val xy=ps.getJSONArray(j);Offset(xy.getDouble(0).toFloat(),xy.getDouble(1).toFloat())})}}.getOrDefault(emptyList())) }
    var color by remember{mutableStateOf(Ink)}
    var saved by remember{mutableStateOf(true)}
    var clear by remember{mutableStateOf(false)}
    fun persist(){val a=JSONArray();lines.forEach{l->val ps=JSONArray();l.points.forEach{ps.put(JSONArray().put(it.x.toDouble()).put(it.y.toDouble()))};a.put(JSONObject().put("c",l.color).put("p",ps))};prefs.edit().putString(id,a.toString()).apply();saved=true}
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf(Ink,Violet,Coral,Color(0xFF23855A),Color(0xFF2265DA)).forEach{c->FilterChip(selected=color==c,onClick={color=c},label={Text("●",color=c)})}}
    Canvas(Modifier.fillMaxWidth().aspectRatio(1.25f).clip(RoundedCornerShape(24.dp)).background(Color.White).border(2.dp,Lilac,RoundedCornerShape(24.dp)).pointerInput(color){detectDragGestures(onDragStart={pos->lines=lines+InkStroke(color.toArgb(),listOf(Offset((pos.x/size.width).coerceIn(0f,1f),(pos.y/size.height).coerceIn(0f,1f))));saved=false},onDragEnd={persist()},onDragCancel={persist()}){change,_->change.consume();if(lines.isNotEmpty()){val l=lines.last();lines=lines.dropLast(1)+l.copy(points=l.points+Offset((change.position.x/size.width).coerceIn(0f,1f),(change.position.y/size.height).coerceIn(0f,1f)));saved=false}}}){
        lines.forEach{l->l.points.zipWithNext().forEach{(a,b)->drawLine(Color(l.color),Offset(a.x*size.width,a.y*size.height),Offset(b.x*size.width,b.y*size.height),5.dp.toPx(),StrokeCap.Round)}}
    }
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton(onClick={lines=lines.dropLast(1);persist()},enabled=lines.isNotEmpty()){Text("Undo")};OutlinedButton(onClick={clear=true},enabled=lines.isNotEmpty()){Text("Clear")};Button(onClick={persist()}){Text("Save sketch")}}
    Text(if(saved)"Sketch saved on this device" else "Drawing…",style=MaterialTheme.typography.bodySmall)
    if(clear)AlertDialog(onDismissRequest={clear=false},title={Text("Clear this sketch?")},text={Text("This removes your drawing for this guide.")},confirmButton={TextButton(onClick={lines=emptyList();persist();clear=false}){Text("Clear")}},dismissButton={TextButton(onClick={clear=false}){Text("Keep it")}})
}

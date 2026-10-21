package app.tuto.mobile.ui

import android.media.MediaPlayer
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.*
import org.json.JSONObject
import java.net.URLDecoder

@OptIn(ExperimentalLayoutApi::class)
@Composable fun LiteracyScreen(vm:TutoViewModel){
 val run=vm.literacy?:return;val s=LocalStrings.current.withLang("en");val context=LocalContext.current
 val art=remember{JSONObject(context.assets.open("literacy_pictures.json").bufferedReader().use{it.readText()})}
 var player by remember{mutableStateOf<MediaPlayer?>(null)};var audioError by remember{mutableStateOf(false)}
 var showHelp by remember(run.item?.optString("id")){mutableStateOf(false)}
 fun stop(){player?.release();player=null}
 fun play(urls:List<String>){stop();audioError=false;fun start(i:Int){if(i>=urls.size)return;val url=urls[i];if(!url.startsWith("https://")){audioError=true;return};player=MediaPlayer().apply{setDataSource(url);setOnPreparedListener{it.start()};setOnCompletionListener{it.release();player=null;start(i+1)};setOnErrorListener{_,_,_->audioError=true;stop();true};prepareAsync()}};runCatching{start(0)}.onFailure{audioError=true;stop()}}
 val owner=LocalLifecycleOwner.current
 DisposableEffect(owner){val observer=LifecycleEventObserver{_,event->if(event==Lifecycle.Event.ON_PAUSE)stop()};owner.lifecycle.addObserver(observer);onDispose{owner.lifecycle.removeObserver(observer);stop()}}
 LaunchedEffect(run){if(!run.started)run.next()}
 CompositionLocalProvider(LocalStrings provides s) { FeaturePage("English",{stop();vm.home()}){
  if(run.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
  if(run.error){
   Text(if(run.uncertainAnswer)"The answer may have been saved, but confirmation did not arrive. Please return Home; do not submit it again." else "Your session could not load. Check your connection and try again.")
   if(!run.uncertainAnswer)Button(onClick={run.next()}){Text("Try again")}
  }
  if(run.done){Fox(Modifier.size(210.dp),FoxPose.Success);Text("All done!",style=MaterialTheme.typography.headlineLarge);Text("${run.gems} Gems earned");BigButton("Home"){vm.home()};return@FeaturePage}
  val item=run.item?:return@FeaturePage;val prompt=item.optJSONObject("prompt")?:JSONObject()
  Text("${run.n} / ${run.total}",style=MaterialTheme.typography.titleMedium)
  if(audioError)Text("Sound could not play. Try again, or choose ‘I can't use sound now’.")
  if(prompt.optBoolean("listen")&&run.audioOk==null){
   Text("Now some listening!",style=MaterialTheme.typography.headlineMedium)
   Button(onClick={play(listOf(prompt.optString("instruction_audio")).filter{it.startsWith("https://")}.ifEmpty{prompt.optJSONArray("audio").strings()})}){Text("Play a sound")}
   Button(onClick={stop();run.audioOk=true}){Text("I can hear it")}
   TextButton(onClick={stop();run.next(true)},enabled=!run.busy){Text("I can't use sound now")}
  }else{
   item.optJSONObject("passage")?.let{Text(it.optString("title"),style=MaterialTheme.typography.titleLarge);Text(it.optString("text"),style=MaterialTheme.typography.bodyLarge)}
   if(prompt.has("stem_key")){Text(s(prompt.getString("stem_key")));Text(englishPrompt(JSONObject().put("type",prompt.optString("type")).put("prompt",prompt.optJSONObject("vr")),s),style=MaterialTheme.typography.headlineSmall)}
   listOf("instruction","context","text","stem","ask").forEach{key->prompt.optStringOrNull(key)?.let{Text(it,style=MaterialTheme.typography.titleLarge)}}
   @Composable fun picture(p:JSONObject?,modifier:Modifier){val emoji=p?.optString("emoji").orEmpty();val uri=art.optString(emoji);if(uri.startsWith("data:image/svg+xml,"))NotebookArt(URLDecoder.decode(uri.substringAfter(','),"UTF-8"),modifier)else Text(emoji,style=MaterialTheme.typography.headlineLarge)}
   prompt.optJSONObject("picture")?.let{picture(it,Modifier.size(110.dp))}
   if(prompt.optBoolean("listen")){
    Button(onClick={play(prompt.optJSONArray("audio").strings())}){Text("Listen again")}
    TextButton(onClick={stop();run.next(true)},enabled=!run.busy&&run.results==null){Text("I can't use sound now")}
   }
   TextButton(onClick={showHelp=!showHelp}){Text(if(showHelp)"Hide help" else "Help me get started")}
   if(showHelp){
    Fox(Modifier.size(190.dp),FoxPose.Hint,event=item.optString("id"))
    Text("Take your time. Read the instruction first, then look at each choice. For a word-building question, tap the letters in order; Undo removes the last letter. You can listen again, or choose ‘I don't know’ if you are unsure.")
   }
   run.questions.forEach{q->
    val id=q.getString("id");val chosen=run.values[id].orEmpty();val result=run.results?.firstOrNull{it.getString("question_id")==id}
    q.optStringOrNull("stem")?.let{Text(it,style=MaterialTheme.typography.titleLarge)}
    if(q.optString("mode")=="build"){
     val letters=q.getJSONArray("letters").objects()
     Text(chosen.joinToString(""){v->letters.first{it.getString("id")==v}.getString("letter")}.ifBlank{"…"},style=MaterialTheme.typography.headlineLarge)
     FlowRow(horizontalArrangement=Arrangement.spacedBy(10.dp)){letters.forEach{letter->Button(onClick={run.choose(q,letter.getString("id"))},enabled=!run.busy&&result==null&&letter.getString("id") !in chosen){Text(letter.getString("letter"))}}}
     TextButton(onClick={run.undo(q)},enabled=result==null&&!run.busy){Text("Undo")}
    }else FlowRow(horizontalArrangement=Arrangement.spacedBy(12.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
     q.getJSONArray("options").objects().forEachIndexed{i,o->OutlinedButton(onClick={o.optStringOrNull("audio")?.let{play(listOf(it))};run.choose(q,o.getString("id"))},enabled=result==null&&!run.busy&&!run.uncertainAnswer,modifier=Modifier.widthIn(min=160.dp,max=340.dp).heightIn(min=72.dp),border=androidx.compose.foundation.BorderStroke(if(o.getString("id") in chosen)3.dp else 1.dp,if(o.getString("id") in chosen)MaterialTheme.colorScheme.primary else Ink.soft)){
      if(o.has("picture"))picture(o.optJSONObject("picture"),Modifier.size(72.dp))else Text(o.optStringOrNull("text")?:"Listen ${i+1}")
     }}
    }
    if(result!=null){Text(if(result.optBoolean("correct"))"Correct" else result.optStringOrNull("explain")?:"Answer: ${result.optJSONArray("key").strings().joinToString()}");result.optStringOrNull("explain_audio")?.let{url->TextButton(onClick={play(listOf(url))}){Text("Hear explanation")}}}
   }
   if(run.results==null)Row(horizontalArrangement=Arrangement.spacedBy(16.dp)){
    TextButton(onClick={stop();run.send(true)},enabled=!run.busy&&!run.uncertainAnswer){Text("I don't know")}
    Button(onClick={stop();run.send()},enabled=run.ready&&!run.busy&&!run.uncertainAnswer){Text("Send")}
   }else Button(onClick={stop();run.next()},enabled=!run.busy){Text("Next")}
  }
 }
 }
}

package app.tuto.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.dp
import app.tuto.mobile.data.LocalStrings

/** Form feeds are whitespace to the existing assessment API; no destructive record migration. */
@Composable internal fun NotebookWriter(title:String,text:String,onTitle:(String)->Unit,onText:(String)->Unit){
 val s=LocalStrings.current
 val focus=LocalFocusManager.current
 var spread by rememberSaveable { mutableIntStateOf(0) }
 val pages=text.split('\u000c');val first=spread*2
 fun change(index:Int,value:String){val updated=pages.toMutableList();while(updated.size<=index)updated.add("");updated[index]=value;val result=updated.joinToString("\u000c");if(result.length<=50000)onText(result)}
 OutlinedTextField(title,onTitle,label={Text(s.say("Title","Başlık","Título"))},singleLine=true,modifier=Modifier.fillMaxWidth())
 Box(Modifier.fillMaxWidth().height(360.dp).testTag("open-notebook").background(Color(0xFFFFFEFA))){
  Canvas(Modifier.fillMaxSize()){
   val gap=28.dp.toPx();var y=gap
   while(y<size.height){drawLine(Color(0xFFECEAE4),Offset(14.dp.toPx(),y),Offset(size.width-14.dp.toPx(),y),.6.dp.toPx());y+=gap}
   drawRect(Brush.horizontalGradient(listOf(Color.Transparent,Color(0x182C2418),Color.Transparent),startX=size.width/2-16.dp.toPx(),endX=size.width/2+16.dp.toPx()),topLeft=Offset(size.width/2-16.dp.toPx(),0f),size=androidx.compose.ui.geometry.Size(32.dp.toPx(),size.height))
  }
  Row(Modifier.fillMaxSize().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(36.dp)){
   repeat(2){side->val index=first+side
    key(index){Column(Modifier.weight(1f).fillMaxHeight()){
     TextField(pages.getOrElse(index){""},{change(index,it)},placeholder={Text(if(index==0)s.say("Your story","Hikâyen","Tu cuento")else s.say("Continue your story…","Hikâyene devam et…","Continúa tu cuento…"))},modifier=Modifier.weight(1f).fillMaxWidth().testTag("writing-page-$side"),colors=TextFieldDefaults.colors(focusedContainerColor=Color.Transparent,unfocusedContainerColor=Color.Transparent,focusedIndicatorColor=Color.Transparent,unfocusedIndicatorColor=Color.Transparent),textStyle=MaterialTheme.typography.bodyLarge)
     Text("${index+1}",Modifier.align(Alignment.CenterHorizontally),style=MaterialTheme.typography.labelMedium)
    }}
   }
  }
 }
 Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
  TextButton(onClick={focus.clearFocus(force=true);spread--},enabled=spread>0,modifier=Modifier.testTag("writing-previous")){Text(s.say("← Previous pages","← Önceki sayfalar","← Páginas anteriores"))}
  Text(s.say("Saved on this tablet · syncs automatically","Tablete kaydedilir · otomatik eşitlenir","Guardado en esta tableta · sincronización automática"),style=MaterialTheme.typography.bodySmall)
  TextButton(onClick={focus.clearFocus(force=true);spread++},enabled=spread<99,modifier=Modifier.testTag("writing-next")){Text(s.say("Next pages →","Sonraki sayfalar →","Páginas siguientes →"))}
 }
}

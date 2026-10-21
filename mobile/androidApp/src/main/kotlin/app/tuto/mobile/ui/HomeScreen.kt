package app.tuto.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.*
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.Child
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.data.Strings
import app.tuto.mobile.data.Today
import java.util.Calendar

@Composable
fun HomeScreen(vm: TutoViewModel) {
    val s=LocalStrings.current;val child=vm.child?:return
    LaunchedEffect(child.id){vm.refreshToday()}
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide=maxWidth/LocalDensity.current.fontScale.coerceAtLeast(1f)>=760.dp
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),verticalArrangement=Arrangement.spacedBy(20.dp)) {
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(18.dp)) {
                Text("TUTO",style=MaterialTheme.typography.headlineLarge)
                Text(s.say("Hello, ${child.name}!","Merhaba, ${child.name}!","¡Hola, ${child.name}!"),Modifier.weight(1f),style=MaterialTheme.typography.headlineMedium)
                GemPill(if(vm.todayLoaded)vm.today.gems else null,Modifier.clickable{vm.open("gems")})
                androidx.compose.material3.TextButton(onClick={vm.open("settings")}){Text(s.say("Settings","Ayarlar","Ajustes"))}
            }
            val tiles=buildList {
                listOf("math","english","puzzle").filter{child.active(it)}.forEach{add(it)}
                if(child.active("reading")||child.active("writing"))add("library")
                add("explore");if(child.active("drawing"))add("drawing")
            }
            val cards:@Composable ()->Unit={
                Column(verticalArrangement=Arrangement.spacedBy(16.dp)) {
                    tiles.chunked(if(wide)3 else 2).forEach{row->Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(16.dp)){
                        row.forEach{type->Column(Modifier.weight(1f).height(182.dp).border(1.5.dp,Ink.main,RoundedCornerShape(18.dp)).clickable(role=Role.Button){vm.open(type)}.testTag("quest_$type").padding(14.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(10.dp,Alignment.CenterVertically)){
                            PaperIcon(type,Modifier.size(76.dp))
                            Text(when(type){"math"->s.say("Math","Matematik","Matemáticas");"english"->"English";"puzzle"->s.say("Puzzles","Bulmacalar","Acertijos");"library"->s.say("My Stories","Hikâyelerim","Mis historias");"explore"->s.say("Explore","Keşfet","Explorar");else->s.say("My Drawing","Çizimlerim","Mis dibujos")},style=MaterialTheme.typography.titleLarge,maxLines=2,textAlign=TextAlign.Center)
                        }}
                        repeat((if(wide)3 else 2)-row.size){Spacer(Modifier.weight(1f))}
                    }}
                }
            }
            if(wide) Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(24.dp),verticalAlignment=Alignment.CenterVertically){
                Column(Modifier.weight(.29f),horizontalAlignment=Alignment.CenterHorizontally){Fox(Modifier.fillMaxWidth().height(310.dp),event=child.id);Text(s.say("A little curiosity, every day.","Her gün biraz merak.","Un poco de curiosidad cada día."),textAlign=TextAlign.Center)}
                Box(Modifier.weight(.71f)){cards()}
            } else {Fox(Modifier.fillMaxWidth().height(200.dp),event=child.id);cards()}
            Row(Modifier.fillMaxWidth().border(1.dp,Ink.soft,RoundedCornerShape(14.dp)).clickable{vm.open("goals")}.padding(18.dp),horizontalArrangement=Arrangement.spacedBy(16.dp),verticalAlignment=Alignment.CenterVertically){
                PaperIcon("goals",Modifier.size(42.dp))
                Column(Modifier.weight(1f)){
                    Text(s.say("My next goal","Sıradaki hedefim","Mi próxima meta"),style=MaterialTheme.typography.titleMedium)
                    val goal=vm.today.nearestGoal
                    Text(if(goal!=null) "${goal.name} · ${(goal.cost-vm.today.gems).coerceAtLeast(0)} Gem" else s.say("Choose a goal","Bir hedef seç","Elige una meta"))
                }
                Text("→",style=MaterialTheme.typography.titleLarge)
            }
            if(vm.todayError)Text(s.say("Progress could not refresh. Try again when connected.","İlerleme yenilenemedi. Bağlanınca tekrar dene.","No se pudo actualizar el progreso."),color=Ink.soft)
        }
    }
}

/** The Gem jar: fills as the Gems approach the nearest goal. */
@Composable
fun Jar(fill: Float, modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        drawRoundRect(Color(0xFFC9853E), topLeft = Offset(w * .25f, 0f), size = androidx.compose.ui.geometry.Size(w * .5f, h * .12f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(6f))
        val body = androidx.compose.ui.geometry.RoundRect(0f, h * .14f, w, h, androidx.compose.ui.geometry.CornerRadius(w * .22f))
        val clip = Path().apply { addRoundRect(body) }
        drawPath(clip, Color(0xFF3A2B52))
        val top = h * .14f + (h * .86f) * (1f - fill)
        clipPath(clip) { drawRect(Ink.jar, topLeft = Offset(0f, top), size = androidx.compose.ui.geometry.Size(w, h - top)) }
        drawPath(clip, Color.White, style = Stroke(width = 5f))
    }
}

/** Still drawings for the activities that have no animation yet. */
@Composable
fun ActivityGlyph(type: String, modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        val ink = Stroke(width = w * .06f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        when (type) {
            "writing" -> {
                val p = Path().apply { moveTo(w * .2f, h * .8f); lineTo(w * .28f, h * .58f); lineTo(w * .68f, h * .18f); lineTo(w * .82f, h * .32f); lineTo(w * .42f, h * .72f); close() }
                drawPath(p, Color.White); drawPath(p, Ink.main, style = ink)
                drawLine(Ink.main, Offset(w * .14f, h * .9f), Offset(w * .86f, h * .9f), ink.width, StrokeCap.Round)
            }
            "drawing" -> {
                drawCircle(Color.White, w * .4f, Offset(w * .5f, h * .5f)); drawCircle(Ink.main, w * .4f, Offset(w * .5f, h * .5f), style = ink)
                drawCircle(Color(0xFFFF5D8F), w * .07f, Offset(w * .34f, h * .42f)); drawCircle(TaskColor.math, w * .07f, Offset(w * .5f, h * .3f)); drawCircle(Ink.green, w * .07f, Offset(w * .66f, h * .38f))
            }
            "homework" -> {
                drawRoundRect(Color.White, topLeft = Offset(w * .2f, h * .14f), size = androidx.compose.ui.geometry.Size(w * .6f, h * .76f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(w * .08f))
                drawRoundRect(Ink.main, topLeft = Offset(w * .2f, h * .14f), size = androidx.compose.ui.geometry.Size(w * .6f, h * .76f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(w * .08f), style = ink)
                drawLine(Ink.main, Offset(w * .32f, h * .4f), Offset(w * .68f, h * .4f), ink.width, StrokeCap.Round)
                drawLine(Ink.main, Offset(w * .32f, h * .58f), Offset(w * .58f, h * .58f), ink.width, StrokeCap.Round)
            }
            else -> { // tree
                drawLine(Color(0xFF8A5A2B), Offset(w * .5f, h * .92f), Offset(w * .5f, h * .5f), w * .08f, StrokeCap.Round)
                drawCircle(Color.White, w * .24f, Offset(w * .5f, h * .34f)); drawCircle(Ink.main, w * .24f, Offset(w * .5f, h * .34f), style = ink)
                drawCircle(Color.White, w * .16f, Offset(w * .26f, h * .52f)); drawCircle(Ink.main, w * .16f, Offset(w * .26f, h * .52f), style = ink)
                drawCircle(Color.White, w * .16f, Offset(w * .74f, h * .52f)); drawCircle(Ink.main, w * .16f, Offset(w * .74f, h * .52f), style = ink)
            }
        }
    }
}

package app.tuto.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import app.tuto.mobile.data.*
import kotlin.math.*

/** Manipulatives use the template's own operands. The child's answer is never filled in. */
@OptIn(ExperimentalLayoutApi::class)
@Composable fun MathHelp(q: MathQuestion) {
    val s=LocalStrings.current
    val v=q.raw.optJSONObject("source")?.optJSONObject("help") ?: q.visual ?: return
    var touched by remember(q.question) { mutableStateOf<Set<Int>>(emptySet()) }
    var dealt by remember(q.question) { mutableIntStateOf(0) }
    when(v.optString("kind")) {
        "count", "groups", "array" -> {
            val rows=when(v.optString("kind")) { "groups" -> v.optInt("groups"); "array" -> v.optInt("rows"); else -> 1 }
            val cols=when(v.optString("kind")) { "groups" -> v.optInt("per"); "array" -> v.optInt("cols"); else -> v.optInt("n") }
            if(rows*cols !in 1..120) return
            Text(s.say("Tap each counter as you count.","Sayarken her noktaya dokun.","Toca cada ficha al contar."))
            repeat(rows) { row -> FlowRow(horizontalArrangement=Arrangement.spacedBy(4.dp)) { repeat(cols) { col -> val id=row*cols+col
                Surface(color=if(id in touched) Color(0xFF008577) else Color(0xFFE4EBF0),shape=MaterialTheme.shapes.small,modifier=Modifier.size(44.dp).clickable { touched=if(id in touched) touched-id else touched+id }) { Box(Modifier.padding(12.dp)) { Text(if(id in touched) "✓" else "●") } }
            } } }
            Text("${touched.size}")
        }
        "share" -> {
            val total=v.optInt("total");val groups=v.optInt("groups")
            if(total !in 1..120 || groups !in 1..16) return
            Text(s.say("Deal the counters equally into the groups.","Noktaları gruplara eşit dağıt.","Reparte las fichas por igual."))
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) { repeat(groups) { group ->
                val amount=dealt/groups + if(group < dealt%groups) 1 else 0
                Card(Modifier.widthIn(min=80.dp,max=160.dp)) { Text((if(amount==0) "○" else List(amount){"●"}.joinToString(" ")),Modifier.padding(12.dp)) }
            } }
            Text(s.say("Left to deal: ${total-dealt}","Dağıtılacak: ${total-dealt}","Quedan: ${total-dealt}"))
            Button(onClick={dealt=minOf(total,dealt+groups)},enabled=dealt<total) { Text(s.say("Deal a round","Bir tur dağıt","Repartir una ronda")) }
            TextButton(onClick={dealt=0}) { Text(s.say("Start again","Baştan başla","Empezar de nuevo")) }
        }
        "clock" -> {
            var minutes by remember(q.question) { mutableFloatStateOf(if(v.optString("ask") in setOf("span","later")) (v.optInt("hour")*60+v.optInt("minute")).toFloat() else 0f) }
            Text(s.say("Move the hands and watch how they turn together.","Kolları hareket ettir; birlikte nasıl döndüklerini izle.","Mueve las agujas y observa cómo giran juntas."))
            Canvas(Modifier.size(220.dp)) {
                val center=Offset(size.width/2,size.height/2);val radius=size.minDimension*.44f
                drawCircle(Color(0xFFE7F2F4),radius,center)
                repeat(12) { i -> val a=i*PI/6-PI/2;drawCircle(Color.DarkGray,3.dp.toPx(),center+Offset((cos(a)*radius*.9).toFloat(),(sin(a)*radius*.9).toFloat())) }
                fun hand(angle:Double,length:Float,width:Float) { drawLine(Color(0xFF145A70),center,center+Offset((cos(angle)*length).toFloat(),(sin(angle)*length).toFloat()),width) }
                hand(minutes*PI/30-PI/2,radius*.8f,4.dp.toPx());hand(minutes*PI/360-PI/2,radius*.5f,6.dp.toPx())
            }
            Slider(minutes,{minutes=it},valueRange=0f..1440f,steps=287)
            val m=minutes.roundToInt();Text("${(m/60)%24}:${(m%60).toString().padStart(2,'0')}")
        }
    }
}

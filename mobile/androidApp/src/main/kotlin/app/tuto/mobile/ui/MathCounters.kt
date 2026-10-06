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
import org.json.JSONObject
import kotlin.math.*

@OptIn(ExperimentalLayoutApi::class)
@Composable fun ArithmeticCounters(q:MathQuestion) {
    val topic=q.raw.optJSONObject("source")?.optString("templateTopic")
    if(topic !in listOf("addition","subtraction")) return
    // Only literal sums: never guess operands from a word problem or a missing-operand question.
    val match=Regex("^\\s*(\\d{1,2})\\s*([+−-])\\s*(\\d{1,2})\\s*(?:=\\s*\\?)?\\s*$").matchEntire(q.question) ?: return
    val a=match.groupValues[1].toInt();val b=match.groupValues[3].toInt();val plus=match.groupValues[2]=="+"
    if(a !in 0..30 || b !in 0..30 || (!plus && a<b)) return
    var touched by remember(q.question) { mutableStateOf(setOf<Int>()) }
    val s=LocalStrings.current
    Text(if(plus)s.say("Count both sets together.","İki grubu birlikte say.","Cuenta los dos grupos juntos.") else s.say("Tap $b counters to take them away, then count those left.","Çıkarmak için $b noktaya dokun, sonra kalanları say.","Toca $b fichas para quitarlas y cuenta las restantes."))
    FlowRow(horizontalArrangement=Arrangement.spacedBy(4.dp)) { repeat(if(plus)a+b else a) { i ->
        FilterChip(i in touched,{touched=if(i in touched)touched-i else touched+i},label={Text(if(!plus && i in touched) "✕" else if(plus && i>=a) "🟠" else "🔵")})
    } }
    Text(if(plus) touched.size.toString() else "${a-touched.size}")
}

@OptIn(ExperimentalLayoutApi::class)
@Composable fun ShapeCounters(v:JSONObject) {
    val kinds=v.optJSONArray("shapes")?.strings().orEmpty()
    val sides=mapOf("triangle" to 3,"square" to 4,"rectangle" to 4,"pentagon" to 5,"hexagon" to 6,"heptagon" to 7,"octagon" to 8)
    var counted by remember(v.toString()) { mutableStateOf(mapOf<Int,Int>()) }
    val s=LocalStrings.current
    Text(s.say("Tap a shape to mark each side or corner as you count.","Sayarken her kenarı veya köşeyi işaretlemek için şekle dokun.","Toca una figura para marcar cada lado o esquina al contar."))
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) { kinds.forEachIndexed { index,kind ->
        val n=sides[kind] ?: return@forEachIndexed
        Column { Box(Modifier.size(180.dp).clickable { counted=counted+(index to minOf(n,(counted[index] ?: 0)+1)) }) {
            ShapeDrawing(kind,Modifier.fillMaxSize())
            Canvas(Modifier.fillMaxSize()) {
                val c=Offset(size.minDimension/2,size.minDimension/2);val r=size.minDimension*.36f
                val pts=when(kind) {"square"->listOf(Offset(-r,-r),Offset(r,-r),Offset(r,r),Offset(-r,r));"rectangle"->listOf(Offset(-r*1.35f,-r*.75f),Offset(r*1.35f,-r*.75f),Offset(r*1.35f,r*.75f),Offset(-r*1.35f,r*.75f));else->List(n) {i->val angle=2*PI*i/n-PI/2;Offset((r*cos(angle)).toFloat(),(r*sin(angle)).toFloat())}}
                pts.indices.forEach { i -> val at=if(v.optString("ask")=="sides") (pts[i]+pts[(i+1)%n])/2f else pts[i]
                    drawCircle(if(i<(counted[index] ?: 0)) Color(0xFF008577) else Color.White,7.dp.toPx(),c+at)
                }
            }
        };Text("${counted[index] ?: 0}") }
    } }
    Text(s.say("Counted: ${counted.values.sum()}","Sayılan: ${counted.values.sum()}","Contados: ${counted.values.sum()}"))
    TextButton({counted=emptyMap()}) {Text(s.say("Start again","Baştan başla","Empezar de nuevo"))}
}

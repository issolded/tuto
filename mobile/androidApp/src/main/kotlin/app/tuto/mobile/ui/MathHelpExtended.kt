package app.tuto.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.tuto.mobile.data.*
import org.json.JSONObject
import org.json.JSONArray

/** Uses the shared template descriptors, never infers operations from story text. */
@OptIn(ExperimentalLayoutApi::class)
@Composable fun ExtendedMathHelp(v: JSONObject) {
    val s = LocalStrings.current
    var touched by remember(v.toString()) { mutableStateOf(setOf<Int>()) }
    var count by remember(v.toString()) { mutableIntStateOf(0) }
    val reset = s.say("Start again", "Baştan başla", "Empezar de nuevo")
    when (v.optString("kind")) {
        "steps", "jumps" -> {
            val steps = if(v.optString("kind") == "steps") v.optJSONArray("steps").objects() else {
                val stops=v.optJSONArray("stops") ?: JSONArray()
                (0 until (stops.length()-1).coerceAtLeast(0)).map { i ->
                    val from=stops.optDouble(i); val to=stops.optDouble(i+1)
                    val add=v.optString("mode") == "add"
                    JSONObject().put("say", if(add) s.say("Where does this jump land?", "Bu sıçrama nereye varır?", "¿Dónde termina este salto?") else s.say("How big is this jump?", "Bu sıçrama ne kadar?", "¿Cuánto mide este salto?"))
                        .put("q", if(add) "${number(from)} + ${number(to-from)}" else "${number(to)} − ${number(from)}")
                        .put("a", if(add) to else to-from)
                }
            }
            HelpSteps(steps)
        }
        "fill" -> {
            val total=v.optInt("total"); val size=v.optInt("size")
            if(total !in 1..120 || size !in 1..120) return
            Text(s.say("Fill one group at a time. Look at the last group.", "Grupları sırayla doldur. Son gruba dikkat et.", "Llena un grupo cada vez. Mira el último grupo."))
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                repeat((total+size-1)/size) { i ->
                    val have=(count-i*size).coerceIn(0,size)
                    Card(Modifier.widthIn(min=90.dp,max=180.dp)) { Text("${i+1}: " + List(have){"●"}.joinToString(" ") + " (${have}/$size)",Modifier.padding(12.dp)) }
                }
            }
            Text(s.say("Left: ${total-count}", "Kalan: ${total-count}", "Quedan: ${total-count}"))
            Button({count=minOf(total,count+size)},enabled=count<total) { Text(s.say("Fill a group","Bir grup doldur","Llenar un grupo")) }
            TextButton({count=0}) { Text(reset) }
        }
        "coins" -> {
            val sum=v.optString("mode") == "sum"
            val coins=v.optJSONArray("coins")
            val coin=v.optDouble("coin",0.0)
            val target=v.optDouble("target",0.0)
            if(!sum && (coin<=0 || target<=0 || target/coin>120)) return
            Text(s.say("Tap the coins to count their value.", "Paraların değerini saymak için dokun.", "Toca las monedas para contar su valor."))
            if(sum) {
                FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) { repeat(minOf(coins?.length() ?: 0,120)) { i ->
                    FilterChip(i in touched,{touched=if(i in touched) touched-i else touched+i},label={Text(number(coins!!.optDouble(i)))})
                } }
                Text("${number(touched.sumOf { coins!!.optDouble(it) })} ${v.optString("unit")}")
            } else {
                FlowRow { repeat(count) { AssistChip({},label={Text(number(coin))}) } }
                Text("${number(count*coin)} / ${number(target)} ${v.optString("unit")}")
                Button({count++},enabled=count*coin<target) { Text("+ ${number(coin)}") }
                TextButton({count=0}) { Text(reset) }
            }
        }
        "fracbar" -> {
            val compare=v.optString("mode") == "cmp"
            val denoms=v.optJSONArray("denoms")
            val parts=v.optInt("parts")
            val rows=if(compare) (0 until (denoms?.length() ?: 0)).map { denoms!!.optInt(it) } else listOf(parts)
            Text(s.say("Tap the equal parts. Compare the shaded lengths.", "Eşit parçalara dokun. Boyalı uzunlukları karşılaştır.", "Toca las partes iguales. Compara las longitudes coloreadas."))
            rows.filter { it in 1..40 }.forEachIndexed { row,d ->
                val fixed=when(v.optString("mode")) { "shade" -> v.optInt("shaded"); "add" -> v.optInt("a"); else -> 0 }
                Row(Modifier.fillMaxWidth().height(48.dp),horizontalArrangement=Arrangement.spacedBy(2.dp)) {
                    repeat(d) { col -> val id=row*100+col
                        Box(Modifier.weight(1f).fillMaxHeight().background(when {col<fixed -> Color(0xFF008577);id in touched -> Color(0xFFFFB45B);else -> Color(0xFFE4EBF0)}).clickable { touched=if(id in touched)touched-id else touched+id })
                    }
                }
                val selected=(0 until d).count { it<fixed || row*100+it in touched }
                Text("$selected / $d")
            }
            if(v.optString("mode") == "add") Text(s.say("Add ${v.optInt("b")} more parts.", "${v.optInt("b")} parça daha ekle.", "Añade ${v.optInt("b")} partes más."))
            TextButton({touched=emptySet()}) { Text(reset) }
        }
        "tally", "pictogram" -> {
            val rows=v.optJSONArray("rows").objects()
            val use=v.optJSONArray("use")?.let { a -> (0 until a.length()).map { a.optInt(it) }.toSet() }
            rows.forEachIndexed { row,item -> if(use==null || row in use) {
                val n=item.optDouble("count"); if(n >= 0 && n <= 120) {
                    val tally=v.optString("kind")=="tally"
                    val values=if(tally) List(n.toInt()/5){5.0}+List(n.toInt()%5){1.0} else List(kotlin.math.ceil(n).toInt()){ i -> minOf(1.0,n-i)*v.optDouble("each",1.0) }
                    Text(item.optString("label"))
                    FlowRow { values.forEachIndexed { col,value -> val id=row*200+col
                        FilterChip(id in touched,{touched=if(id in touched)touched-id else touched+id},label={Text(if(tally) if(value==5.0) "||||/" else "|" else (if(value < v.optDouble("each",1.0)) "½ " else "")+v.optString("unit","●"))})
                    } }
                    Text(number(values.indices.filter { row*200+it in touched }.sumOf { values[it] }))
                }
            } }
        }
        "sorttest" -> {
            val labels=v.optJSONArray("labels") ?: return
            val rows=v.optJSONArray("rows").objects()
            Text(s.say("Test each number against both labels.", "Her sayıyı iki etikete göre dene.", "Comprueba cada número con las dos etiquetas."))
            rows.forEachIndexed { row,item ->
                Text(item.optString("n"),style=MaterialTheme.typography.titleLarge)
                repeat(labels.length()) { col -> val id=row*10+col
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        Text(labels.optString(col),Modifier.weight(1f))
                        if(id in touched) Text(if(item.getJSONArray("fits").optBoolean(col)) "✓" else "✕")
                        else { listOf(true,false).forEach { answer -> TextButton({if(item.getJSONArray("fits").optBoolean(col)==answer) touched=touched+id}) { Text(if(answer)s.say("Yes","Evet","Sí") else s.say("No","Hayır","No")) } } }
                    }
                }
            }
        }
        "pv" -> PlaceValueHelp(v)
    }
}

private fun number(n:Double)=if(n%1.0==0.0)n.toLong().toString() else n.toString()

@Composable private fun HelpSteps(steps:List<JSONObject>) {
    val s=LocalStrings.current
    var solved by remember { mutableIntStateOf(0) }
    var input by remember { mutableStateOf("") }
    var misses by remember { mutableIntStateOf(0) }
    steps.take(solved).forEach { Text("${it.optString("q")} = ${it.optString("a")} ✓") }
    if(solved>=steps.size) { Text(s.say("Now answer the question above.","Şimdi yukarıdaki soruyu cevapla.","Ahora responde la pregunta de arriba."));return }
    val step=steps[solved]
    Text(step.optString("say"));Text("${step.optString("q")} = ?",style=MaterialTheme.typography.titleLarge)
    OutlinedTextField(input,{input=it},Modifier.testTag("help-step-input"),singleLine=true,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Text),label={Text(s.say("This step","Bu adım","Este paso"))})
    if(misses>0) Text(s.say("Try this step again.","Bu adımı tekrar dene.","Intenta este paso otra vez."))
    Button({
        if(MathEngine.sameAnswer(input,step.optString("a")) || misses>=1) {solved++;input="";misses=0} else misses++
    },Modifier.testTag("help-step-check"),enabled=input.isNotBlank()) { Text(s.say("Check step","Adımı kontrol et","Comprobar paso")) }
}

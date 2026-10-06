package app.tuto.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.tuto.mobile.data.*
import org.json.JSONObject

/** Six template-owned exercises, matching the web's place-value teaching paths. */
@OptIn(ExperimentalLayoutApi::class)
@Composable fun PlaceValueHelp(v:JSONObject) {
    val s=LocalStrings.current
    val places=v.optJSONArray("places")?.let { a -> (0 until a.length()).map { a.optInt(it) }.filter { it in listOf(1,10,100,1000) }.sortedDescending() } ?: return
    if(places.isEmpty()) return
    val mode=v.optString("mode")
    val start=v.optInt("start",v.optInt("n"))
    var counts by remember(v.toString()) { mutableStateOf(PlaceValue.digits(start,places)) }
    var used by remember(v.toString()) { mutableStateOf(setOf<Int>()) }
    var arranged by remember(v.toString()) { mutableStateOf(listOf<Int>()) }
    var acted by remember(v.toString()) { mutableStateOf(false) }
    var note by remember(v.toString()) { mutableStateOf("") }
    var column by remember(v.toString()) { mutableIntStateOf(0) }
    val numbers=v.optJSONArray("numbers")?.let { a -> (0 until a.length()).map { a.optInt(it) } }.orEmpty()
    var kept by remember(v.toString()) { mutableStateOf(numbers.indices.toSet()) }
    fun name(p:Int)=when(p) { 1000->s.say("Thousands","Binler","Millares");100->s.say("Hundreds","Yüzler","Centenas");10->s.say("Tens","Onlar","Decenas");else->s.say("Ones","Birler","Unidades") }
    fun reset() {counts=PlaceValue.digits(start,places);used=emptySet();arranged=emptyList();acted=false;note="";column=0;kept=numbers.indices.toSet()}
    @Composable fun board(values:Map<Int,Int>, showDigits:Boolean=true, onColumn:((Int)->Unit)?=null) {
        FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            places.forEach { p -> Card(Modifier.width(120.dp)) { Column(Modifier.padding(8.dp)) {
                if(onColumn!=null) TextButton({onColumn(p)},Modifier.testTag("pv-column-$p")) {Text(name(p))} else Text(name(p))
                Text(List((values[p] ?: 0).coerceIn(0,20)){"▣"}.joinToString(" "),Modifier.heightIn(min=56.dp))
                if(showDigits) Text("${values[p] ?: 0}",style=MaterialTheme.typography.headlineSmall)
            } } }
        }
    }
    when(mode) {
        "build" -> {
            val parts=v.optJSONArray("parts").objects()
            val values=places.associateWith { p -> used.sumOf { i -> val part=parts[i];if(part.optInt("place")==p)part.optInt("count") else 0 } }
            Text(s.say("Tap each part to put its blocks in the right column.","Her parçaya dokun ve bloklarını doğru sütuna yerleştir.","Toca cada parte para colocar sus bloques en la columna correcta."))
            board(values)
            FlowRow { parts.forEachIndexed { i,p -> FilterChip(i in used,{used=used+i},label={Text("${p.optInt("count")} × ${p.optInt("place")}")}) } }
        }
        "missing" -> {
            val given=v.optJSONArray("given")?.let { a -> (0 until a.length()).map { a.optInt(it) } }.orEmpty()
            val left=start-used.sumOf { given[it] }
            Text(s.say("Cover the parts you already have. Count the blocks left.","Verilen parçaları kapat. Kalan blokları say.","Tapa las partes que ya tienes. Cuenta los bloques restantes."))
            board(PlaceValue.digits(left,places),showDigits=false)
            FlowRow { given.forEachIndexed { i,n -> FilterChip(i in used,{used=used+i},label={Text(n.toString())}) } }
        }
        "shift" -> {
            val amount=v.optInt("amount");val up=v.optBoolean("up")
            val full=if(up)places.firstOrNull { counts.getValue(it)>=10 } else null
            Text(if(full!=null) s.say("Tap ${name(full)} to exchange ten blocks for one in the next place.","On bloğu üst basamakta bir blokla değiştirmek için ${name(full)} sütununa dokun.","Toca ${name(full)} para cambiar diez bloques por uno en la siguiente posición.") else s.say("Add or take a block. Exchange a larger block if the column is empty.","Bir blok ekle veya çıkar. Sütun boşsa büyük bir bloğu parçala.","Añade o quita un bloque. Cambia un bloque mayor si la columna está vacía."))
            board(counts,onColumn={ p ->
                if(full==p) counts=PlaceValue.exchange(counts,p,true)
                else if(!up && !acted && p>amount && counts.getValue(p)>0 && counts[amount]==0) {counts=PlaceValue.exchange(counts,p,false);note=""}
            })
            Button({
                if(up || (counts[amount] ?: 0)>0) {counts=counts+(amount to ((counts[amount] ?: 0)+if(up)1 else -1));acted=true;note=""}
                else note=s.say("That column is empty. Tap a larger place to break one block into ten.","Bu sütun boş. Bir bloğu ona bölmek için daha büyük basamağa dokun.","Esa columna está vacía. Toca una posición mayor para dividir un bloque en diez.")
            },Modifier.testTag("pv-shift"),enabled=!acted && full==null && amount in counts) {Text("${if(up)"+" else "−"}$amount")}
            if(acted && full==null) Text(s.say("Read the digits and answer the question.","Rakamları okuyup soruyu cevapla.","Lee las cifras y responde la pregunta."))
        }
        "compare" -> {
            Text(s.say("Compare from the left. Keep only the best digit in each column.","Soldan karşılaştır. Her sütunda yalnız istenen büyük/küçük rakamları tut.","Compara desde la izquierda. Conserva solo la mejor cifra de cada columna."))
            numbers.forEachIndexed { i,n -> Text("${if(i in kept)"•" else "✕"} $n") }
            if(kept.size>1 && column<places.size) Button({
                val p=places[column];val best=if(v.optString("want")=="max")kept.maxOf { numbers[it]/p%10 } else kept.minOf { numbers[it]/p%10 }
                kept=kept.filter { numbers[it]/p%10==best }.toSet();column++
            }) { Text(name(places[column])) }
        }
        "arrange" -> {
            val digits=v.optJSONArray("digits")?.let { a -> (0 until a.length()).map { a.optInt(it) } }.orEmpty()
            Text(s.say("Fill the columns from the left. A number cannot start with zero.","Sütunları soldan doldur. Sayı sıfırla başlayamaz.","Llena las columnas desde la izquierda. El número no puede empezar por cero."))
            board(places.mapIndexed { i,p -> p to (arranged.getOrNull(i)?.let { digits[it] } ?: 0) }.toMap())
            FlowRow { digits.forEachIndexed { i,d -> FilterChip(i in arranged,{
                val left=digits.indices.filter { it !in arranged }.map { digits[it] }
                if(d==PlaceValue.bestDigit(left,v.optString("want")=="max",arranged.isEmpty())) {arranged=arranged+i;note=""}
                else note=s.say("Try a different digit for this place.","Bu basamak için başka bir rakam dene.","Prueba otra cifra para esta posición.")
            },label={Text(d.toString())},enabled=i !in arranged && arranged.size<places.size) } }
        }
        "digit" -> {
            val place=v.optInt("place");val n=v.optInt("n");val digit=n/place.coerceAtLeast(1)%10
            Text(s.say("Find the requested place, then tap each block to count its value.","İstenen basamağı bul; değerini saymak için bloklara dokun.","Busca la posición indicada y toca cada bloque para contar su valor."))
            FlowRow { places.forEach { p -> FilterChip(acted && p==place,{if(p==place)acted=true},label={Text("${name(p)}: ${n/p%10}")}) } }
            if(acted) {
                FlowRow { repeat(digit) { i -> FilterChip(i in used,{used=if(i in used)used-i else used+i},label={Text("▣")}) } }
                Text("${used.size*place}")
            }
        }
    }
    if(note.isNotEmpty()) Text(note)
    TextButton(::reset) {Text(s.say("Start again","Baştan başla","Empezar de nuevo"))}
}

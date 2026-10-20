package app.tuto.mobile.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import app.tuto.mobile.data.LocalStrings
import org.json.JSONObject

/** Browser fracbar contract: shaded is an index array; comparison bars always share a whole. */
@Composable
fun FractionHelp(v: JSONObject) {
    val s = LocalStrings.current
    val mode = v.optString("mode")
    val parts = v.optInt("parts")
    val denoms = v.optJSONArray("denoms")
    val rows = if (mode == "cmp") (0 until (denoms?.length() ?: 0)).map { denoms!!.optInt(it) } else listOf(parts)
    if (rows.isEmpty() || rows.any { it !in 1..40 }) return
    val shaded = v.optJSONArray("shaded")?.let { a -> (0 until a.length()).map { a.optInt(it) }.filter { it in 0 until parts }.toSet() } ?: emptySet()
    val white = v.optBoolean("white")
    val a = v.optInt("a").coerceIn(0, parts.coerceAtLeast(0))
    val b = v.optInt("b").coerceIn(0, (parts - a).coerceAtLeast(0))
    var counted by remember(v.toString()) { mutableStateOf(setOf<Int>()) }
    var picked by remember(v.toString()) { mutableStateOf(setOf<Int>()) }
    val countingWhole = mode == "shade" && counted.size < parts
    val target = if (white) (0 until parts).toSet() - shaded else shaded
    val instruction = when (mode) {
        "add" -> if (picked.size < b) s.say("$a parts are coloured. Tap to add $b more.", "$a parça boyalı. Dokunarak $b parça daha ekle.", "Hay $a partes coloreadas. Toca para añadir $b más.")
            else s.say("Count the coloured parts. The bottom number stays $parts.", "Boyalı parçaları say. Alttaki sayı $parts kalır.", "Cuenta las partes coloreadas. Abajo se queda $parts.")
        "shade" -> if (countingWhole) s.say("First, tap every part to count the whole.", "Önce bütün parçaları dokunarak say.", "Primero, toca cada parte para contar el total.")
            else if (picked.size < target.size) {
                if (white) s.say("$parts equal parts. Now tap the white parts.", "$parts eşit parça. Şimdi boyasız parçalara dokun.", "$parts partes iguales. Ahora toca las blancas.")
                else s.say("$parts equal parts. Now tap the coloured parts.", "$parts eşit parça. Şimdi boyalı parçalara dokun.", "$parts partes iguales. Ahora toca las coloreadas.")
            } else s.say("${picked.size} of $parts parts. Which fraction matches?", "$parts parçanın ${picked.size} tanesi. Hangi kesir buna uyuyor?", "${picked.size} de $parts partes. ¿Qué fracción corresponde?")
        else -> s.say("Each bar is one whole. Compare one equal part in each bar.", "Her çubuk bir bütün. Her çubuktaki bir eşit parçayı karşılaştır.", "Cada barra es un entero. Compara una parte igual de cada barra.")
    }
    Text(instruction, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        // Keep touch targets usable on phones and all comparison bars exactly the same length.
        val barWidth = maxOf(maxWidth, (rows.max() * 48).dp)
        Column(Modifier.horizontalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            rows.forEachIndexed { row, d ->
                if (mode == "cmp") Text("1 / $d", style = MaterialTheme.typography.titleMedium)
                Row(Modifier.width(barWidth).height(64.dp).clip(RoundedCornerShape(12.dp)).border(1.dp, Color(0xFFCAD5E6), RoundedCornerShape(12.dp)), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    repeat(d) { i ->
                        val fixed = when (mode) { "add" -> i < a; "shade" -> i in shaded; else -> i == 0 }
                        val selected = if (countingWhole) i in counted else i in picked
                        val enabled = when (mode) {
                            "add" -> !fixed && (selected || picked.size < b)
                            "shade" -> if (countingWhole) i !in counted else i in target
                            else -> false
                        }
                        val colour by animateColorAsState(when {
                            !countingWhole && selected -> Color(0xFF416EC4)
                            fixed -> Color(0xFF5F9380)
                            else -> Color.White
                        }, label = "fraction-part")
                        val label = s.say("Part ${i + 1} of $d", "${i + 1}. parça, toplam $d", "Parte ${i + 1} de $d")
                        Box(Modifier.weight(1f).fillMaxHeight().background(colour).testTag("fraction-$row-$i")
                            .toggleable(value = selected, enabled = enabled, role = Role.Checkbox) {
                                if (countingWhole) counted = counted + i
                                else picked = if (i in picked) picked - i else picked + i
                            }.semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
                            val text = when {
                                countingWhole && selected -> "${i + 1}"
                                mode == "shade" && !countingWhole && selected -> "✓"
                                mode == "add" && (fixed || selected) -> "1/$d"
                                mode == "add" && enabled -> "+"
                                else -> ""
                            }
                            Text(text, color = if (fixed || (!countingWhole && selected)) Color.White else Color(0xFF15284B), style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
            }
        }
    }
    if (mode != "cmp") {
        val progress = when { mode == "add" -> "${a + picked.size} / $parts"; countingWhole -> "${counted.size} / ?"; else -> "${picked.size} / $parts" }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(progress, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.testTag("fraction-progress"))
            TextButton(onClick = { counted = emptySet(); picked = emptySet() }) { Text(s.say("Start again", "Baştan başla", "Empezar de nuevo")) }
        }
    }
}

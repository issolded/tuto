package app.tuto.mobile.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.tuto.mobile.R
import app.tuto.mobile.data.LocalStrings
import org.json.JSONObject

internal val ReadingMilestones = listOf(10, 50, 100, 200)

/** Counts completed book records, never authored stories or repeated rows. */
internal fun completedBookCount(books: List<JSONObject>): Int = books
    .filter { it.optBoolean("completed") && it.optString("id").isNotBlank() }
    .distinctBy { it.optString("id") }.size

/** Background plate and native, accessible targets share one fixed coordinate system. */
@Composable internal fun ReadingRoom(
    items: List<Pair<JSONObject, Boolean>>, count: Int, busy: Boolean,
    onSelect: (Pair<JSONObject, Boolean>) -> Unit
) {
    val s = LocalStrings.current
    var award by remember { mutableStateOf<Int?>(null) }
    var reading by remember { mutableStateOf(false) }
    val roomHeightLimit = (LocalConfiguration.current.screenHeightDp.dp - 240.dp).coerceIn(300.dp, 600.dp)
    val still = reduceMotion()
    val transition = rememberInfiniteTransition(label = "reading-idle")
    val idle by transition.animateFloat(0f, if (still) 0f else 1f,
        infiniteRepeatable(tween(2400), RepeatMode.Reverse), label = "reading-breath")
    val entrance = remember { Animatable(if (still) 1f else .975f) }
    LaunchedEffect(still) { entrance.animateTo(1f, tween(if (still) 0 else 700)) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // A narrow device pans the room rather than shrinking book targets below 48 dp.
        BoxWithConstraints(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)), contentAlignment = Alignment.TopCenter) {
            val roomWidth = minOf(maxWidth, roomHeightLimit * 1.6f).coerceAtLeast(480.dp)
            val columns = (roomWidth.value * .43f / 56f).toInt().coerceIn(3, 6)
            val roomHeight = roomWidth / 1.6f
            Box(Modifier.horizontalScroll(rememberScrollState())) {
                Box(Modifier.requiredSize(roomWidth, roomHeight).graphicsLayer {
                    scaleX = entrance.value; scaleY = entrance.value
                }.testTag("reading-room")) {
                    Image(painterResource(R.drawable.library_room_warm), null, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
                    Image(painterResource(R.drawable.fox_reading_cutout),
                        s.say("Tuto reading in his chair. Tap to read together.", "Tuto koltuğunda okuyor. Birlikte okumak için dokun.", "Tuto lee en su sillón. Toca para leer juntos."),
                        Modifier.offset(roomWidth * .01f, roomHeight * .40f)
                            .size(roomWidth * .31f, roomHeight * .52f)
                            .graphicsLayer { scaleY = 1f + idle * .006f; rotationZ = idle * .25f }
                            .clickable(role = Role.Button) { reading = true }, contentScale = ContentScale.Fit)
                    // Two by two frames in the clear wall strip. The state comes from real books.
                    ReadingMilestones.forEachIndexed { index, target ->
                        val earned = count >= target
                        Column(Modifier.offset(roomWidth * .335f + (index % 2) * (roomWidth * .06f).coerceAtLeast(50.dp), roomHeight * (.34f + (index / 2) * .17f))
                            .size((roomWidth * .058f).coerceAtLeast(48.dp), roomHeight * .145f)
                            .shadow(3.dp, RoundedCornerShape(3.dp))
                            .background(Color(0xFFB18C58), RoundedCornerShape(3.dp))
                            .clickable(role = Role.Button) { award = target }
                            .padding(3.dp).background(Color(0xFFFFF5DE))
                            .testTag("reading-award-$target"),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center) {
                            Text(if (earned) "✦" else "◇", color = if (earned) Color(0xFFB37D1C) else Color(0xFF8A927E), style = MaterialTheme.typography.titleLarge)
                            Text("$target", color = Color(0xFF57442C), style = MaterialTheme.typography.labelMedium)
                        }
                    }
                    val shelfBottoms = listOf(.311f, .538f, .745f)
                    repeat(3) { row ->
                        Row(Modifier.offset(roomWidth * .495f, roomHeight * (shelfBottoms[row] - .158f))
                            .width(roomWidth * .43f).height(roomHeight * .158f),
                            verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items.drop(row * columns).take(columns).forEach { item ->
                                RoomBook(item.first, Modifier.weight(1f).fillMaxHeight().clickable(role = Role.Button) { onSelect(item) }.testTag("shelf-${item.first.optString("id")}"))
                            }
                            repeat((columns - items.drop(row * columns).take(columns).size).coerceAtLeast(0)) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                    if (items.isEmpty()) Text(
                        s.say(if (busy) "Loading your books…" else "Your finished books will find a home here.", if (busy) "Kitapların yükleniyor…" else "Bitirdiğin kitaplar burada yerini alacak.", if (busy) "Cargando tus libros…" else "Tus libros terminados tendrán un lugar aquí."),
                        Modifier.offset(roomWidth * .51f, roomHeight * .18f).width(roomWidth * .39f)
                            .background(Color(0xEEFFF7E7), RoundedCornerShape(12.dp)).padding(16.dp), color = Color(0xFF57442C))
                }
            }
        }
        val next = ReadingMilestones.firstOrNull { it > count }
        Text(s.say("$count books finished", "$count kitap tamamlandı", "$count libros terminados") +
            (next?.let { s.say(" · ${it-count} to your next award", " · sonraki ödüle ${it-count} kitap", " · ${it-count} para tu próximo premio") } ?: ""),
            style = MaterialTheme.typography.titleMedium, color = Ink.green)
    }
    award?.let { target ->
        AlertDialog(onDismissRequest = { award = null }, title = { Text(s.say("$target-book award", "$target kitap ödülü", "Premio de $target libros")) },
            text = { Text(if (count >= target) s.say("You've reached this reading milestone!", "Bu okuma hedefine ulaştın!", "¡Has alcanzado esta meta de lectura!") else s.say("${target-count} more completed books to fill this frame. Every book counts once.", "Bu çerçeve için ${target-count} kitap daha tamamla. Her kitap bir kez sayılır.", "Termina ${target-count} libros más. Cada libro cuenta una vez.")) },
            confirmButton = { TextButton(onClick = { award = null }) { Text(s.say("Close", "Kapat", "Cerrar")) } })
    }
    if (reading) AlertDialog(onDismissRequest = { reading = false },
        title = { Text(s.say("A little reading time", "Biraz okuma zamanı", "Un momento para leer")) },
        text = { Fox(Modifier.fillMaxWidth().height(300.dp), FoxPose.Reading) },
        confirmButton = { TextButton(onClick = { reading = false }) { Text(s.say("Back to my room", "Odama dön", "Volver a mi habitación")) } })
}

@Composable private fun RoomBook(book: JSONObject, modifier: Modifier) {
    val palette = listOf(0xFF315B75, 0xFF6C8265, 0xFFA76049, 0xFF746187, 0xFF936A39)
    val color = Color(palette[(book.optString("id").hashCode() and Int.MAX_VALUE) % palette.size])
    Column(modifier.shadow(3.dp, RoundedCornerShape(2.dp, 5.dp, 5.dp, 2.dp))
        .background(Brush.horizontalGradient(listOf(color.copy(alpha=.85f), color, color)), RoundedCornerShape(2.dp, 5.dp, 5.dp, 2.dp))
        .padding(horizontal=5.dp, vertical=7.dp), horizontalAlignment=Alignment.CenterHorizontally,
        verticalArrangement=Arrangement.SpaceBetween) {
        Box(Modifier.fillMaxWidth().height(2.dp).background(Color(0xFFEBD5A6)))
        Text(book.optString("title"), color=Color(0xFFFFF5DF), style=MaterialTheme.typography.labelSmall, maxLines=3, overflow=TextOverflow.Ellipsis)
        Box(Modifier.fillMaxWidth().height(2.dp).background(Color(0xFFEBD5A6)))
    }
}

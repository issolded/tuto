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

internal val ReadingMilestones = listOf(10, 50, 100, 150)

/** Counts completed book records, never authored stories or repeated rows. */
internal fun completedBookCount(books: List<JSONObject>): Int = books
    .filter { it.optBoolean("completed") && it.optString("id").isNotBlank() }
    .distinctBy { it.optString("id") }.size

/** The illustrated plate, genuine animation and native targets share one coordinate space. */
@Composable internal fun ReadingRoom(
    items: List<Pair<JSONObject, Boolean>>, count: Int, busy: Boolean,
    allowReading: Boolean, allowWriting: Boolean, onChooseBook: () -> Unit, onNewStory: () -> Unit,
    onSelect: (Pair<JSONObject, Boolean>) -> Unit
) {
    val s = LocalStrings.current
    var award by remember { mutableStateOf<Int?>(null) }
    val heightLimit=(LocalConfiguration.current.screenHeightDp.dp-290.dp).coerceIn(400.dp,620.dp)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Keep labels and cover targets readable; narrow screens can pan the illustrated room.
        BoxWithConstraints(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)), contentAlignment = Alignment.TopCenter) {
            val roomWidth = minOf(maxWidth,heightLimit*2f).coerceAtLeast(800.dp)
            val roomHeight = roomWidth / 2f
            Box(Modifier.horizontalScroll(rememberScrollState())) {
                Box(Modifier.requiredSize(roomWidth, roomHeight).testTag("reading-room")) {
                    Image(painterResource(R.drawable.library_room_paper), null, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
                    Text(s.say("Reading milestones", "Okuma ödülleri", "Premios de lectura"),
                        Modifier.offset(roomWidth * .305f, roomHeight * .01f).width(roomWidth * .30f),
                        style = MaterialTheme.typography.titleMedium, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    Row(Modifier.offset(roomWidth * .31f, roomHeight * .065f).size(roomWidth * .29f, roomHeight * .205f),
                        horizontalArrangement = Arrangement.SpaceEvenly) {
                        ReadingMilestones.forEachIndexed { index, target ->
                            val earned = count >= target
                            Column(Modifier.weight(1f).fillMaxHeight()
                                .clickable(role = Role.Button) { award = target }.testTag("reading-award-$target"),
                                horizontalAlignment = Alignment.CenterHorizontally) {
                                AwardArt(index, earned, Modifier.weight(1f).fillMaxWidth().padding(horizontal=8.dp))
                                Text("$target", style=MaterialTheme.typography.labelLarge, color=Ink.main)
                            }
                        }
                    }
                    ReadingCompanion(Modifier.offset(roomWidth * .32f, roomHeight * .37f)
                        .size(roomWidth * .29f, roomHeight * .51f)
                        .clickable(enabled=allowReading && !busy, role=Role.Button, onClickLabel=s.say("Choose a book", "Kitap seç", "Elegir un libro"), onClick=onChooseBook).testTag("reading-companion"))
                    if (allowReading) {
                        Surface(Modifier.offset(roomWidth * .315f, roomHeight * .275f).width(roomWidth * .30f),
                            color=Color.White, shape=RoundedCornerShape(18.dp), shadowElevation=2.dp) {
                            Text(s.say("What are you reading now?", "Şimdi hangi kitabı okuyorsun?", "¿Qué estás leyendo ahora?"),
                                Modifier.padding(horizontal=10.dp, vertical=8.dp), style=MaterialTheme.typography.labelLarge,
                                textAlign=androidx.compose.ui.text.style.TextAlign.Center)
                        }
                        Button(onClick=onChooseBook, enabled=!busy,
                            modifier=Modifier.offset(roomWidth * .35f, roomHeight * .88f).width(roomWidth * .24f).heightIn(min=48.dp).testTag("choose-book")) {
                            Text(s.say("Choose a book", "Kitap seç", "Elegir un libro"), color=Color.White)
                        }
                    }
                    if (allowWriting) Button(onClick=onNewStory, enabled=!busy,
                        colors=ButtonDefaults.buttonColors(containerColor=Color.White, contentColor=Ink.main),
                        modifier=Modifier.offset(roomWidth * .06f, roomHeight * .64f).width(roomWidth * .215f).heightIn(min=48.dp).testTag("new-story")) {
                        Text(s.say("Write a story", "Hikâye yaz", "Escribir cuento"))
                    }
                    Text(s.say("My books", "Kitaplarım", "Mis libros"),
                        Modifier.offset(roomWidth * .66f, roomHeight * .015f).width(roomWidth * .30f),
                        style=MaterialTheme.typography.titleMedium, textAlign=androidx.compose.ui.text.style.TextAlign.Center)
                    val shelfBottoms = listOf(.338f, .56f, .785f)
                    repeat(3) { row ->
                        Row(Modifier.offset(roomWidth * .663f, roomHeight * (shelfBottoms[row] - .178f))
                            .width(roomWidth * .292f).height(roomHeight * .178f),
                            verticalAlignment=Alignment.Bottom, horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                            items.drop(row * 3).take(3).forEach { item ->
                                RoomBook(item.first, Modifier.weight(1f).fillMaxHeight()
                                    .clickable(role=Role.Button) { onSelect(item) }.testTag("shelf-${item.first.optString("id")}"))
                            }
                            repeat((3-items.drop(row*3).take(3).size).coerceAtLeast(0)) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                    if (items.isEmpty()) Text(
                        s.say(if (busy) "Loading your books…" else "Your finished books will find a home here.", if (busy) "Kitapların yükleniyor…" else "Bitirdiğin kitaplar burada yerini alacak.", if (busy) "Cargando tus libros…" else "Tus libros terminados tendrán un lugar aquí."),
                        Modifier.offset(roomWidth * .68f, roomHeight * .16f).width(roomWidth * .26f),
                        color=Ink.soft, style=MaterialTheme.typography.bodyMedium,
                        textAlign=androidx.compose.ui.text.style.TextAlign.Center)
                }
            }
        }
        val next = ReadingMilestones.firstOrNull { it > count }
        Text(s.say(if(count==1) "1 book finished" else "$count books finished", "$count kitap tamamlandı", if(count==1) "1 libro terminado" else "$count libros terminados") +
            (next?.let { s.say(" · ${it-count} to your next award", " · sonraki ödüle ${it-count} kitap", " · ${it-count} para tu próximo premio") } ?: ""),
            style=MaterialTheme.typography.labelLarge, color=Ink.green)
    }
    award?.let { target ->
        AlertDialog(onDismissRequest={award=null}, title={Text(s.say("$target-book award", "$target kitap ödülü", "Premio de $target libros"))},
            text={Text(if(count>=target) s.say("You've reached this reading milestone!", "Bu okuma hedefine ulaştın!", "¡Has alcanzado esta meta de lectura!")
                else s.say("${target-count} more completed books to fill this shelf. Every book counts once.", "Bu raf için ${target-count} kitap daha tamamla. Her kitap bir kez sayılır.", "Termina ${target-count} libros más. Cada libro cuenta una vez."))},
            confirmButton={TextButton(onClick={award=null}) { Text(s.say("Close", "Kapat", "Cerrar")) }})
    }
}

/** Resolution-independent paper award silhouettes; future awards stay unfilled. */
@Composable private fun AwardArt(index: Int, earned: Boolean, modifier: Modifier) {
    Canvas(modifier) {
        val ink = if(earned) Color(0xFFD5A14F) else Color(0xFFBCBBC8)
        val w=size.width; val h=size.height
        val path=androidx.compose.ui.graphics.Path()
        when(index) {
            0 -> repeat(10) { i ->
                val angle=-Math.PI/2+i*Math.PI/5
                val radius=if(i%2==0) .43f else .20f
                val x=w*.5f+kotlin.math.cos(angle).toFloat()*minOf(w,h)*radius
                val y=h*.5f+kotlin.math.sin(angle).toFloat()*minOf(w,h)*radius
                if(i==0) path.moveTo(x,y) else path.lineTo(x,y)
            }
            1 -> { path.moveTo(w*.2f,h*.12f); path.lineTo(w*.8f,h*.12f); path.quadraticBezierTo(w*.8f,h*.65f,w*.55f,h*.68f); path.lineTo(w*.55f,h*.82f); path.lineTo(w*.76f,h*.82f); path.lineTo(w*.76f,h*.94f); path.lineTo(w*.24f,h*.94f); path.lineTo(w*.24f,h*.82f); path.lineTo(w*.45f,h*.82f); path.lineTo(w*.45f,h*.68f); path.quadraticBezierTo(w*.2f,h*.65f,w*.2f,h*.12f) }
            2 -> { path.moveTo(w*.08f,h*.18f); path.lineTo(w*.5f,h*.28f); path.lineTo(w*.92f,h*.18f); path.lineTo(w*.92f,h*.83f); path.lineTo(w*.5f,h*.94f); path.lineTo(w*.08f,h*.83f) }
            else -> { path.moveTo(w*.1f,h*.24f); path.lineTo(w*.31f,h*.48f); path.lineTo(w*.5f,h*.1f); path.lineTo(w*.69f,h*.48f); path.lineTo(w*.9f,h*.24f); path.lineTo(w*.81f,h*.88f); path.lineTo(w*.19f,h*.88f) }
        }
        path.close()
        drawPath(path, ink.copy(alpha=if(earned) 1f else .35f))
        drawPath(path, ink, style=androidx.compose.ui.graphics.drawscope.Stroke(1.5.dp.toPx()))
    }
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

package app.tuto.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.semantics.clearAndSetSemantics
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.data.optStringOrNull
import org.json.JSONObject

@OptIn(ExperimentalLayoutApi::class)
@Composable fun LibraryBrowser(books: List<JSONObject>, stories: List<JSONObject>, archive: Boolean, onArchive: (Boolean)->Unit, busy: Boolean, allowReading: Boolean, allowWriting: Boolean, onNewBook:()->Unit, onNewStory:()->Unit, onOpen:(JSONObject,Boolean)->Unit, onFinish:(JSONObject)->Unit, onDelete:(JSONObject,Boolean)->Unit) {
    val s=LocalStrings.current
    var query by rememberSaveable { mutableStateOf("") }
    var kind by rememberSaveable { mutableStateOf("all") }
    var year by rememberSaveable { mutableStateOf("") }
    var page by rememberSaveable { mutableIntStateOf(0) }
    var selected by remember { mutableStateOf<Pair<JSONObject,Boolean>?>(null) }
    val all=books.map { it to false } + stories.map { it to true }
    fun completed(item: Pair<JSONObject,Boolean>) = if(item.second) item.first.optString("status")=="completed" else item.first.optBoolean("completed")
    fun finishedYear(b: JSONObject)=b.optStringOrNull("completed_at")?.take(4).orEmpty()
    val items=all.filter { completed(it)==archive && it.first.optString("title").contains(query,true) && (kind=="all" || it.second==(kind=="stories")) && (year.isEmpty() || finishedYear(it.first)==year) }
    val years=all.filter(::completed).map { finishedYear(it.first) }.filter { it.isNotBlank() }.distinct().sortedDescending()
    Row(Modifier.fillMaxWidth(), verticalAlignment=Alignment.CenterVertically, horizontalArrangement=Arrangement.spacedBy(16.dp)) {
        Column(Modifier.weight(1f), verticalArrangement=Arrangement.spacedBy(6.dp)) {
            Text(s.say("Your reading room", "Okuma odan", "Tu rincón de lectura"), style=MaterialTheme.typography.headlineLarge)
            Text(s.say("Every book is a new world. Make this room yours.", "Her kitap yeni bir dünya. Bu oda senin.", "Cada libro es un mundo. Este rincón es tuyo."), color=Ink.soft)
        }
    }
    FlowRow(horizontalArrangement=Arrangement.spacedBy(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
        FilterChip(selected=!archive,onClick={onArchive(false);page=0},label={Text(s.say("Continue reading", "Okumaya devam", "Seguir leyendo"))})
        FilterChip(selected=archive,onClick={onArchive(true);page=0},label={Text(s.say("My bookshelf", "Kitap rafım", "Mi estantería"))},modifier=Modifier.testTag("library-archive"))
        run {
            if(allowReading) Button(onClick=onNewBook,enabled=!busy) { Text(s.say("Book Explorer", "Kitap keşfi", "Explorar libros")) }
            if(allowWriting) Button(onClick=onNewStory,enabled=!busy,modifier=Modifier.testTag("new-story")) { Text(s.say("Write a story", "Hikâye yaz", "Escribir cuento")) }
        }
    }
    OutlinedTextField(query,{query=it;page=0},label={Text(s.say("Search books and stories", "Kitap ve hikâye ara", "Buscar libros y cuentos"))},modifier=Modifier.fillMaxWidth())
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
        listOf("all" to s.say("All", "Tümü", "Todos"),"books" to s.say("Books", "Kitaplar", "Libros"),"stories" to s.say("Stories", "Hikâyeler", "Cuentos")).forEach { (value,label) -> FilterChip(selected=kind==value,onClick={kind=value;page=0},label={Text(label)}) }
        if(archive && years.isNotEmpty()) {
            FilterChip(selected=year.isEmpty(),onClick={year="";page=0},label={Text(s.say("All years", "Tüm yıllar", "Todos los años"))})
            years.forEach { y -> FilterChip(selected=year==y,onClick={year=y;page=0},label={Text(y)}) }
        }
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val wide = maxWidth >= 840.dp
        val pages=((items.size+35)/36).coerceAtLeast(1)
        val current=page.coerceAtMost(pages-1)
        val shown=items.drop(current*36).take(36)
        val completedCount=all.count(::completed)
        val shelves: @Composable () -> Unit = {
            ShelfRoom(shown, archive, busy, onSelect={selected=it})
        }
        Column(verticalArrangement=Arrangement.spacedBy(16.dp)) {
            if(wide) Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.spacedBy(24.dp), verticalAlignment=Alignment.Top) {
                Box(Modifier.weight(1f)) { shelves() }
                ReadingNook(completedCount, Modifier.width(260.dp))
            } else {
                ReadingNook(completedCount, Modifier.fillMaxWidth(), compact=true)
                shelves()
            }
            if(pages>1) Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.SpaceBetween) {
                TextButton(onClick={page=(current-1).coerceAtLeast(0)}, enabled=current>0) { Text(s.say("Previous", "Önceki", "Anterior")) }
                Text("${current+1} / $pages")
                TextButton(onClick={page=current+1}, enabled=current+1<pages) { Text(s.say("Next", "Sonraki", "Siguiente")) }
            }
        }
    }
    selected?.let { (b,story) -> AlertDialog(onDismissRequest={selected=null},title={Text(b.optString("title"))},text={Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
        BookCover(b,Modifier.width(160.dp).height(212.dp))
        b.optStringOrNull("author")?.let { Text(it, color=Ink.soft) }
        if(story) Text(s.say("Your original story", "Senin hikâyen", "Tu propio cuento"), color=Ink.green)
        if(completed(b to story)) {
            Text(s.say("Finished · part of your collection", "Tamamlandı · koleksiyonunda", "Terminado · en tu colección"), color=Ink.green)
            b.optStringOrNull("completed_at")?.let { Text(it.take(10), style=MaterialTheme.typography.bodySmall) }
        } else if(!story) Text(s.say("Page ${b.optInt("current_page")} of ${b.optInt("total_pages")}", "${b.optInt("total_pages")} sayfanın ${b.optInt("current_page")}. sayfası", "Página ${b.optInt("current_page")} de ${b.optInt("total_pages")}"))
        if(!archive && !story) TextButton(onClick={selected=null;onFinish(b)},enabled=!busy) { Text(s.say("Finished reading", "Okumayı bitirdim", "Lectura terminada")) }
        TextButton(onClick={selected=null;onDelete(b,story)},enabled=!busy) { Text(s.say("Delete", "Sil", "Eliminar")) }
    }},confirmButton={TextButton(onClick={selected=null;onOpen(b,story)},enabled=!busy) { Text(s.say("Open", "Aç", "Abrir")) }},dismissButton={TextButton(onClick={selected=null}) { Text(s.say("Close", "Kapat", "Cerrar")) }}) }
}

private val BookColors=listOf(Color(0xFF315B75), Color(0xFF6C8265), Color(0xFFA76049), Color(0xFF746187), Color(0xFF345E5A), Color(0xFF936A39))

@Composable private fun ReadingNook(count:Int, modifier:Modifier, compact:Boolean=false) {
    val s=LocalStrings.current
    var replay by remember { mutableIntStateOf(0) }
    val portrait: @Composable ()->Unit = {
        Box(Modifier.size(if(compact) 140.dp else 256.dp).clickable(role=androidx.compose.ui.semantics.Role.Button, onClickLabel=s.say("Read with Tuto", "Tuto ile oku", "Leer con Tuto")) { replay++ }) {
            Fox(Modifier.fillMaxSize(), FoxPose.Reading, event=replay)
        }
    }
    val stats: @Composable ()->Unit = {
        Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(s.say("COLLECTION", "KOLEKSİYON", "COLECCIÓN"), style=MaterialTheme.typography.labelLarge, color=Ink.soft)
            Text(s.say("$count adventures finished", "$count macera tamamlandı", "$count aventuras terminadas"), style=MaterialTheme.typography.titleLarge)
            Text(s.say("Tap a book to look inside.", "İçine bakmak için bir kitaba dokun.", "Toca un libro para abrirlo."), color=Ink.soft)
            // A reading milestone visualises real records; it never grants or invents Gems.
            val next=(count/5+1)*5
            LinearProgressIndicator(progress={ (count%5)/5f }, modifier=Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(8.dp)), color=Ink.green)
            Text(s.say("Next collection milestone: $next", "Sıradaki koleksiyon hedefi: $next", "Próximo hito de colección: $next"), style=MaterialTheme.typography.bodySmall, color=Ink.soft)
        }
    }
    if(compact) Row(modifier, verticalAlignment=Alignment.CenterVertically, horizontalArrangement=Arrangement.spacedBy(12.dp)) { portrait(); Box(Modifier.weight(1f)) { stats() } }
    else Column(modifier, horizontalAlignment=Alignment.CenterHorizontally, verticalArrangement=Arrangement.spacedBy(12.dp)) { portrait(); stats() }
}

@Composable private fun ShelfRoom(items:List<Pair<JSONObject,Boolean>>, archive:Boolean, busy:Boolean, onSelect:(Pair<JSONObject,Boolean>)->Unit) {
    val s=LocalStrings.current
    BoxWithConstraints(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Color(0xFFF4F0E8)).padding(18.dp)) {
        val cols=(maxWidth.value/126).toInt().coerceIn(2,6)
        val rows=items.chunked(cols)
        Column(verticalArrangement=Arrangement.spacedBy(24.dp)) {
            Text(if(archive) s.say("WORLDS YOU'VE EXPLORED", "KEŞFETTİĞİN DÜNYALAR", "MUNDOS EXPLORADOS") else s.say("YOUR NEXT CHAPTER", "SIRADAKİ BÖLÜMÜN", "TU PRÓXIMO CAPÍTULO"), style=MaterialTheme.typography.labelLarge, color=Ink.soft)
            repeat(maxOf(if(archive) 2 else 1, rows.size)) { index ->
                Column {
                    Row(Modifier.fillMaxWidth().heightIn(min=172.dp).padding(horizontal=8.dp), horizontalArrangement=Arrangement.spacedBy(12.dp), verticalAlignment=Alignment.Bottom) {
                        val row=rows.getOrNull(index).orEmpty()
                        row.forEach { item ->
                            Column(Modifier.weight(1f).padding(bottom=1.dp).clickable(role=androidx.compose.ui.semantics.Role.Button) { onSelect(item) }.testTag("shelf-${item.first.optString("id")}"), horizontalAlignment=Alignment.CenterHorizontally) {
                                BookCover(item.first, Modifier.fillMaxWidth().height(164.dp))
                                if(!archive && !item.second && item.first.optInt("total_pages")>0) {
                                    val b=item.first
                                    LinearProgressIndicator(progress={(b.optInt("current_page").toFloat()/b.optInt("total_pages")).coerceIn(0f,1f)}, modifier=Modifier.fillMaxWidth().padding(top=6.dp).height(6.dp))
                                }
                            }
                        }
                        repeat(cols-row.size) { Spacer(Modifier.weight(1f)) }
                        if(row.isEmpty() && index==0) Text(s.say(if(busy) "Loading your books…" else if(items.isEmpty() && archive) "Your finished books belong here.\nOne adventure at a time." else "Your next adventure starts here.", if(busy) "Kitapların yükleniyor…" else "Yeni maceraların burada yerini alacak.", if(busy) "Cargando tus libros…" else "Tus próximas aventuras estarán aquí."), modifier=Modifier.weight(cols.toFloat()).padding(bottom=28.dp), color=Ink.soft)
                    }
                    Box(Modifier.fillMaxWidth().height(13.dp).shadow(4.dp, RoundedCornerShape(3.dp)).background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(Color(0xFFD8B58A), Color(0xFFAE825A)))))
                    Box(Modifier.fillMaxWidth().height(7.dp).background(Color(0xFF7E593C).copy(alpha=.1f)))
                }
            }
        }
    }
}

@Composable private fun BookCover(book:JSONObject, modifier:Modifier) {
    val s=LocalStrings.current
    val color=BookColors[(book.optString("id").hashCode() and Int.MAX_VALUE)%BookColors.size]
    val title=book.optString("title").ifBlank { s.say("My story", "Hikâyem", "Mi cuento") }
    Box(modifier.shadow(5.dp, RoundedCornerShape(3.dp,10.dp,10.dp,3.dp)).clip(RoundedCornerShape(3.dp,10.dp,10.dp,3.dp)).background(color)) {
        Box(Modifier.align(Alignment.CenterEnd).width(6.dp).fillMaxHeight().padding(vertical=5.dp).background(Color(0xFFFFF8E9)))
        Box(Modifier.width(10.dp).fillMaxHeight().background(Color.Black.copy(alpha=.16f)))
        Column(Modifier.fillMaxSize().padding(start=19.dp,end=13.dp,top=16.dp,bottom=12.dp), horizontalAlignment=Alignment.CenterHorizontally, verticalArrangement=Arrangement.SpaceBetween) {
            Box(Modifier.fillMaxWidth().height(2.dp).background(Color(0xFFEBD5A6).copy(alpha=.65f)))
            val cover=book.optStringOrNull("cover_url")
            if(cover!=null) RemotePhoto(cover, Modifier.fillMaxWidth().height(56.dp), maxHeight=56.dp)
            else Text("✦", color=Color(0xFFEBD5A6), style=MaterialTheme.typography.headlineMedium)
            Text(title, color=Color(0xFFFFF5DF), style=MaterialTheme.typography.titleMedium, maxLines=3, overflow=TextOverflow.Ellipsis, textAlign=androidx.compose.ui.text.style.TextAlign.Center)
            Box(Modifier.fillMaxWidth().height(2.dp).background(Color(0xFFEBD5A6).copy(alpha=.65f)))
        }
    }
}

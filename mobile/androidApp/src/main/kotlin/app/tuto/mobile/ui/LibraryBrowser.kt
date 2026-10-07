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
    Row(Modifier.fillMaxWidth().card(LocalPalette.current.bg).padding(12.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(16.dp)) {
        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(s.say(if(archive) "Your bookshelf" else "A little reading, a big adventure", if(archive) "Kitaplığın" else "Bir kitap, büyük bir macera", if(archive) "Tu estantería" else "Un libro, una gran aventura"),style=MaterialTheme.typography.headlineMedium)
            Text(s.say(if(archive) "The books you've finished, all in one place." else "Continue your book or create a story of your own.", if(archive) "Bitirdiğin kitaplar bir arada." else "Kitabına devam et veya kendi hikâyeni yaz.", if(archive) "Tus libros terminados, juntos." else "Continúa tu libro o escribe tu cuento."),color=Ink.soft)
        }
        Fox(Modifier.size(156.dp),FoxPose.Reading)
    }
    FlowRow(horizontalArrangement=Arrangement.spacedBy(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
        FilterChip(selected=!archive,onClick={onArchive(false);page=0},label={Text(s.say("My Books", "Kitaplarım", "Mis libros"))})
        FilterChip(selected=archive,onClick={onArchive(true);page=0},label={Text(s.say("My Library", "Kitaplığım", "Mi biblioteca"))},modifier=Modifier.testTag("library-archive"))
        if(!archive) {
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
    if(items.isEmpty() && !busy) Text(s.say(if(archive) "Your finished books will appear on this shelf." else "Your next adventure starts with a book or a story.", if(archive) "Bitirdiğin kitaplar bu rafta görünecek." else "Yeni bir kitap veya hikâyeyle başla.", if(archive) "Aquí aparecerán tus libros terminados." else "Empieza con un libro o cuento."),modifier=Modifier.padding(24.dp))
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val cols=(maxWidth.value/160).toInt().coerceIn(1,6)
        val pages=((items.size+35)/36).coerceAtLeast(1)
        val current=page.coerceAtMost(pages-1)
        Column(verticalArrangement=Arrangement.spacedBy(18.dp)) {
            items.drop(current*36).take(36).chunked(cols).forEach { row ->
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(if(archive) Color(0xFFF0E9DB) else Color.Transparent)) {
                    Row(Modifier.padding(12.dp),horizontalArrangement=Arrangement.spacedBy(14.dp),verticalAlignment=Alignment.Bottom) {
                        row.forEach { item ->
                            val b=item.first
                            Column(Modifier.weight(1f).clickable { selected=item },verticalArrangement=Arrangement.spacedBy(8.dp)) {
                                BookCover(b,Modifier.fillMaxWidth().height(180.dp).clearAndSetSemantics {})
                                Text(b.optString("title").ifBlank { s.say("My story", "Hikâyem", "Mi cuento") },maxLines=2,overflow=TextOverflow.Ellipsis,style=MaterialTheme.typography.titleMedium)
                                if(!archive && !item.second) {
                                    val total=b.optInt("total_pages");val read=b.optInt("current_page")
                                    Text("$read / ${if(total>0) total.toString() else "?"}",style=MaterialTheme.typography.bodySmall)
                                    if(total>0) LinearProgressIndicator(progress={(read.toFloat()/total).coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth())
                                }
                            }
                        }
                        repeat(cols-row.size) { Spacer(Modifier.weight(1f)) }
                    }
                    if(archive) Box(Modifier.fillMaxWidth().height(10.dp).background(Color(0xFFC7AB87)))
                }
            }
            if(pages>1) Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                TextButton(onClick={page=(current-1).coerceAtLeast(0)},enabled=current>0) { Text(s.say("Previous", "Önceki", "Anterior")) }
                Text("${current+1} / $pages")
                TextButton(onClick={page=current+1},enabled=current+1<pages) { Text(s.say("Next", "Sonraki", "Siguiente")) }
            }
        }
    }
    selected?.let { (b,story) -> AlertDialog(onDismissRequest={selected=null},title={Text(b.optString("title"))},text={Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
        BookCover(b,Modifier.fillMaxWidth().height(200.dp))
        if(!archive && !story) TextButton(onClick={selected=null;onFinish(b)},enabled=!busy) { Text(s.say("Finished reading", "Okumayı bitirdim", "Lectura terminada")) }
        TextButton(onClick={selected=null;onDelete(b,story)},enabled=!busy) { Text(s.say("Delete", "Sil", "Eliminar")) }
    }},confirmButton={TextButton(onClick={selected=null;onOpen(b,story)},enabled=!busy) { Text(s.say("Open", "Aç", "Abrir")) }},dismissButton={TextButton(onClick={selected=null}) { Text(s.say("Close", "Kapat", "Cerrar")) }}) }
}

@Composable private fun BookCover(book:JSONObject,modifier:Modifier) {
    val colors=listOf(Color(0xFF456C80),Color(0xFF76866A),Color(0xFFB07659),Color(0xFF776789))
    val index=(book.optString("id").hashCode() and Int.MAX_VALUE)%colors.size
    Box(modifier.clip(RoundedCornerShape(4.dp,14.dp,14.dp,4.dp)).background(colors[index]).padding(12.dp),contentAlignment=Alignment.Center) {
        val cover=book.optStringOrNull("cover_url")
        if(cover!=null) RemotePhoto(cover,Modifier.fillMaxSize(),maxHeight=220.dp)
        else Column(horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(12.dp)) {
            PaperIcon("reading",Modifier.size(52.dp))
            Text(book.optString("title"),color=Color(0xFFFFE9BC),style=MaterialTheme.typography.titleMedium,maxLines=4,overflow=TextOverflow.Ellipsis)
        }
    }
}

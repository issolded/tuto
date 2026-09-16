package app.tuto.mobile

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.*

@Composable fun LibraryPage(s:StudioState,p:Palette) {
    var title by rememberSaveable { mutableStateOf("") };var total by rememberSaveable { mutableStateOf("") };var adding by rememberSaveable { mutableStateOf(false) }
    PageTitle("One more chapter","My library","Bring a book from your shelf. Keep your reading adventure here.")
    Panel(Lilac){Row(verticalAlignment=Alignment.CenterVertically){StudioIcon("book",Modifier.size(100.dp));Column(Modifier.weight(1f).padding(start=18.dp)){Text("Your next adventure is waiting",style=MaterialTheme.typography.titleLarge);Text("${s.books.count{it.page==it.total}} finished · ${s.books.count{it.page<it.total}} in progress")}};Button(onClick={adding=!adding}){Text(if(adding)"Close" else "+ Add my book")}}
    if(adding) Panel {OutlinedTextField(title,{title=it},label={Text("Book title")},modifier=Modifier.fillMaxWidth());OutlinedTextField(total,{total=it.filter(Char::isDigit).take(5)},label={Text("Total pages")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number));Button(onClick={s.addBook(title,total.toIntOrNull()?:0);title="";total="";adding=false},enabled=title.isNotBlank()&&(total.toIntOrNull()?:0) in 1..10000){Text("Add to my library")}}
    if(s.books.isEmpty()) Text("Your shelf is ready. Add the book you are reading at home or at school.")
    s.books.forEachIndexed { index,b->key(b.id){
        var page by rememberSaveable(b.id,b.page){mutableStateOf(b.page.toString())}
        var removing by remember{mutableStateOf(false)}
        Panel(listOf(Lilac,Sky,Mint,Butter)[index%4]) {Row(verticalAlignment=Alignment.CenterVertically){StudioIcon("book",Modifier.size(66.dp));Column(Modifier.weight(1f).padding(start=12.dp)){Text(b.title,style=MaterialTheme.typography.titleLarge);Text(if(b.page==b.total)"Finished!" else "Page ${b.page} of ${b.total}")}}
            LinearProgressIndicator(progress={b.page.toFloat()/b.total},modifier=Modifier.fillMaxWidth())
            OutlinedTextField(page,{page=it.filter(Char::isDigit).take(5)},label={Text("I have read up to page…")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
            Row {Button(onClick={s.page(b.id,page.toIntOrNull()?:b.page)},enabled=(page.toIntOrNull()?:-1) in 0..b.total){Text("Save progress")};TextButton(onClick={removing=true}){Text("Remove")}}
            if(removing) AlertDialog(onDismissRequest={removing=false},title={Text("Remove this book?")},text={Text("The reading progress for this book will be removed from this device.")},confirmButton={TextButton(onClick={s.removeBook(b.id);removing=false}){Text("Remove")}},dismissButton={TextButton(onClick={removing=false}){Text("Keep book")}})
        }
    }}
    Text("Reading records are saved on this device. This is a reading tracker for your own books; it does not include licensed book text.",style=MaterialTheme.typography.bodySmall)
}
@Composable fun StoryPage(s:StudioState,p:Palette) {
    var open by rememberSaveable { mutableStateOf<String?>(null) }
    PageTitle("The story workshop","My stories","Invent a character. Give them a problem. See where your story takes you.")
    Panel(Lilac){Text("A spark for your imagination",style=MaterialTheme.typography.titleLarge);Text(when {s.age<=8->"A tiny dragon finds a library inside a tree. What book does it choose?";s.age<=10->"You discover a map that changes every sunrise. Where does it lead?";else->"Your town receives a message sent from ten years in the future. Who wrote it — and why?"})}
    OutlinedTextField(s.storyTitle,{s.draft(it,s.storyBody)},label={Text("Give your story a title")},modifier=Modifier.fillMaxWidth())
    OutlinedTextField(s.storyBody,{s.draft(s.storyTitle,it)},label={Text("Once upon an idea…")},minLines=8,modifier=Modifier.fillMaxWidth())
    Text("Draft saved automatically · ${s.storyBody.trim().split(Regex("\\s+")).count{it.isNotBlank()}} words",style=MaterialTheme.typography.bodySmall)
    Button(onClick=s::saveStory,enabled=s.storyTitle.isNotBlank()&&s.storyBody.isNotBlank(),modifier=Modifier.fillMaxWidth()){Text("Save my story")}
    Text("Your bookshelf",style=MaterialTheme.typography.titleLarge)
    s.stories.reversed().forEach{n->Surface(onClick={open=if(open==n.id)null else n.id},color=Color.White,shape=RoundedCornerShape(22.dp)){Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){Text(n.title,style=MaterialTheme.typography.titleLarge);Text(n.date,style=MaterialTheme.typography.labelMedium);if(open==n.id)Text(n.body) else Text("Open story →")}}}
}
@Composable fun HomeworkPage(s:StudioState,p:Palette) {
    var title by rememberSaveable{mutableStateOf("")};var notes by rememberSaveable{mutableStateOf("")}
    PageTitle("Look what I learned","My homework","Keep your task and a few notes together.")
    Panel(Sky){StudioIcon("write",Modifier.size(80.dp));OutlinedTextField(title,{title=it},label={Text("Task or subject")},modifier=Modifier.fillMaxWidth());OutlinedTextField(notes,{notes=it},label={Text("What did you do? What was tricky?")},minLines=4,modifier=Modifier.fillMaxWidth());Button(onClick={s.addHomework(title,notes);title="";notes=""},enabled=title.isNotBlank()){Text("Save my work note")}}
    Text("Work journal",style=MaterialTheme.typography.titleLarge)
    s.homework.reversed().forEach{n->Panel{Text(n.title,style=MaterialTheme.typography.titleLarge);Text(n.body);Text("${n.date} · Saved on this device",style=MaterialTheme.typography.labelMedium)}}
    Text("Photo upload, AI checking and parent review will be connected in the live version. These notes are not submitted for approval.",style=MaterialTheme.typography.bodySmall)
}
@Composable fun TreePage(s:StudioState,p:Palette) {
    var category by rememberSaveable{mutableStateOf("Self care")};var custom by rememberSaveable{mutableStateOf("")};var archive by rememberSaveable{mutableStateOf(false)}
    PageTitle("Good things grow","My tree","Small acts of care make a difference — at home and beyond.")
    Panel(Mint){TreeScene(s.todayCount.coerceAtMost(4));Text("${s.todayCount} contributions today",style=MaterialTheme.typography.titleLarge);LinearProgressIndicator(progress={(s.todayCount/4f).coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth(),color=Color(0xFF368763));Text("This preview tree grows from your own records. No Gems or parent approvals are added.")}
    Text("What did you do today?",style=MaterialTheme.typography.titleLarge)
    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("Self care","At home","Family","Outside").forEach{c->FilterChip(category==c,{category=c},label={Text(c)})}}
    val choices=when(category){"Self care"->listOf("Made my bed","Packed my school bag","Tidied my space");"At home"->listOf("Set the table","Helped with the dishes","Put things away");"Family"->listOf("Helped someone","Read with my family","Did something kind");else->listOf("Watered a plant","Helped in the garden","Picked up litter safely")}
    choices.forEach{c->OutlinedButton(onClick={s.contribute(c,category)},modifier=Modifier.fillMaxWidth()){Text("+  $c")}}
    OutlinedTextField(custom,{custom=it},label={Text("Or write your own contribution")},modifier=Modifier.fillMaxWidth())
    Button(onClick={s.contribute(custom,category);custom=""},enabled=custom.isNotBlank()){Text("Add to my tree")}
    Row(verticalAlignment=Alignment.CenterVertically){Text("My forest journal",style=MaterialTheme.typography.titleLarge,modifier=Modifier.weight(1f));FilterChip(archive,{archive=!archive},label={Text(if(archive)"All days" else "Today")})}
    s.contributions.filter{archive||it.date==java.time.LocalDate.now().toString()}.reversed().forEach{c->Panel{Text(c.title,style=MaterialTheme.typography.titleMedium);Text("${c.category} · ${c.date} · Self-recorded",style=MaterialTheme.typography.bodySmall);TextButton(onClick={s.removeContribution(c.id)}){Text("Undo this record")}}}
}
@Composable fun TreeScene(growth:Int) {
    Canvas(Modifier.fillMaxWidth().height(210.dp)) {
        val c=center;val ground=size.height*.88f;drawOval(Color(0xFFA7D7B8),androidx.compose.ui.geometry.Offset(c.x-120,ground-12),androidx.compose.ui.geometry.Size(240f,25f))
        val h=55f+growth*22f;drawLine(Color(0xFF9A654E),androidx.compose.ui.geometry.Offset(c.x,ground),androidx.compose.ui.geometry.Offset(c.x,ground-h),18f,androidx.compose.ui.graphics.StrokeCap.Round)
        val leaves=listOf(androidx.compose.ui.geometry.Offset(-32f,-12f),androidx.compose.ui.geometry.Offset(30f,-18f),androidx.compose.ui.geometry.Offset(0f,-40f),androidx.compose.ui.geometry.Offset(-51f,8f),androidx.compose.ui.geometry.Offset(51f,8f))
        leaves.take(growth+1).forEachIndexed{i,o->drawCircle(listOf(Color(0xFF52A982),Color(0xFF70BD84),Color(0xFF3A956E))[i%3],38f+growth*4,androidx.compose.ui.geometry.Offset(c.x+o.x,ground-h+o.y))}
        repeat(growth){i->drawCircle(Butter,7f,androidx.compose.ui.geometry.Offset(c.x-32+i*22,ground-h-5+(i%2)*18))}
    }
}

package app.tuto.mobile

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.*
import androidx.compose.ui.semantics.*
import app.tuto.core.*

val Ink = Color(0xFF211747)
val Violet = Color(0xFF6237CE)
val Coral = Color(0xFFE6534D)
val Mint = Color(0xFFD9EFE1)
val Butter = Color(0xFFFFE8A3)
val Sky = Color(0xFFD6E9FD)
val Lilac = Color(0xFFE9DDF9)
val Rose = Color(0xFFFFDDD9)
@Composable fun studioTypography(): Typography {
    val body = FontFamily(Font(R.font.nunito))
    val head = FontFamily(Font(R.font.fredoka))
    return Typography(bodyLarge=TextStyle(fontFamily=body,fontSize=18.sp,lineHeight=26.sp),bodyMedium=TextStyle(fontFamily=body,fontSize=16.sp,lineHeight=23.sp),bodySmall=TextStyle(fontFamily=body,fontSize=14.sp,lineHeight=20.sp),titleLarge=TextStyle(fontFamily=head,fontSize=26.sp,fontWeight=FontWeight.Bold),titleMedium=TextStyle(fontFamily=head,fontSize=20.sp,fontWeight=FontWeight.Medium),headlineLarge=TextStyle(fontFamily=head,fontSize=38.sp,fontWeight=FontWeight.Bold),headlineMedium=TextStyle(fontFamily=head,fontSize=30.sp,fontWeight=FontWeight.Bold),labelLarge=TextStyle(fontFamily=body,fontSize=15.sp,fontWeight=FontWeight.Bold),labelMedium=TextStyle(fontFamily=body,fontSize=13.sp,fontWeight=FontWeight.Bold),labelSmall=TextStyle(fontFamily=body,fontSize=12.sp))
}
@Composable fun PageTitle(kicker:String,title:String,subtitle:String) {
    Text(kicker.uppercase(),color=Violet,style=MaterialTheme.typography.labelLarge)
    Text(title,style=MaterialTheme.typography.headlineLarge,color=Ink)
    Text(subtitle,color=Ink.copy(alpha=.78f))
}
@Composable fun StudioIcon(kind:String,modifier:Modifier=Modifier.size(64.dp),color:Color=Violet) {
    Canvas(modifier) {
        val s=size.minDimension/64f
        translate((size.width-64*s)/2,(size.height-64*s)/2) { scale(s,s,Offset.Zero) {
            when(kind) {
                "tree" -> { drawRoundRect(Color(0xFFAC7353),Offset(28f,31f),Size(8f,28f),CornerRadius(3f));drawCircle(color,16f,Offset(22f,27f));drawCircle(color,18f,Offset(39f,25f));drawCircle(color,15f,Offset(31f,13f));drawCircle(Butter,3f,Offset(22f,23f));drawCircle(Butter,3f,Offset(42f,27f)) }
                "book" -> { drawRoundRect(color,Offset(6f,12f),Size(52f,43f),CornerRadius(6f));drawPath(Path().apply {moveTo(10f,8f);quadraticBezierTo(23f,5f,32f,14f);quadraticBezierTo(44f,5f,54f,8f);lineTo(54f,47f);quadraticBezierTo(42f,45f,32f,53f);quadraticBezierTo(22f,45f,10f,47f);close()},Color.White);drawLine(color,Offset(32f,14f),Offset(32f,49f),2f);for(y in listOf(22f,29f,36f)){drawLine(color,Offset(15f,y),Offset(25f,y),2f);drawLine(color,Offset(38f,y),Offset(49f,y),2f)} }
                "science" -> {drawRoundRect(color,Offset(25f,5f),Size(15f,7f),CornerRadius(2f));drawPath(Path().apply {moveTo(28f,12f);lineTo(28f,27f);lineTo(10f,52f);quadraticBezierTo(7f,59f,17f,59f);lineTo(48f,59f);quadraticBezierTo(57f,59f,52f,51f);lineTo(37f,27f);lineTo(37f,12f);close()},color);drawCircle(Butter,5f,Offset(26f,44f));drawCircle(Color.White,3f,Offset(39f,49f));drawCircle(color,3f,Offset(15f,17f));drawCircle(Coral,4f,Offset(49f,21f))}
                "draw","write" -> { drawRoundRect(Color.White,Offset(7f,10f),Size(40f,47f),CornerRadius(5f));rotate(35f,Offset(35f,31f)){drawRoundRect(color,Offset(30f,4f),Size(12f,43f),CornerRadius(3f));drawPath(Path().apply{moveTo(30f,47f);lineTo(42f,47f);lineTo(36f,59f);close()},Color(0xFFE8B679));drawLine(Color.White,Offset(34f,10f),Offset(34f,42f),2f)} }
                "math" -> { drawRoundRect(color,Offset(10f,5f),Size(45f,54f),CornerRadius(9f));drawRoundRect(Color.White,Offset(17f,12f),Size(31f,13f),CornerRadius(3f));for(x in listOf(22f,34f,45f))for(y in listOf(35f,47f))drawCircle(Butter,3f,Offset(x,y)) }
                "home" -> {drawPath(Path().apply{moveTo(6f,28f);lineTo(32f,7f);lineTo(58f,28f);lineTo(50f,28f);lineTo(50f,56f);lineTo(14f,56f);lineTo(14f,28f);close()},color);drawRoundRect(Color.White,Offset(27f,35f),Size(12f,22f),CornerRadius(3f))}
                "more" -> {for(x in listOf(18f,45f))for(y in listOf(18f,45f))drawRoundRect(color,Offset(x-8,y-8),Size(17f,17f),CornerRadius(5f))}
                "goal" -> {drawCircle(color,26f,center);drawCircle(Color.White,18f,center);drawCircle(Coral,10f,center);drawLine(Butter,Offset(32f,32f),Offset(55f,7f),5f,StrokeCap.Round)}
                else -> {drawCircle(Coral,13f,Offset(17f,41f));drawRect(Butter,Offset(36f,29f),Size(24f,24f));drawPath(Path().apply{moveTo(31f,3f);lineTo(49f,26f);lineTo(13f,26f);close()},color)}
            }
        } }
    }
}
@Composable fun ActivityTile(title:String,detail:String,icon:String,color:Color,onClick:()->Unit) {
    Surface(onClick=onClick,color=color,shape=RoundedCornerShape(26.dp),modifier=Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically) { StudioIcon(icon,Modifier.size(66.dp));Text("↗",fontSize=24.sp,color=Ink) }
            Text(title,style=MaterialTheme.typography.titleLarge,color=Ink)
            Text(detail,style=MaterialTheme.typography.bodyMedium,color=Ink)
        }
    }
}
@Composable fun TileGrid(wide:Boolean,tiles:List<@Composable ()->Unit>) {
    tiles.chunked(if(wide) 3 else 2).forEach { row -> Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp)) { row.forEach { tile -> Box(Modifier.weight(1f)){tile()} };repeat((if(wide)3 else 2)-row.size){Spacer(Modifier.weight(1f))} } }
}
@Composable fun StudioHome(vm:MobileState,s:StudioState,p:Palette,wide:Boolean) {
    Surface(color=if(vm.theme==ThemeChoice.MORPH) Color(0xFFFFEDCE) else Lilac,shape=RoundedCornerShape(32.dp)) {
        if(wide) Row(verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(.9f).padding(28.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                Text("A LITTLE CURIOSITY. A BIG ADVENTURE.",style=MaterialTheme.typography.labelLarge,color=p.accent)
                Text("Make today\nyours, ${vm.name}!",style=MaterialTheme.typography.headlineLarge,color=Ink)
                Text("Read a chapter. Make something. Discover your next big idea.")
                Button(onClick={vm.page="science"},colors=ButtonDefaults.buttonColors(containerColor=p.action)){Text("Let's make a discovery →")}
            }
            Image(painterResource(R.drawable.studio_hero),null,Modifier.weight(1.1f).height(300.dp),contentScale=ContentScale.Crop)
        } else Column {
            Image(painterResource(R.drawable.studio_hero),null,Modifier.fillMaxWidth().height(190.dp),contentScale=ContentScale.Crop)
            Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) { Text("Make today yours, ${vm.name}!",style=MaterialTheme.typography.headlineMedium);Text("A world of things to learn, make and grow.") }
        }
    }
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically) { Text("Choose your adventure",style=MaterialTheme.typography.titleLarge);Text("Ages ${s.band}",style=MaterialTheme.typography.labelLarge,color=p.accent) }
    TileGrid(wide,listOf(
        { ActivityTile("Maths","Numbers, shapes & problem solving","math",Sky){vm.start(Subject.MATH)} },
        { ActivityTile("Science","Ask, explore & investigate","science",Mint){vm.page="science"} },
        { ActivityTile("Puzzles","Patterns & visual thinking","puzzle",Butter){vm.start(Subject.PATTERNS)} },
        { ActivityTile("My library","Books & reading adventures","book",Lilac){vm.page="library"} },
        { ActivityTile("My drawings","Step-by-step creative studio","draw",Rose){vm.page="drawings"} },
        { ActivityTile("My stories","Your ideas, your own words","write",Mint){vm.page="stories"} }
    ))
    Surface(onClick={vm.page="tree"},color=Mint,shape=RoundedCornerShape(26.dp)) { Row(Modifier.fillMaxWidth().padding(20.dp),verticalAlignment=Alignment.CenterVertically) { StudioIcon("tree",Modifier.size(86.dp),Color(0xFF369A70));Column(Modifier.weight(1f).padding(start=16.dp)){Text("Small acts. A growing tree.",style=MaterialTheme.typography.titleLarge);Text("${s.todayCount} contributions recorded today. What will you do next?")};Text("→",fontSize=24.sp) } }
    TileGrid(false,listOf({ActivityTile("My homework","Keep your work together","write",Sky){vm.page="homework"}},{ActivityTile("My goals","Plan your well-earned breaks","goal",Butter){vm.page="goals"}}))
    if(vm.session?.finished==false) OutlinedButton(onClick=vm::resume){Text("Continue my practice →")}
}
@Composable fun AgeChoice(s: StudioState) {
    Panel {
        Text("Learning age", style = MaterialTheme.typography.titleLarge)
        Text("Science activities adapt to ages 6–8, 9–10 and 11–13. Maths and puzzles are starter samples in this preview.")
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            (6..13).forEach { age ->
                FilterChip(selected = s.age == age, onClick = { s.age(age) }, label = { Text("$age") })
            }
        }
    }
}
@Composable fun MorePage(vm:MobileState,s:StudioState,p:Palette) {
    PageTitle("Your space","A little more Tuto","Your goals, your style and your progress.")
    listOf(Triple("goals","My goals","Choose what you are working towards"),Triple("gems","Gem history","Your practice and play-time requests"),Triple("homework","My homework","Notes and a local work journal"),Triple("screen","Screen time","Plan a healthy break with your family"),Triple("settings","My style & language","Classic or Morph Studio · English / Türkçe")).forEach{(page,title,detail)->Surface(onClick={vm.page=page},color=Color.White,shape=RoundedCornerShape(22.dp)){Column(Modifier.fillMaxWidth().padding(20.dp)){Text("$title  →",style=MaterialTheme.typography.titleLarge);Text(detail)}}}
    Text("Preview on this device. Books, drawings and notes stay here. Parent approval, live accounts and AI feedback are not connected yet.",style=MaterialTheme.typography.bodySmall)
}
@Composable fun CreatePage(vm:MobileState,s:StudioState,p:Palette,wide:Boolean) {
    PageTitle("The creative studio","Big ideas start here","Pick up a pencil, invent a world or keep a piece of work you're proud of.")
    TileGrid(wide,listOf({ActivityTile("Draw something","Explore the existing drawing collection","draw",Rose){vm.page="drawings"}},{ActivityTile("Write a story","A blank page full of possibilities","write",Lilac){vm.page="stories"}},{ActivityTile("My homework","Record a task and what you learned","book",Sky){vm.page="homework"}}))
    Text("Made by you",style=MaterialTheme.typography.titleLarge)
    Text("${s.stories.size} saved stories · ${s.homework.size} homework notes")
}
@Composable fun GoalsPage(vm:MobileState,s:StudioState,p:Palette) {
    PageTitle("Make a plan","My goals","Learning, creativity and time to play — together.")
    Panel(Butter){StudioIcon("goal",Modifier.size(90.dp));Text(s.goal,style=MaterialTheme.typography.headlineMedium);Text("${vm.wallet.balance} / 20 preview Gems");LinearProgressIndicator(progress={(vm.wallet.balance/20f).coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth());Text("Choose the activity you would like to discuss with your family.");listOf("Roblox · 15 minutes","TV · 15 minutes","Family game · 15 minutes").forEach { title->FilterChip(selected=s.goal==title,onClick={s.goal(title)},label={Text(title)}) };Button(onClick={vm.page="gems"}){Text("View Gems & request time →")}}
    Text("Goals are local plans. Requests do not send a parent notification or unlock another app in this preview.")
}

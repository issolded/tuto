package app.tuto.mobile.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntSize
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.games.NotebookPuzzles
import kotlin.math.*

@Composable fun NotebookGames(vm:TutoViewModel) {
 val s=LocalStrings.current
 var helperPose by remember{mutableStateOf(FoxPose.Welcome)}
 var helperEvent by remember{mutableIntStateOf(0)}
 var hint by remember{mutableStateOf(false)}
 val react:(FoxPose)->Unit={helperPose=it;helperEvent++}
 var game by rememberSaveable { mutableStateOf<String?>(null) }
 var round by rememberSaveable { mutableIntStateOf(0) }
 val ids=listOf("memory","tangram","words","sudoku","maze","pattern")
 val labels=listOf("Memory Match","Tangram","Word Hunt","Sudoku","Maze","Pattern Play")
 BackHandler(game!=null){game=null}
 FeaturePage(if(game==null)s.say("Games","Oyunlar","Juegos")else labels[ids.indexOf(game)],{if(game==null)vm.home()else game=null}) {
  if(game==null){
   Text(s.say("Choose a brain break","Kısa bir oyun molası","Elige un descanso divertido"),style=MaterialTheme.typography.titleLarge)
   Row(horizontalArrangement=Arrangement.spacedBy(24.dp)){
    Fox(Modifier.weight(.24f).height(360.dp))
    Column(Modifier.weight(.76f),verticalArrangement=Arrangement.spacedBy(14.dp)){
     ids.chunked(3).forEach{row->Row(horizontalArrangement=Arrangement.spacedBy(14.dp)){row.forEach{id->OutlinedCard(onClick={game=id;round=0},modifier=Modifier.weight(1f).height(177.dp).testTag("game-$id"),colors=CardDefaults.outlinedCardColors(containerColor=Color.White),border=BorderStroke(1.dp,Ink.soft.copy(alpha=.4f))){
      Column(Modifier.fillMaxSize().padding(12.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center){PaperIcon(id,Modifier.size(100.dp));Text(labels[ids.indexOf(id)],style=MaterialTheme.typography.titleLarge)}
     }}}}
    }
   }
  }else{
   Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)){
    Box(Modifier.size(90.dp).clickable{hint=!hint;react(FoxPose.Hint)}.testTag("game-helper")){Fox(Modifier.fillMaxSize(),helperPose,event=helperEvent)}
    TextButton(onClick={hint=!hint;react(FoxPose.Hint)}){Text(s.say("Need a hint?","İpucu ister misin?","¿Una pista?"))}
    if(hint)Text(when(game){"words"->s.say("Follow one straight line, including diagonals.","Çapraz da olabilir; düz bir çizgiyi izle.","Sigue una línea recta, también diagonal.");"memory"->s.say("Remember the position of each picture.","Her resmin yerini hatırla.","Recuerda la posición de cada dibujo.");"sudoku"->s.say("Look for a row with one empty square.","Tek boş karesi olan satırı bul.","Busca una fila con una casilla vacía.");"maze"->s.say("Trace a path and try another turn at a dead end.","Çıkmazda başka bir dönüş dene.","Prueba otro giro en un callejón sin salida.");"tangram"->s.say("Use outlines, then rotate the selected piece.","Çizgileri aç ve seçili parçayı döndür.","Muestra los contornos y gira la pieza.");else->s.say("Find the group of shapes that repeats.","Tekrarlanan şekil grubunu bul.","Busca el grupo que se repite.")},Modifier.weight(1f))
   }
   CompositionLocalProvider(LocalGameReaction provides react){key(game,round){when(game){"memory"->MemoryGame();"tangram"->TangramGame();"words"->WordGame();"sudoku"->SudokuGame((vm.child?.age?:8)>=10);"maze"->MazeGame();else->PatternGame()}}}
   OutlinedButton(onClick={round++;hint=false;react(FoxPose.Welcome)},modifier=Modifier.testTag("game-restart")){Text(s.say("New game","Yeni oyun","Nueva partida"))}
  }
 }
}
private val LocalGameReaction=staticCompositionLocalOf<(FoxPose)->Unit>{{}}
@Composable private fun GameWin(){val react=LocalGameReaction.current;LaunchedEffect(Unit){react(FoxPose.Success)};val s=LocalStrings.current;Row(verticalAlignment=Alignment.CenterVertically){Fox(Modifier.size(130.dp),FoxPose.Success);Text(s.say("You did it!","Başardın!","¡Lo lograste!"),style=MaterialTheme.typography.headlineMedium)}}
@Composable private fun MemoryGame(){
 val react=LocalGameReaction.current;val s=LocalStrings.current;val cards=remember{(listOf("☀","☾","☆","♡","◇","♧")+listOf("☀","☾","☆","♡","◇","♧")).shuffled()}
 var open by remember{mutableStateOf(listOf<Int>())};var matched by remember{mutableStateOf(setOf<Int>())};var turns by remember{mutableIntStateOf(0)}
 LaunchedEffect(open){if(open.size==2){turns++;if(cards[open[0]]==cards[open[1]]){matched=matched+open;react(FoxPose.Happy)} else {react(FoxPose.Thinking);kotlinx.coroutines.delay(850)};open=emptyList()}}
 Text(s.say("Find the matching pairs. Turns: $turns","Eşleri bul. Hamle: $turns","Encuentra las parejas. Turnos: $turns"))
 cards.indices.toList().chunked(4).forEach{row->Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){row.forEach{i->OutlinedButton(onClick={if(i !in open)open=open+i},enabled=open.size<2&&i !in matched,shape=RoundedCornerShape(12.dp),modifier=Modifier.weight(1f).height(90.dp)){Text(if(i in open||i in matched)cards[i]else"?",style=MaterialTheme.typography.headlineLarge)}}}}
 if(matched.size==12)GameWin()
}
@Composable private fun WordGame(){
 val s=LocalStrings.current;val react=LocalGameReaction.current
 val seed=rememberSaveable{kotlin.random.Random.nextInt()};val grid=remember(seed){NotebookPuzzles.wordGrid(kotlin.random.Random(seed))}
 var start by rememberSaveable{mutableIntStateOf(-1)};var completed by rememberSaveable{mutableStateOf("")};var marks by rememberSaveable{mutableStateOf("")};var message by rememberSaveable{mutableStateOf("")}
 val found=completed.split(",").filter{it.isNotBlank()}.toSet();val marked=marks.split(",").mapNotNull{it.toIntOrNull()}.toSet()
 Text(s.say("Tap the first and last letter of a word.","Kelimenin ilk ve son harfine dokun.","Toca la primera y la última letra."))
 Text("${found.size} / ${grid.words.size} · "+grid.words.joinToString("   "){if(it in found)"✓ $it"else it},style=MaterialTheme.typography.titleLarge,modifier=Modifier.testTag("word-progress"))
 Column(Modifier.widthIn(max=520.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){(0 until grid.size).forEach{y->Row(horizontalArrangement=Arrangement.spacedBy(4.dp)){(0 until grid.size).forEach{x->val i=y*grid.size+x
 OutlinedButton(onClick={if(start<0)start=i else {
  val previous=NotebookPuzzles.WordSelection(found,marked);val result=NotebookPuzzles.select(grid,previous,start,i)
  if(result!=previous){completed=result.found.joinToString(",");marks=result.marked.joinToString(",");message="✓ "+(result.found-found).joinToString();react(FoxPose.Happy)}else{message=s.say("Try another line.","Başka bir çizgi dene.","Prueba otra línea.");react(FoxPose.Thinking)}
  start=-1
 }},shape=RoundedCornerShape(8.dp),modifier=Modifier.weight(1f).height(52.dp).testTag("word-cell-$i"),contentPadding=PaddingValues(0.dp),border=BorderStroke(if(i==start)3.dp else 1.dp,Ink.main),colors=ButtonDefaults.outlinedButtonColors(containerColor=if(i in marked)Color(0xFFF4C650)else if(i==start)Color(0xFFFFF0C3)else Color.White)){Text(grid.letters[i].toString(),color=Ink.main)}
 }}}}
 Text(message);if(found.size==grid.words.size)GameWin()
}
@Composable private fun SudokuGame(advanced:Boolean){
 val react=LocalGameReaction.current;val s=LocalStrings.current;val puzzle=remember{NotebookPuzzles.sudoku(advanced)};var values by remember{mutableStateOf(puzzle.given)};var selected by remember{mutableIntStateOf(-1)};var checked by remember{mutableStateOf(false)}
 val done=values==puzzle.solution
 Text(s.say("Use each number once in every row, column and box.","Her sayı satırda, sütunda ve kutuda bir kez olsun.","Usa cada número una vez por fila, columna y bloque."))
 Row(horizontalArrangement=Arrangement.spacedBy(24.dp)){
  Column(Modifier.width(if(advanced)430.dp else 360.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){(0 until puzzle.size).forEach{y->Row(horizontalArrangement=Arrangement.spacedBy(3.dp)){(0 until puzzle.size).forEach{x->val i=y*puzzle.size+x;val fixed=puzzle.given[i]!=0
   Box(Modifier.weight(1f).height(if(advanced)44.dp else 87.dp).background(if(i==selected)Color(0xFFBCE9E5)else if(fixed)Color(0xFFF1F0EA)else Color.White).border(if(x%puzzle.box==0||y%puzzle.box==0)2.dp else 1.dp,Ink.soft).clickable(enabled=!fixed&&!done){selected=i},contentAlignment=Alignment.Center){Text(if(values[i]==0)""else values[i].toString(),color=if(checked&&values[i]!=0&&values[i]!=puzzle.solution[i])MaterialTheme.colorScheme.error else Ink.main,style=MaterialTheme.typography.titleLarge)}
  }}}}
  Column(Modifier.weight(.35f),verticalArrangement=Arrangement.spacedBy(10.dp)){
   (1..puzzle.size).toList().chunked(3).forEach{row->Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){row.forEach{v->OutlinedButton(onClick={values=values.toMutableList().also{it[selected]=v};checked=false},enabled=selected>=0&&!done,modifier=Modifier.weight(1f)){Text("$v")}}}}
   TextButton(onClick={values=values.toMutableList().also{it[selected]=0};checked=false},enabled=selected>=0&&!done){Text(s.say("Erase","Sil","Borrar"))}
   OutlinedButton(onClick={checked=true;react(if(values.withIndex().any{it.value!=0&&it.value!=puzzle.solution[it.index]})FoxPose.Thinking else FoxPose.Happy)}){Text(s.say("Check","Kontrol et","Comprobar"))}
   if(checked&&!done)Text(s.say("Red numbers need another look.","Kırmızı sayılara tekrar bak.","Revisa los números rojos."))
  }
 }
 if(done)GameWin()
}
@Composable private fun MazeGame(){
 val react=LocalGameReaction.current;val s=LocalStrings.current;val maze=remember{NotebookPuzzles.maze()};var pos by remember{mutableIntStateOf(maze.start)};var trail by remember{mutableStateOf(setOf(maze.start))};var steps by remember{mutableIntStateOf(0)}
 fun move(next:Int){if(pos==maze.goal)return;if(next in maze.open&&abs(next%maze.size-pos%maze.size)+abs(next/maze.size-pos/maze.size)==1){pos=next;trail=trail+next;steps++}else react(FoxPose.Thinking)}
 Text(s.say("Find the star. Tap a neighbouring square or use the arrows.","Yıldıza ulaş. Yanındaki kareye veya oklara dokun.","Llega a la estrella. Toca una casilla vecina o usa las flechas."))
 Row(horizontalArrangement=Arrangement.spacedBy(24.dp)){
  Column(Modifier.width(440.dp)){(0 until maze.size).forEach{y->Row{(0 until maze.size).forEach{x->val i=y*maze.size+x;Box(Modifier.size(40.dp).background(if(i !in maze.open)Ink.main else if(i in trail)Color(0xFFE8F2EE)else Color.White).clickable(i in maze.open){move(i)},contentAlignment=Alignment.Center){Text(when(i){pos->"●";maze.goal->"☆";else->""},color=if(i==pos)MaterialTheme.colorScheme.primary else Ink.main)}}}}}
  Column(horizontalAlignment=Alignment.CenterHorizontally){Text("$steps "+s.say("steps","adım","pasos"));OutlinedButton(onClick={move(pos-maze.size)}){Text("↑")};Row{OutlinedButton(onClick={move(pos-1)}){Text("←")};OutlinedButton(onClick={move(pos+1)}){Text("→")}};OutlinedButton(onClick={move(pos+maze.size)}){Text("↓")}}
 }
 if(pos==maze.goal)GameWin()
}
@Composable private fun PatternGame(){
 val react=LocalGameReaction.current;val s=LocalStrings.current;val symbols=listOf("○","△","□","☆");val patterns=remember{listOf(listOf(0,1),listOf(0,1,2),listOf(0,0,1),listOf(0,1,1),listOf(0,1,2,3),listOf(0,1,2,1)).shuffled()};var round by remember{mutableIntStateOf(0)};var message by remember{mutableStateOf("")}
 if(round>=patterns.size){GameWin();return}
 val pattern=patterns[round];val count=pattern.size*2+1;val expected=pattern[count%pattern.size]
 Text(s.say("What comes next?","Sırada ne var?","¿Qué sigue?"),style=MaterialTheme.typography.headlineMedium);Text("${round+1} / ${patterns.size}")
 Text((0 until count).joinToString("   "){symbols[pattern[it%pattern.size]]}+"   ?",style=MaterialTheme.typography.headlineLarge)
 Row(horizontalArrangement=Arrangement.spacedBy(20.dp)){symbols.forEachIndexed{i,symbol->OutlinedButton(onClick={if(i==expected){round++;message="";react(FoxPose.Happy)}else {react(FoxPose.Thinking);message=s.say("Look for the part that repeats.","Tekrarlanan parçayı bul.","Busca la parte que se repite.")}},modifier=Modifier.size(100.dp)){Text(symbol,style=MaterialTheme.typography.headlineLarge)}}};Text(message)
}

private val TangramShapes=listOf(listOf(0f to 0f,4f to 0f,2f to 2f),listOf(0f to 0f,2f to 2f,0f to 4f),listOf(2f to 4f,4f to 4f,4f to 2f),listOf(2f to 2f,3f to 1f,3f to 3f),listOf(0f to 4f,2f to 4f,1f to 3f),listOf(1f to 3f,2f to 2f,3f to 3f,2f to 4f),listOf(3f to 1f,4f to 0f,4f to 2f,3f to 3f))
@Composable private fun TangramGame(){
 val react=LocalGameReaction.current;val s=LocalStrings.current;val colors=listOf(0xFFBCE9E5,0xFFF6D2CA,0xFFF6E5AE,0xFFD5E5CA,0xFFC9DBEA,0xFFE5D6E7,0xFFE7DDD0).map{Color(it)}
 val centers=remember{TangramShapes.map{ps->Offset(ps.map{it.first}.average().toFloat()+1,ps.map{it.second}.average().toFloat()+.5f)}}
 var positions by remember{mutableStateOf(listOf(Offset(8f,1.5f),Offset(7f,4.5f),Offset(10.6f,3.5f),Offset(10.7f,1.2f),Offset(2f,5.8f),Offset(4.2f,5.8f),Offset(9.5f,5.3f)))};var angles by remember{mutableStateOf(List(7){0})};var placed by remember{mutableStateOf(setOf<Int>())};var selected by remember{mutableIntStateOf(0)};var hints by remember{mutableStateOf(false)};var boardSize by remember{mutableStateOf(IntSize.Zero)};var dragging by remember{mutableStateOf(false)}
 fun snap(){val p=positions[selected];if((p-centers[selected]).getDistance()<.35f&&angles[selected]%4==0){positions=positions.toMutableList().also{it[selected]=centers[selected]};placed=placed+selected;react(FoxPose.Happy)}else react(FoxPose.Thinking)}
 Text(s.say("Drag all seven pieces into the square. Select a piece to rotate it.","Yedi parçayı kareye sürükle. Döndürmek için parça seç.","Arrastra las siete piezas al cuadrado. Selecciona una para girarla."))
 Row(horizontalArrangement=Arrangement.spacedBy(20.dp)){
  Canvas(Modifier.width(760.dp).height(440.dp).clipToBounds().border(1.dp,Ink.soft,RoundedCornerShape(12.dp)).onSizeChanged{boardSize=it}.pointerInput(Unit){detectDragGestures(onDragStart={p->val unit=boardSize.width/12f;val q=p/unit;val candidate=(0..6).filter{it !in placed}.minByOrNull{(positions[it]-q).getDistance()};dragging=candidate!=null&&(positions[candidate]-q).getDistance()<1.5f;if(dragging)selected=candidate!!},onDragEnd={if(dragging)snap();dragging=false},onDragCancel={dragging=false}){change,delta->if(dragging&&selected !in placed){change.consume();positions=positions.toMutableList().also{val next=it[selected]+delta/(boardSize.width/12f);it[selected]=Offset(next.x.coerceIn(.6f,11.4f),next.y.coerceIn(.6f,6.3f))}}}}){
   val unit=size.width/12f
   drawRect(Color(0xFFF8F7F2),Offset(unit,.5f*unit),androidx.compose.ui.geometry.Size(4*unit,4*unit));drawRect(Ink.main,Offset(unit,.5f*unit),androidx.compose.ui.geometry.Size(4*unit,4*unit),style=Stroke(2.dp.toPx()))
   fun shape(i:Int,position:Offset,angle:Int):Path {val ps=TangramShapes[i];val cx=centers[i].x-1;val cy=centers[i].y-.5f;val a=angle*PI/2;return Path().apply{ps.forEachIndexed{j,p->val x=p.first-cx;val y=p.second-cy;val out=position+Offset((x*cos(a)-y*sin(a)).toFloat(),(x*sin(a)+y*cos(a)).toFloat());if(j==0)moveTo(out.x*unit,out.y*unit)else lineTo(out.x*unit,out.y*unit)};close()}}
   if(hints)(0..6).forEach{i->drawPath(shape(i,centers[i],0),Ink.soft.copy(alpha=.4f),style=Stroke(1.dp.toPx()))}
   ((0..6).filter{it!=selected}+selected).forEach{i->val p=shape(i,positions[i],angles[i]);drawPath(p,colors[i]);drawPath(p,if(i==selected)MaterialInk else Ink.main,style=Stroke(if(i==selected)3.dp.toPx()else 1.5.dp.toPx()))}
  }
  Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
   Text("${placed.size} / 7")
   (0..6).forEach{i->FilterChip(selected==i,{selected=i},label={Text("${i+1}"+if(i in placed)" ✓"else"")})}
   OutlinedButton(onClick={angles=angles.toMutableList().also{it[selected]=(it[selected]+1)%4};snap()},enabled=selected !in placed){Text(s.say("Rotate ↻","Döndür ↻","Girar ↻"))}
   TextButton(onClick={hints=!hints}){Text(s.say("Show outlines","Çizgileri göster","Mostrar contornos"))}
  }
 }
 if(placed.size==7)GameWin()
}
private val MaterialInk=Color(0xFF168F91)

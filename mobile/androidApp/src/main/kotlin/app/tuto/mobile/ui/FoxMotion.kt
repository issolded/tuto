package app.tuto.mobile.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.tuto.mobile.data.Avatar
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.sin

// Historical name retained for existing learning screens; all art now uses the child's avatar.
enum class FoxPose { Welcome, Happy, Thinking, Hint, Success, Surprised, Reading }
val LocalAvatar=staticCompositionLocalOf { Avatar() }
internal val ShirtHex=listOf("#41B6B5","#F29485","#F4C650","#7EA5BD","#8DAB73","#FFFFFF")
internal val HairHex=listOf("#202022","#493329","#956343","#D9BA70","#A75035","#74645E","#B8B3AA")
internal fun hairOptions(gender:Int)=if(gender==0)listOf(0,1,4,6,7)else listOf(2,3,5,8,9)
internal val SkinHex=listOf("#FFFFFF","#F6D7BC","#DCA074","#A36C49","#694735")

internal fun avatarDrawing(a:Avatar,pose:FoxPose,blink:Boolean=false,step:Int=0,wave:Boolean=false):String {
 val skin=SkinHex[a.skin];val shirt=ShirtHex[a.shirt]
 val mouth=when {pose==FoxPose.Success||pose==FoxPose.Happy -> "<path d='M78 93q22 26 43 0Z'/>";pose==FoxPose.Thinking -> "<path d='M86 103q15-7 27-2' fill='none'/>";pose==FoxPose.Surprised -> "<ellipse cx='100' cy='101' rx='6' ry='9'/>";else -> "<path d='M79 98q20 18 41-2' fill='none'/>"}
 val hair=when(a.hair) {
  1 -> "<path d='M46 66Q30 5 100 14q65 0 58 65l-21-37-25 10 6-24-40 20 4-21Z' fill='#202022'/>"
  2 -> "<path d='M39 110Q25 19 95 14q73-5 69 96l-18 7-8-72q-28 21-70 0l-8 72Z' fill='#202022'/>"
  3 -> "<path d='M49 56Q30 3 102 13q66 0 52 51l-26-28Q88 59 64 32Z' fill='#202022'/><path d='M46 40Q-3 16 13 97q15-22 24-47' fill='#202022'/>"
  4 -> "<path d='M46 66Q30 15 95 13q66-4 61 50l-27-24-20 12 2-24-34 25 2-23Z' fill='#202022'/>"
  5 -> "<path d='M45 65Q30 18 96 14q66-5 59 50l-20-27q-37 26-68-1Z' fill='#202022'/><path d='M44 90q-11 9-3 17-11 8-2 16-10 10-2 17m119-50q11 9 3 17 11 8 2 16 10 10 2 17' fill='none' stroke='#202022' stroke-width='9'/>"
  6 -> "<path d='M44 66q-10-49 53-52 59-2 59 48l-18-28q-48 9-78 17Z' fill='#202022'/><path d='m62 36 61-10m-40 18 44-10' stroke='white' stroke-width='1.5'/>"
  7 -> "<path d='M45 60q-7-39 47-43 55-5 62 40l-16-12q-42-16-79 10Z' fill='#202022'/>"
  8 -> "<path d='M40 104Q20 16 98 14q77-3 65 91l-18 11-9-67q-28 17-69-7l-9 75Z' fill='#202022'/><circle cx='70' cy='18' r='20' fill='#202022'/><circle cx='113' cy='17' r='22' fill='#202022'/>"
  9 -> "<path d='M40 112Q21 18 95 14q77-8 69 100l-17-8-4-62q-29 29-73 3l-7 61Z' fill='#202022'/><path d='M42 61q-13 8 0 17-13 9 0 18m116-35q13 8 0 17 13 9 0 18' fill='none' stroke='#202022' stroke-width='9'/>"
  else -> "<path d='M44 65Q26 44 44 32q-7-22 15-17Q60-2 77 11q16-22 28-2 20-15 27 4 24-8 22 12 25 5 8 24l-23 7-4-25q-13 23-23 0-12 28-25 3-12 26-23 5l-9 28Z' fill='#202022'/>"
 }
 val stride=if(step%2==0) 0 else 9
 return """<ellipse cx="104" cy="319" rx="68" ry="8" fill="#E4E2DC" stroke="none"/>
 <path d="M61 131q-27 0-24 61l24 10 17-65Z" fill="#F29485"/>
 <path d="M77 219l-${9+stride} 68h18l12-65m20-3 ${8+stride} 68h18l-7-67" fill="$skin"/>
 <path d="M68 279q-19 9-23 26 21 13 51 1l-9-25Zm62 0-5 26q31 13 53-1-5-19-30-24Z"/>
 <path d="M52 300h39m39 0h40m-107-12 19 4m60-4 18 4" fill="none" stroke-width="2"/>
 ${when(a.outfit){1->"<path d='M68 199l-4 79 30 3 13-54 9 54 34-3-10-79Z' fill='#7EA5BD'/>";2->"<path d='M69 199l-14 58q48 14 99-1l-14-57Z' fill='$shirt'/>";else->"<path d='M68 199l-3 42 33 4 8-24 7 24 36-4-9-43Z' fill='#202022'/>"}}
 <path d="M88 112v18h25v-18" fill="$skin"/>
 <path d="M80 128l-23 10-14 34 25 10 1 29q36 12 72-1l-2-30 24-9-15-34-29-9q-20 18-39 0Z" fill="$shirt"/>
 <path d="m76 133-9 60m58-61 10 60" fill="none" stroke-width="9"/>
 <path d="M52 166l-10 31q-2 9 8 9l27-20q13-11 3-17-8-2-14 9l-10 5 7-13" fill="$skin"/>
 ${if(pose==FoxPose.Success||wave||pose==FoxPose.Hint) "<path d='m150 166 17-24-9-16q-6-9 0-10l9 7-2-21q0-7 5-5l5 21 3-25q2-6 6-3l-1 29 9-19q4-5 7 0l-8 25 11-8q7-2 6 4l-19 24-23 37Z' fill='$skin'/>" else "<path d='m150 170 12 33-7 19q-6 11-11 2l4-21-11-29' fill='$skin'/>"}
 <path d="M49 65q-20-11-20 10 0 18 19 14 4 42 51 42 47 0 53-42 18 5 19-14 0-18-17-10Q151 22 100 23 49 23 49 65Z" fill="$skin"/>
 ${hair.replace("#202022",HairHex[a.hairColor])}
 <g stroke-width="2.2" fill="none">
 ${if(blink) "<path d='m73 77 9 1m39-1 9 1'/>" else if(a.face==2) "<path d='M73 77q5-5 10 0m37-1q5-5 10 0'/><path d='m73 70 10-1m37-1 10 1' stroke-width='1.3'/>" else if(a.face==3) "<circle cx='78' cy='77' r='3.5' fill='#202022'/><circle cx='125' cy='76' r='3.5' fill='#202022'/><path d='m71 68 13-2m35 0 13 1'/>" else "<ellipse cx='78' cy='77' rx='2.2' ry='4' fill='#202022'/><ellipse cx='125' cy='76' rx='2.2' ry='4' fill='#202022'/>"}
 ${when(a.face){1->"<path d='M99 82l-3 10h8'/><g fill='#202022' stroke='none'><circle cx='65' cy='91' r='1.3'/><circle cx='71' cy='93' r='1.3'/><circle cx='132' cy='91' r='1.3'/><circle cx='139' cy='93' r='1.3'/></g>";4->"<path d='M96 84q14-7 16 2 2 10-13 8M70 64l13 2m35-2 14-1'/>";else->"<path d='M100 83q12-4 10 5-1 5-7 5'/>"}}$mouth</g>
 ${if(a.accessory==1) "<g fill='none'><circle cx='77' cy='77' r='16'/><circle cx='125' cy='77' r='16'/><path d='M93 77h16'/></g>" else if(a.accessory==2) "<path d='M39 72Q28 3 104 7q65 0 57 66' fill='none' stroke-width='7'/><rect x='32' y='65' width='13' height='27' rx='5'/><rect x='157' y='65' width='13' height='27' rx='5'/>" else if(a.accessory==3) "<path d='M43 42Q49-4 112 13l27 28 29 5-15 9q-59-19-110-13Z' fill='#F4C650'/>" else ""}
 ${if(pose==FoxPose.Reading) "<path d='M48 160q26-8 55 8 25-16 55-8v56q-30-4-55 7-25-11-55-7Z' fill='#F29485'/><path d='M103 168v55'/>" else ""}
 """
}
@Composable fun Fox(modifier:Modifier=Modifier,pose:FoxPose=FoxPose.Welcome,event:Any=pose,animate:Boolean=true) {
 val a=LocalAvatar.current;val still=reduceMotion()||!animate;val owner=LocalLifecycleOwner.current
 var active by remember {mutableStateOf(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))}
 DisposableEffect(owner){val observer=LifecycleEventObserver{_,_->active=owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)};owner.lifecycle.addObserver(observer);onDispose{owner.lifecycle.removeObserver(observer)}}
 val arrival=remember{Animatable(1f)};val petArrival=remember{Animatable(1f)};val jump=remember{Animatable(0f)};val breath=remember{Animatable(0f)}
 var step by remember{mutableIntStateOf(0)};var blink by remember{mutableStateOf(false)};var wave by remember{mutableStateOf(false)}
 LaunchedEffect(pose,event,active,still){
  arrival.snapTo(1f);petArrival.snapTo(1f);jump.snapTo(0f);wave=false
  if(active&&!still){
   if(pose==FoxPose.Hint){arrival.snapTo(0f);petArrival.snapTo(0f)
    launch{arrival.animateTo(1f,tween(800));wave=true;delay(700);wave=false}
    launch{delay(250);petArrival.animateTo(1f,tween(650))}
    repeat(8){step++;delay(100)};step=0
   }
   if(pose==FoxPose.Success){repeat(2){jump.animateTo(1f,tween(180));jump.animateTo(0f,tween(240));delay(100)}}
  }
 }
 LaunchedEffect(active,still){breath.snapTo(0f);if(active&&!still)while(true){breath.animateTo(1f,tween(2200));breath.animateTo(0f,tween(2200))}}
 LaunchedEffect(active,still){blink=false;if(active&&!still)while(true){delay(4200);blink=true;delay(130);blink=false}}
 Box(modifier.clipToBounds(),contentAlignment=Alignment.BottomStart){
  NotebookArt(avatarDrawing(a,pose,blink,step,wave),Modifier.fillMaxHeight().fillMaxWidth(.76f).graphicsLayer{translationX=-(1-arrival.value)*size.width;translationY=-jump.value*size.height*.08f;scaleY=1f+breath.value*.008f;rotationZ=if(arrival.value<1)sin(arrival.value*40)*2 else 0f},"15 0 200 335")
  if(a.pet>=0)NotebookArt(petDrawing(a.pet,a.petColor),Modifier.align(Alignment.BottomEnd).fillMaxWidth(.35f).fillMaxHeight(.35f).graphicsLayer{translationX=-(1-petArrival.value)*size.width*4;translationY=if(petArrival.value<1)-kotlin.math.abs(sin(petArrival.value*30))*size.height*.12f else -jump.value*size.height*.1f})
 }
}

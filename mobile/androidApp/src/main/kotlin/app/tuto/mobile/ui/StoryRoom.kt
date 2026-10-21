package app.tuto.mobile.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp


import androidx.compose.ui.platform.testTag
import app.tuto.mobile.data.LocalStrings

private object RoomInk { val ink=Ink.main;val line=Ink.soft.copy(alpha=.25f);val blue=Color(0xFF168F91);val blueWash=Color(0xFFF5F8F6);val sage=Color(0xFF41B6B5);val peach=Color(0xFFF8EADD) }
private fun DrawScope.roomLine(x:Float,y:Float,x2:Float,y2:Float,color:Color=RoomInk.ink,width:Float=2.5f) =
    drawLine(color,Offset(x,y),Offset(x2,y2),width,StrokeCap.Round)
private fun DrawScope.roomRect(x:Float,y:Float,w:Float,h:Float,fill:Color,r:Float=4f) {
    drawRoundRect(fill,Offset(x,y),Size(w,h),CornerRadius(r))
    drawRoundRect(RoomInk.ink,Offset(x,y),Size(w,h),CornerRadius(r),style=Stroke(2.5f))
}
private fun DrawScope.roomBook(x:Float,y:Float,w:Float,h:Float,fill:Color) {
    roomRect(x,y,w,h,fill,3f)
    roomLine(x+5,y+10,x+w-5,y+10,Color.White,2f)
    roomLine(x+5,y+h-10,x+w-5,y+h-10,Color.White,2f)
}
@Composable fun RoomArtwork(modifier:Modifier=Modifier) {
    Canvas(modifier) {
        scale(size.width/1216f,size.height/500f,pivot=Offset.Zero) {
            // White walls, lightly washed floor, an airy window and small framed star.
            drawRect(Color.White,size=Size(1216f,500f))
            drawRect(Color(0xFFF7F3E9),Offset(0f,395f),Size(1216f,105f))
            roomLine(20f,395f,1196f,395f,RoomInk.line,2f)
            roomLine(20f,405f,1196f,405f,RoomInk.line,1f)
            drawOval(RoomInk.blueWash,Offset(348f,406f),Size(520f,66f))
            drawOval(RoomInk.ink,Offset(348f,406f),Size(520f,66f),style=Stroke(2f))
            roomRect(460f,25f,245f,140f,RoomInk.blueWash,14f)
            drawCircle(Color(0xFFE6BA66),23f,Offset(649f,65f))
            drawOval(Color.White,Offset(490f,90f),Size(90f,24f))
            drawOval(Color.White,Offset(571f,109f),Size(80f,20f))
            roomLine(582f,26f,582f,165f)
            roomLine(461f,96f,704f,96f)
            roomRect(448f,162f,269f,12f,Color.White,3f)
            roomRect(885f,42f,84f,86f,RoomInk.peach,3f)
            val star=Path().apply{moveTo(927f,55f);lineTo(935f,75f);lineTo(957f,76f);lineTo(940f,91f);lineTo(945f,112f);lineTo(927f,101f);lineTo(909f,112f);lineTo(914f,91f);lineTo(897f,76f);lineTo(919f,75f);close()}
            drawPath(star,Color(0xFFE6BA66)); drawPath(star,RoomInk.ink,style=Stroke(2f))
            // Actual shelf construction and individual book spines, not a card grid.
            roomRect(70f,93f,274f,302f,Color(0xFFF4E4C8),8f)
            roomRect(86f,109f,242f,270f,Color.White,2f)
            listOf(190f,280f,375f).forEach{roomRect(82f,it,250f,10f,Color(0xFFE5CCA3),2f)}
            val fills=listOf(RoomInk.blue,RoomInk.sage,Color(0xFFC5876C),Color(0xFFE6BA66),Color(0xFF879B7C))
            repeat(7){i->roomBook(98f+i*30f,125f+(i%3)*7,22f,64f-(i%3)*7,fills[i%5])}
            repeat(5){i->roomBook(98f+i*34f,213f+(i%2)*10,26f,66f-(i%2)*10,fills[(i+2)%5])}
            roomBook(99f,307f,30f,67f,RoomInk.blue);roomBook(135f,318f,28f,56f,RoomInk.peach)
            roomRect(185f,339f,105f,35f,RoomInk.sage,5f)
            roomLine(196f,351f,278f,351f,RoomInk.ink,1.5f)
            roomLine(88f,395f,84f,417f);roomLine(326f,395f,331f,417f)
            // Reading armchair, cushion, open book and reading lamp.
            roomRect(475f,237f,185f,147f,RoomInk.sage,28f)
            roomRect(490f,273f,155f,90f,Color(0xFFF0F4EB),18f)
            roomRect(460f,302f,36f,88f,RoomInk.sage,14f);roomRect(641f,302f,36f,88f,RoomInk.sage,14f)
            roomRect(491f,359f,151f,34f,RoomInk.sage,9f)
            roomLine(486f,393f,480f,420f);roomLine(649f,393f,656f,420f)
            roomLine(719f,190f,719f,414f);roomLine(692f,415f,744f,415f)
            val shade=Path().apply{moveTo(693f,168f);lineTo(742f,168f);lineTo(759f,211f);lineTo(678f,211f);close()}
            drawPath(shade,RoomInk.peach);drawPath(shade,RoomInk.ink,style=Stroke(2.5f))
            // Writing desk with open notebook, pencils, drawer and stool.
            roomRect(823f,287f,307f,18f,Color(0xFFE5CCA3),5f)
            roomLine(843f,306f,833f,417f,RoomInk.ink,5f);roomLine(1109f,306f,1120f,417f,RoomInk.ink,5f)
            roomRect(1020f,306f,89f,65f,RoomInk.peach,4f);drawCircle(RoomInk.ink,4f,Offset(1064f,338f))
            roomRect(901f,250f,109f,34f,Color.White,4f);roomLine(954f,253f,954f,282f)
            repeat(3){i->roomLine(912f,259f+i*7,943f,259f+i*7,RoomInk.blue,1.5f)}
            roomLine(982f,246f,1012f,223f,Color(0xFFC5876C),5f)
            roomRect(1050f,243f,36f,41f,RoomInk.blueWash,3f)
            roomLine(1058f,244f,1051f,211f,RoomInk.blue,5f);roomLine(1068f,244f,1071f,207f,Color(0xFFC5876C),5f);roomLine(1078f,244f,1088f,219f,RoomInk.ink,4f)
            roomRect(893f,365f,91f,19f,RoomInk.sage,6f);roomLine(906f,384f,899f,425f);roomLine(972f,384f,980f,425f)
            // Plant beside the bookcase; decorative only.
            roomRect(369f,351f,40f,44f,RoomInk.peach,5f)
            roomLine(389f,351f,390f,300f,Color(0xFF427659),3f)
            drawOval(RoomInk.sage,Offset(366f,309f),Size(25f,15f));drawOval(RoomInk.sage,Offset(389f,298f),Size(27f,16f))
            roomLine(369f,314f,389f,328f,Color(0xFF427659),2f);roomLine(390f,320f,411f,302f,Color(0xFF427659),2f)
        }
    }
}

internal fun seatedReaderDrawing(a:app.tuto.mobile.data.Avatar):String {
 val original=avatarDrawing(a,FoxPose.Welcome)
 val head=original.substring(original.indexOf("<path d=\"M49 65"))
 val skin=SkinHex[a.skin];val shirt=ShirtHex[a.shirt]
 return """<path d='M65 205q22 4 34 24l-25 34-17-10 13-28-20-9m56-10 25 22 20 30-19 10-34-41' fill='#202022'/>
 <path d='m58 249 19 12-10 21q-23 6-31-5l13-22Z'/><path d='m133 255 20-10 20 22q2 14-27 13l-12-13Z'/>
 <path d='m43 273 21 2m82-2 21-3' fill='none' stroke-width='2'/>
 <path d='M88 116v22h24v-22' fill='$skin'/><path d='M82 130 56 144l-12 41 21 13 7 23q30 10 65-2l-1-26 23-13-17-37-23-12q-18 17-37-1Z' fill='$shirt'/>
 <path d='M53 174q-4 30 31 20l18-19-9-9-19 15-10-9m82-1q10 26-23 23l-20-16 8-11 18 14 7-13' fill='$skin'/>
 <path d='M70 165q25-4 38 12 19-16 44-10l-6 52q-20-2-38 9-17-11-38-9Z' fill='#F29485'/><path d='M108 177v51M80 179l16 6m-16 5 16 6m24-12 20-4m-20 15 18-4' fill='none' stroke-width='2'/>
 $head"""
}

@Composable fun StoryRoom(onShelf:()->Unit,onRead:()->Unit,onWrite:()->Unit,allowReading:Boolean,allowWriting:Boolean) {
 val s=LocalStrings.current;val a=LocalAvatar.current
 Text("TUTO · "+s.say("My Stories","Hikâyelerim","Mis historias"),style=MaterialTheme.typography.headlineLarge)
 BoxWithConstraints(Modifier.fillMaxWidth().aspectRatio(1216f/500f).testTag("story-room")){
  val u=maxWidth/1216f
  RoomArtwork(Modifier.fillMaxSize())
  NotebookArt(seatedReaderDrawing(a),Modifier.offset(u*475,u*139).size(u*185,u*271),"15 0 190 285",s.say("Your avatar reading","Kitap okuyan avatarın","Tu avatar leyendo"))
  if(a.pet>=0)NotebookArt(petDrawing(a.pet),Modifier.offset(u*707,u*316).size(u*105,u*105))
  @Composable fun target(x:Float,y:Float,w:Float,h:Float,label:String,tag:String,enabled:Boolean=true,action:()->Unit){
   Box(Modifier.offset(u*x,u*y).size(u*w,u*h).clickable(enabled=enabled,role=Role.Button,onClickLabel=label,onClick=action).testTag(tag),contentAlignment=Alignment.BottomCenter){
    Surface(color=Color.White,shape=RoundedCornerShape(10.dp),border=BorderStroke(1.5.dp,Ink.main),modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)){Text(label,Modifier.padding(8.dp),style=MaterialTheme.typography.titleLarge,textAlign=androidx.compose.ui.text.style.TextAlign.Center)}
   }
  }
  target(60f,75f,295f,411f,s.say("My bookshelf","Kitaplığım","Mi estantería"),"room-shelf",action=onShelf)
  target(447f,135f,240f,351f,s.say("Read","Oku","Leer"),"room-read",allowReading,onRead)
  target(814f,228f,330f,258f,s.say("Write","Yaz","Escribir"),"room-write",allowWriting,onWrite)
 }
}

package app.tuto.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.LocalStrings

/** The approved two-panel creator: preview left, four visual catalogs right. */
@OptIn(ExperimentalLayoutApi::class)
@Composable fun AvatarEditor(vm:TutoViewModel) {
 val s=LocalStrings.current;val a=vm.avatar
 var tab by rememberSaveable{mutableIntStateOf(0)}
 var expressions by rememberSaveable{mutableStateOf(false)}
 Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
  Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(18.dp)){TextButton(onClick={vm.open("me")}){Text(s.say("Back","Geri","Atrás"))};Text("TUTO",style=MaterialTheme.typography.headlineLarge);VerticalDivider(Modifier.height(32.dp));Text(s.say("Create your avatar","Avatarını oluştur","Crea tu avatar"),style=MaterialTheme.typography.headlineLarge)}
  Row(Modifier.fillMaxWidth().weight(1f),horizontalArrangement=Arrangement.spacedBy(28.dp)) {
   Column(Modifier.weight(.38f).fillMaxHeight().verticalScroll(rememberScrollState()),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(12.dp)) {
    Fox(Modifier.fillMaxWidth().height(345.dp),animate=false)
    Text((a.nickname.ifBlank{vm.child?.name.orEmpty()})+(if(a.pet>=0&&a.petName.isNotBlank())" & ${a.petName}" else ""),style=MaterialTheme.typography.headlineMedium)
    OutlinedTextField(a.nickname.ifBlank{vm.child?.name.orEmpty()},{vm.updateAvatar(a.copy(nickname=it.take(30)))},label={Text(s.say("Your name","Adın","Tu nombre"))},singleLine=true,modifier=Modifier.fillMaxWidth())
   }
   Column(Modifier.weight(.62f).fillMaxHeight().verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)) {
    Row(horizontalArrangement=Arrangement.spacedBy(12.dp)) {
     listOf(s.say("Boy","Erkek","Niño"),s.say("Girl","Kız","Niña")).forEachIndexed{i,label->FilterChip(a.gender==i,{vm.updateAvatar(a.copy(gender=i,hair=if(i==0)0 else 2,outfit=0))},label={Text(label)},modifier=Modifier.testTag("avatar-gender-$i"))}
    }
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
     listOf(s.say("Character","Karakter","Personaje"),s.say("Outfit","Kıyafet","Ropa"),s.say("Extras","Aksesuar","Extras"),s.say("Pet","Dostum","Mascota")).forEachIndexed{i,label->
      Column(Modifier.weight(1f),horizontalAlignment=Alignment.CenterHorizontally){TextButton(onClick={tab=i},modifier=Modifier.fillMaxWidth().testTag("avatar-tab-$i")){Column(horizontalAlignment=Alignment.CenterHorizontally){if(i==0)NotebookArt(avatarDrawing(a.copy(accessory=0),FoxPose.Welcome),Modifier.size(32.dp),"15 0 165 140")else PaperIcon(listOf("me","outfit","extras","pet")[i],Modifier.size(32.dp));Text(label,style=MaterialTheme.typography.titleMedium)}};HorizontalDivider(thickness=if(tab==i)4.dp else 1.dp,color=if(tab==i)androidx.compose.ui.graphics.Color(0xFFF4C650) else Ink.soft.copy(alpha=.2f))}
     }
    }
    Text(when(tab){0->s.say("Make it look like you","Sana benzesin","Que se parezca a ti");1->s.say("Choose your outfit","Kıyafetini seç","Elige tu ropa");2->s.say("A little personality","Biraz kişilik kat","Un toque personal");else->s.say("Choose your companion","Dostunu seç","Elige tu compañero")},style=MaterialTheme.typography.titleLarge)
    if(tab==0)Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){FilterChip(!expressions,{expressions=false},label={Text(s.say("Hair","Saç","Pelo"))});FilterChip(expressions,{expressions=true},label={Text(s.say("Face","Yüz","Rostro"))})}
    val ids=when(tab){0->if(expressions)(0..4).toList() else hairOptions(a.gender);1->(if(a.gender==0)0..1 else 0..2).toList();2->(0..3).toList();else->(0..5).toList()}
    val petLabels=listOf(s.say("Dog","Köpek","Perro"),s.say("Cat","Kedi","Gato"),s.say("Rabbit","Tavşan","Conejo"),s.say("Fox","Tilki","Zorro"),s.say("Panda","Panda","Panda"),s.say("Turtle","Kaplumbağa","Tortuga"))
    ids.chunked(3).forEach{row->Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){
     row.forEach{id->
      val outfit=id
      val selected=when(tab){0->if(expressions)a.face==id else a.hair==id;1->a.outfit==id;2->a.accessory==id;else->a.pet==id}
      val label=when(tab){0->if(expressions)s.say("Face ${id+1}","Yüz ${id+1}","Rostro ${id+1}") else listOf(s.say("Curly","Kıvırcık","Rizado"),s.say("Short","Kısa","Corto"),s.say("Bob","Küt","Melena"),s.say("Ponytail","At kuyruğu","Coleta"),s.say("Spiky","Dik","De punta"),s.say("Braids","Örgü","Trenzas"),s.say("Side part","Yandan ayrık","Raya lateral"),s.say("Crop","Kısa kesim","Recortado"),s.say("Bun","Topuz","Moño"),s.say("Waves","Dalgalı","Ondulado"))[id];1->listOf(s.say("Shorts","Şort","Pantalón corto"),s.say("Trousers","Pantolon","Pantalón"),s.say("Dress","Elbise","Vestido"))[outfit];2->listOf(s.say("None","Yok","Ninguno"),s.say("Glasses","Gözlük","Gafas"),s.say("Headphones","Kulaklık","Auriculares"),s.say("Cap","Şapka","Gorra"))[id];else->petLabels[id]}
      OutlinedCard(onClick={vm.updateAvatar(when(tab){0->if(expressions)a.copy(face=id) else a.copy(hair=id);1->a.copy(outfit=outfit);2->a.copy(accessory=id);else->a.copy(pet=id)})},modifier=Modifier.weight(1f).height(136.dp).testTag("avatar-choice-$tab-$id"),border=BorderStroke(if(selected)3.dp else 1.dp,if(selected)MaterialTheme.colorScheme.primary else Ink.soft.copy(alpha=.35f)),colors=CardDefaults.outlinedCardColors(containerColor=androidx.compose.ui.graphics.Color.White)){
       Box(Modifier.fillMaxWidth().weight(1f).padding(8.dp)) {
        if(tab==3)NotebookArt(petDrawing(id,a.petColor),Modifier.fillMaxSize(),description=label)
        else NotebookArt(avatarDrawing(when(tab){0->if(expressions)a.copy(face=id,accessory=0) else a.copy(hair=id,accessory=0);1->a.copy(outfit=outfit);else->a.copy(accessory=id)},FoxPose.Welcome),Modifier.fillMaxSize(),if(tab==1)"25 125 155 195" else "15 0 165 140",label)
        if(selected)Text("✓",Modifier.align(Alignment.TopEnd),color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.titleLarge)
       }
       Text(label,Modifier.align(Alignment.CenterHorizontally).padding(bottom=8.dp),style=MaterialTheme.typography.labelLarge)
      }
     };repeat(3-row.size){Spacer(Modifier.weight(1f))}
    }}
    if(tab==0&&!expressions) AvatarColors(s.say("Hair color","Saç rengi","Color de pelo"),HairHex,a.hairColor){vm.updateAvatar(a.copy(hairColor=it))}
    if(tab==1) AvatarColors(s.say("Outfit color","Kıyafet rengi","Color de ropa"),ShirtHex,a.shirt){vm.updateAvatar(a.copy(shirt=it))}
    if(tab==3&&a.pet>=0) AvatarColors(s.say("Pet color","Dostunun rengi","Color de mascota"),petColors(a.pet),a.petColor){vm.updateAvatar(a.copy(petColor=it))}
    if(tab==3)Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)){
     OutlinedTextField(a.petName,{vm.updateAvatar(a.copy(petName=it.take(30)))},label={Text(s.say("Pet name","Dostunun adı","Nombre de mascota"))},singleLine=true,modifier=Modifier.weight(1f))
     FilterChip(a.pet<0,{vm.updateAvatar(a.copy(pet=-1))},label={Text(s.say("No pet","Dost yok","Sin mascota"))})
    }
    if(tab==0&&!expressions){
     Text(s.say("Skin · paper white by default","Ten · varsayılan kâğıt beyazı","Piel · blanco papel por defecto"),style=MaterialTheme.typography.labelLarge)
     Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){SkinHex.forEachIndexed{i,hex->OutlinedButton(onClick={vm.updateAvatar(a.copy(skin=i))},modifier=Modifier.size(48.dp),contentPadding=PaddingValues(0.dp),colors=ButtonDefaults.outlinedButtonColors(containerColor=androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(hex))),border=BorderStroke(if(a.skin==i)3.dp else 1.dp,Ink.main)){Text(if(a.skin==i)"✓" else "",color=if(i>2)androidx.compose.ui.graphics.Color.White else Ink.main)}}}
    }
   }
  }
  HorizontalDivider()
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
   OutlinedButton(onClick={val hair=hairOptions(a.gender).random();vm.updateAvatar(a.copy(hair=hair,shirt=(0..5).random(),outfit=(if(a.gender==0)0..1 else 0..2).random(),accessory=(0..3).random(),pet=(0..5).random()))}){Text(s.say("Shuffle","Karıştır","Mezclar"))}
   Button(onClick={vm.open("me")}){Text(s.say("Looks like me!","İşte benim!","¡Así soy yo!"))}
  }
 }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable private fun AvatarColors(label:String,colors:List<String>,selected:Int,onSelect:(Int)->Unit){
 Text(label,style=MaterialTheme.typography.labelLarge)
 FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) { colors.forEachIndexed{i,hex->
  OutlinedButton(onClick={onSelect(i)},modifier=Modifier.size(48.dp).testTag("$label-$i"),contentPadding=PaddingValues(0.dp),colors=ButtonDefaults.outlinedButtonColors(containerColor=androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(hex))),border=BorderStroke(if(selected==i)3.dp else 1.dp,Ink.main)) { Text(if(selected==i)"✓"else "",color=if(android.graphics.Color.luminance(android.graphics.Color.parseColor(hex))<.35f)androidx.compose.ui.graphics.Color.White else Ink.main) }
 } }
}

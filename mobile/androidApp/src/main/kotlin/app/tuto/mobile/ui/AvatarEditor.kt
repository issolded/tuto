package app.tuto.mobile.ui
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.LocalStrings

@OptIn(ExperimentalLayoutApi::class)
@Composable fun AvatarEditor(vm:TutoViewModel) {
 val s=LocalStrings.current;val a=vm.avatar
 FeaturePage(s.say("Make it yours","Kendi karakterini oluştur","Hazlo tuyo"),{vm.home()}) {
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(24.dp)){
   Column(Modifier.weight(.35f),horizontalAlignment=Alignment.CenterHorizontally){Fox(Modifier.fillMaxWidth().height(370.dp));Text(vm.child?.name.orEmpty(),style=MaterialTheme.typography.headlineMedium)}
   Column(Modifier.weight(.65f),verticalArrangement=Arrangement.spacedBy(10.dp)){
    Text(s.say("Character","Karakter","Personaje"),style=MaterialTheme.typography.titleLarge)
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf(s.say("Curly","Kıvırcık","Rizado"),s.say("Short","Kısa","Corto"),s.say("Bob","Küt","Melena"),s.say("Ponytail","At kuyruğu","Coleta"),s.say("Spiky","Dik","De punta"),s.say("Braids","Örgülü","Trenzas")).forEachIndexed{i,label->FilterChip(selected=a.hair==i,onClick={vm.updateAvatar(a.copy(hair=i))},label={Text(label)})}}
    Text(s.say("Skin · paper white is the default","Ten · varsayılan kâğıt beyazı","Piel · blanco papel por defecto"))
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){SkinHex.indices.forEach{i->FilterChip(selected=a.skin==i,onClick={vm.updateAvatar(a.copy(skin=i))},label={Text(if(i==0)s.say("Paper","Kâğıt","Papel") else "${i}")})}}
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf(s.say("Shorts","Şort","Pantalón corto"),s.say("Jeans","Pantolon","Pantalón"),s.say("Skirt","Etek","Falda")).forEachIndexed{i,label->FilterChip(selected=a.outfit==i,onClick={vm.updateAvatar(a.copy(outfit=i))},label={Text(label)})}}
    Text(s.say("Clothing colour","Kıyafet rengi","Color de ropa"),style=MaterialTheme.typography.titleLarge)
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf(s.say("Teal","Turkuaz","Turquesa"),s.say("Coral","Mercan","Coral"),s.say("Yellow","Sarı","Amarillo"),s.say("Blue","Mavi","Azul"),s.say("Sage","Yeşil","Verde"),s.say("White","Beyaz","Blanco")).forEachIndexed{i,label->FilterChip(selected=a.shirt==i,onClick={vm.updateAvatar(a.copy(shirt=i))},label={Text(label)})}}
    Text(s.say("Expression","İfade","Expresión"),style=MaterialTheme.typography.titleLarge)
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf(s.say("Normal","Normal","Normal"),s.say("Happy","Mutlu","Feliz"),s.say("Thinking","Düşünen","Pensando"),s.say("Celebrating","Kutlayan","Celebrando"),s.say("Encouraging","Cesaretlendiren","Animando"),s.say("Surprised","Şaşkın","Sorpresa")).forEachIndexed{i,label->FilterChip(selected=a.face==i,onClick={vm.updateAvatar(a.copy(face=i))},label={Text(label)})}}
    Text(s.say("Accessories","Aksesuarlar","Accesorios"),style=MaterialTheme.typography.titleLarge)
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf(s.say("None","Yok","Ninguno"),s.say("Glasses","Gözlük","Gafas"),s.say("Headphones","Kulaklık","Auriculares"),s.say("Cap","Şapka","Gorra")).forEachIndexed{i,label->FilterChip(selected=a.accessory==i,onClick={vm.updateAvatar(a.copy(accessory=i))},label={Text(label)})}}
    Text(s.say("My companion","Dostum","Mi compañero"),style=MaterialTheme.typography.titleLarge)
    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf(s.say("Dog","Köpek","Perro"),s.say("Cat","Kedi","Gato"),s.say("Rabbit","Tavşan","Conejo"),s.say("No pet","Pet yok","Sin mascota")).forEachIndexed{i,label->val id=if(i==3)-1 else i;FilterChip(selected=a.pet==id,onClick={vm.updateAvatar(a.copy(pet=id))},label={Text(label)})}}
    Text(s.say("Saved on this tablet for your profile.","Bu tablette kendi profiline kaydedildi.","Guardado en esta tableta para tu perfil."),style=MaterialTheme.typography.bodySmall)
   }
  }
 }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable fun NotebookGames(vm:TutoViewModel) {
 val s=LocalStrings.current
 var cards by remember { mutableStateOf((listOf("☀","☾","☆","♡","◇","♧")+listOf("☀","☾","☆","♡","◇","♧")).shuffled()) }
 var open by remember {mutableStateOf(listOf<Int>())};var matched by remember{mutableStateOf(setOf<Int>())}
 LaunchedEffect(open){if(open.size==2){if(cards[open[0]]==cards[open[1]])matched=matched+open;else kotlinx.coroutines.delay(850);open=emptyList()}}
 FeaturePage(s.say("Games · Memory pairs","Oyunlar · Eşini bul","Juegos · Parejas"),{vm.home()}){
  Text(s.say("Find the matching pairs. Just for fun — no Gems.","Eşleşen kartları bul. Eğlence için; Gem verilmez.","Encuentra las parejas. Por diversión, sin gems."))
  cards.indices.toList().chunked(4).forEach{row->Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){row.forEach{i->OutlinedButton(onClick={if(i !in open)open=open+i},enabled=open.size<2&&i !in matched,modifier=Modifier.weight(1f).height(92.dp)){Text(if(i in open||i in matched)cards[i] else "?",style=MaterialTheme.typography.headlineLarge)}}}}
  if(matched.size==cards.size){Fox(Modifier.size(180.dp),FoxPose.Success);Text(s.say("All pairs found!","Tüm eşler bulundu!","¡Todas las parejas!"))}
  TextButton(onClick={cards=cards.shuffled();open=emptyList();matched=emptySet()}){Text(s.say("New game","Yeni oyun","Nueva partida"))}
 }
}

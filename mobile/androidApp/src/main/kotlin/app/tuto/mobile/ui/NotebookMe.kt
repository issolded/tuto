package app.tuto.mobile.ui
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.LocalStrings

@Composable fun NotebookMe(vm:TutoViewModel){
 val s=LocalStrings.current;val a=vm.avatar
 FeaturePage("TUTO · "+s.say("Me","Ben","Yo"),{vm.home()}){
  Row(horizontalArrangement=Arrangement.spacedBy(32.dp)){
   Column(Modifier.weight(.38f),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(14.dp)){
    Fox(Modifier.fillMaxWidth().height(330.dp))
    Text(a.nickname.ifBlank{vm.child?.name.orEmpty()}+(if(a.pet>=0&&a.petName.isNotBlank())" & ${a.petName}"else""),style=MaterialTheme.typography.headlineMedium)
    Button(onClick={vm.open("avatar")},modifier=Modifier.fillMaxWidth().testTag("edit-avatar")){Text(s.say("Edit avatar","Avatarını düzenle","Editar avatar"))}
   }
   Column(Modifier.weight(.62f),verticalArrangement=Arrangement.spacedBy(18.dp)){
    val entries=listOf(Triple("drawing",s.say("My creations","Çizimlerim","Mis creaciones"),"drawing"),Triple("library",s.say("My collection","Koleksiyonum","Mi colección"),"library"),Triple("settings",s.say("Learning preferences","Öğrenme tercihlerim","Preferencias de aprendizaje"),"settings"),Triple("settings",s.say("Settings","Ayarlar","Ajustes"),"settings"))
    entries.filter{it.third!="drawing"||vm.child?.active("drawing")==true}.forEach{(icon,label,route)->OutlinedCard(onClick={vm.open(route)},modifier=Modifier.fillMaxWidth(),border=BorderStroke(1.dp,Ink.soft.copy(alpha=.35f))){Row(Modifier.padding(18.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(20.dp)){PaperIcon(icon,Modifier.size(42.dp));Text(label,Modifier.weight(1f),style=MaterialTheme.typography.titleLarge);Text("›",style=MaterialTheme.typography.headlineMedium)}}}
   }
  }
 }
}

package app.tuto.mobile

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

data class ScienceCard(val id:String,val title:String,val intro:String,val activity:String,val question:String,val answers:List<String>,val correct:Int,val explanation:String)
fun scienceCards(age:Int):List<ScienceCard> = when {
    age<=8 -> listOf(
        ScienceCard("plants-young","Plant detectives","Plants are living things. Their roots take in water, and their leaves use light to help make food.","Find a plant. Draw its leaves, stem and any roots you can see. Do not pull it out. What is the same about two leaves?","Which part usually takes water from the soil?",listOf("Roots","Flowers","Fruit"),0,"Roots take in water from the soil. The stem carries water to other parts."),
        ScienceCard("materials-young","Material explorers","Objects can be made from different materials, such as paper, wood, plastic and metal.","Find three safe objects. Look and gently feel: are they smooth, rough, bendy or stiff? Describe the material, not just the object.","Which word describes a material's property?",listOf("Cup","Smooth","Toy"),1,"Smooth describes how a surface feels. Cup and toy name objects."),
        ScienceCard("space-young","Day & night","Earth spins. The side facing the Sun has daylight, while the side facing away has night.","Use a ball as Earth and a torch as the Sun. With an adult, turn the ball slowly. Watch a mark move into and out of the light. Never look directly at the Sun.","Why does a place on Earth have day and night?",listOf("Earth spins","The Sun switches off","The Moon covers Earth every night"),0,"Earth rotates. As your part of Earth turns towards or away from the Sun, day changes to night.")
    )
    age<=10 -> listOf(
        ScienceCard("plants-mid","A fair plant test","A fair comparison changes one factor and keeps other important conditions the same.","Plan a test of how light affects the growth of seedlings. Keep the plant type, water, soil and starting size similar. What will you measure each day?","If you change the light, what should you keep the same?",listOf("The amount of water","Both light and water","The height the plants must reach"),0,"Keeping water the same helps you investigate light. Height is an outcome you measure, not a condition you can keep fixed."),
        ScienceCard("materials-mid","Where did the water go?","Evaporation is a change from liquid water to water vapour. It can happen below boiling temperature.","With an adult, put equal small amounts of water in two dishes, one in a warmer place and one in a cooler place. Predict which will dry first. Do not use a cooker or flame.","When a puddle dries, much of its water…",listOf("Stops existing","Becomes water vapour in the air","Turns into soil"),1,"Liquid water becomes water vapour and mixes with the air. It has changed state, not vanished."),
        ScienceCard("forces-mid","Friction investigators","Friction can oppose movement between touching surfaces.","Slide the same toy gently over a smooth surface and a towel. Try to give it the same start. Repeat. Which result is easier to trust: one trial or several?","Why repeat the test?",listOf("To guarantee your prediction","To see whether the result is consistent","To change the toy each time"),1,"Repeating helps reveal variation. A fair test can still give small differences between trials.")
    )
    else -> listOf(
        ScienceCard("plants-older","Evidence, not guesses","A comparison needs a clear question, measured results and attention to other explanations.","Design a seedling-light investigation. Use several plants per condition, record the light conditions and measure growth over time. Decide what evidence would challenge your prediction.","Why use several plants in each group?",listOf("Plants naturally vary","It makes the prediction automatically correct","Each plant must get a different amount of water"),0,"Plants vary. Several plants per group help distinguish a pattern from an unusual individual."),
        ScienceCard("materials-older","A change of state","Particles are conserved when pure water melts, freezes or evaporates in a closed system.","Draw a model of water particles in ice and liquid water. Explain what changes in their arrangement and movement. A model represents some features; it is not a photograph of particles.","Ice melts inside a sealed container. What happens to the total mass?",listOf("It increases","It decreases","It stays the same"),2,"The sealed system retains its matter. Melting changes the state, not the total mass."),
        ScienceCard("space-older","A model of the seasons","Earth's axis is tilted. As Earth orbits the Sun, the hemispheres receive different angles and durations of sunlight.","Sketch Earth on opposite sides of its orbit with the axis pointing the same way. Explain why summer in one hemisphere coincides with winter in the other.","What is the main reason for Earth's seasons?",listOf("The Sun changes size","Earth's axial tilt as it orbits the Sun","The Moon's shadow"),1,"Axial tilt changes the angle of sunlight and day length across the year. Distance from the Sun is not the main cause.")
    )
}
@Composable fun SciencePage(s:StudioState,p:Palette) {
    var active by rememberSaveable(s.age){mutableStateOf<String?>(null)}
    var selected by rememberSaveable(active){mutableStateOf<Int?>(null)}
    var checked by rememberSaveable(active){mutableStateOf(false)}
    PageTitle("Stay curious","Science explorer","Look closely. Ask a question. Try an idea. Ages ${s.band}.")
    val cards=scienceCards(s.age);val card=cards.find{it.id==active}
    if(card==null) {
        Panel(Mint){StudioIcon("science",Modifier.size(100.dp));Text("The world is your laboratory",style=MaterialTheme.typography.headlineMedium);Text("Three starter investigations. Bring a notebook and a curious mind.")}
        cards.forEach{c->Panel(if(c.id.startsWith("plants"))Mint else if(c.id.startsWith("space"))Lilac else Butter){Text(c.title,style=MaterialTheme.typography.titleLarge);Text(c.intro);Button(onClick={active=c.id}){Text(if(c.id in s.scienceDone)"Explore again →" else "Let's investigate →")};if(c.id in s.scienceDone)Text("Explored on this device",style=MaterialTheme.typography.labelMedium)}}
    } else {
        TextButton(onClick={active=null}){Text("← All investigations")}
        Panel(Mint){Text(card.title,style=MaterialTheme.typography.headlineMedium);Text(card.intro)}
        Panel(Butter){Text("Try this",style=MaterialTheme.typography.titleLarge);Text(card.activity)}
        Text("Think about it",style=MaterialTheme.typography.titleLarge);Text(card.question)
        card.answers.forEachIndexed{i,a->OutlinedButton(onClick={selected=i},enabled=!checked,modifier=Modifier.fillMaxWidth()){Text((if(selected==i)"●  " else "○  ")+a)}}
        if(!checked) Button(onClick={checked=true},enabled=selected!=null){Text("Check my thinking")}
        else Panel(if(selected==card.correct)Mint else Rose){Text(if(selected==card.correct)"That's it!" else "Let's look again",style=MaterialTheme.typography.titleLarge);Text(card.explanation);Button(onClick={s.finishScience(card.id);active=null}){Text("Finish investigation")}}
    }
    Text("Starter activities, not a complete science curriculum. Your exploration history stays on this device.",style=MaterialTheme.typography.bodySmall)
}

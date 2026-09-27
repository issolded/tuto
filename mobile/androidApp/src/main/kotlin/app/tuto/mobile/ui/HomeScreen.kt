package app.tuto.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.tuto.mobile.TutoViewModel
import app.tuto.mobile.data.Child
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.data.Strings
import app.tuto.mobile.data.Today
import java.util.Calendar

// The web home's order: the scored, paying activities first (ChildHome QUEST_ORDER). Today's
// three cards are the first three the parent has switched on; the rest sit in the row below.
private val QUEST_ORDER = listOf("math", "reading", "puzzle", "writing", "drawing", "homework")
private const val QUEST_TARGET = 3

private fun colorFor(type: String) = when (type) {
    "math" -> TaskColor.math; "reading" -> TaskColor.reading; "puzzle" -> TaskColor.puzzle
    "writing" -> TaskColor.writing; "drawing" -> TaskColor.drawing; "homework" -> TaskColor.homework
    else -> TaskColor.tree
}

/** Which animated icon a card uses; the rest have a still drawing until they get their own. */
private fun lottieFor(type: String) = when (type) { "math" -> "math"; "reading" -> "book"; "puzzle" -> "puzzle"; else -> null }

@Composable
fun HomeScreen(vm: TutoViewModel) {
    val s = LocalStrings.current
    val child = vm.child ?: return
    val today = vm.today
    LaunchedEffect(child.id) { vm.refreshToday() }

    val active = QUEST_ORDER.filter { child.active(it) }
    val questTypes = active.take(3)
    val nextType = questTypes.firstOrNull { !today.done(it) }
    val doneCount = today.activities.values.sum().coerceAtMost(QUEST_TARGET)

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 900.dp
        Row(Modifier.fillMaxSize()) {
            Rail(vm, s)
            Column(
                Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()).padding(horizontal = 30.dp, vertical = 26.dp),
                verticalArrangement = Arrangement.spacedBy(22.dp),
            ) {
                Header(child, today, s, vm.todayLoaded)
                if (vm.todayError && !vm.todayLoaded) {
                    Text(s.say("Can't reach Tuto right now. Your activities still work.", "Şu an Tuto'ya ulaşamıyorum. Etkinliklerin yine de çalışır.", "Ahora no puedo conectar con Tuto. Tus actividades siguen funcionando."),
                        style = MaterialTheme.typography.bodyMedium, color = Ink.soft)
                }
                if (wide) {
                    Row(Modifier.fillMaxWidth().height(380.dp), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                        BuddyCard(s, child, doneCount, nextType, Modifier.width(400.dp).fillMaxHeight())
                        Row(Modifier.weight(1f).fillMaxHeight(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                            questTypes.forEach { t -> QuestCard(t, child, today, t == nextType, s, Modifier.weight(1f).fillMaxHeight()) { vm.open(t) } }
                        }
                    }
                } else {
                    BuddyCard(s, child, doneCount, nextType, Modifier.fillMaxWidth().height(340.dp))
                    Row(Modifier.fillMaxWidth().height(330.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        questTypes.forEach { t -> QuestCard(t, child, today, t == nextType, s, Modifier.weight(1f).fillMaxHeight()) { vm.open(t) } }
                    }
                }
                Text(s.say("What else would you like to do?", "Başka ne yapmak istersin?", "¿Qué más quieres hacer?"), style = MaterialTheme.typography.titleLarge)
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                    (active.drop(3) + "tree").forEach { t -> SmallCard(t, child, today, s) { vm.open(t) } }
                    GoalCard(today, s) { vm.open("goals") }
                }
            }
        }
    }
}

@Composable
private fun Rail(vm: TutoViewModel, s: Strings) {
    val pal = LocalPalette.current
    Column(
        Modifier.width(104.dp).fillMaxHeight().background(Color.White).padding(horizontal = 12.dp, vertical = 26.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        RailItem(s("nav_home"), true, pal.soft) {}
        RailItem(s("nav_gems"), false, pal.soft) { vm.open("gems") }
        Spacer(Modifier.weight(1f))
        RailItem(s.say("Switch", "Değiştir", "Cambiar"), false, pal.soft) { vm.signOut() }
    }
}

@Composable
private fun RailItem(label: String, selected: Boolean, soft: Color, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().height(74.dp).clip(RoundedCornerShape(22.dp)).background(if (selected) soft else Color.Transparent)
            .clickable(role = Role.Tab, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = if (selected) Ink.main else Ink.soft, textAlign = TextAlign.Center, maxLines = 2) }
}

@Composable
private fun Header(child: Child, today: Today, s: Strings, loaded: Boolean) {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    // The greeting follows the device's clock, as on the web.
    val greeting = s(if (hour < 12) "greeting_morning" else if (hour < 18) "greeting_afternoon" else "greeting_evening")
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f)) {
            Text(greeting, style = MaterialTheme.typography.bodyLarge, color = Ink.soft)
            Text(child.name, style = MaterialTheme.typography.headlineLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (today.streak > 0) {
            Row(
                Modifier.height(52.dp).clip(RoundedCornerShape(999.dp)).background(Color.White).padding(horizontal = 18.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FlameIcon(Modifier.size(width = 20.dp, height = 22.dp))
                Text(s.fill("streak_days", "n" to today.streak), fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
            }
        }
        GemPill(if (loaded) today.gems else null)
    }
}

@Composable
private fun BuddyCard(s: Strings, child: Child, doneCount: Int, nextType: String?, modifier: Modifier) {
    val pal = LocalPalette.current
    val speaker = rememberSpeaker()
    val line = when {
        doneCount >= QUEST_TARGET -> s("home_quest_done")
        nextType != null -> s.fill("home_quest_next", "task" to s("task_$nextType"))
        else -> s("home_quest_title")
    }
    Box(modifier.clip(RoundedCornerShape(32.dp)).background(pal.soft)) {
        Row(
            Modifier.align(Alignment.TopStart).padding(22.dp).fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Color.White).padding(start = 18.dp, top = 12.dp, bottom = 12.dp, end = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(line, fontFamily = Baloo, fontWeight = FontWeight.Bold, fontSize = 21.sp, lineHeight = 25.sp, modifier = Modifier.weight(1f))
            ListenButton(line, child.language, speaker, s.say("Listen", "Dinle", "Escuchar"), pal.soft)
        }
        Tuto(Modifier.align(Alignment.BottomStart).padding(start = 6.dp).size(width = 200.dp, height = 254.dp))
        Column(Modifier.align(Alignment.BottomEnd).padding(22.dp), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(s("home_quest_tag"), style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(QUEST_TARGET) { i ->
                    val done = i < doneCount
                    Box(
                        Modifier.size(42.dp).clip(CircleShape).background(if (done) Ink.green else Color.White)
                            .border(3.dp, if (done) Color.White else Ink.main.copy(alpha = .5f), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) { if (done) CheckIcon(Modifier.size(18.dp)) }
                }
            }
        }
    }
}

@Composable
private fun QuestCard(type: String, child: Child, today: Today, isNext: Boolean, s: Strings, modifier: Modifier, onClick: () -> Unit) {
    val pal = LocalPalette.current
    val done = today.done(type)
    val gems = child.gemsFor(type)
    Column(
        modifier.let { if (isNext) it.border(4.dp, pal.accent, Card) else it }.card().clickable(role = Role.Button, onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().height(180.dp).background(colorFor(type)), contentAlignment = Alignment.Center) {
            val file = lottieFor(type)
            if (file != null) TaskIcon(file, if (done) IconState.Done else if (isNext) IconState.Next else IconState.Idle, Modifier.fillMaxSize().padding(12.dp))
            else ActivityGlyph(type, Modifier.size(84.dp))
            if (done && file == null) Box(Modifier.align(Alignment.TopEnd).padding(14.dp).size(40.dp).clip(CircleShape).background(Ink.green), contentAlignment = Alignment.Center) { CheckIcon(Modifier.size(18.dp)) }
        }
        Column(Modifier.padding(16.dp).weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(s("task_$type"), style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (gems != null) Text("+$gems Gem", style = MaterialTheme.typography.bodySmall, color = Ink.soft)
            Spacer(Modifier.weight(1f))
            when {
                done -> Text(s.say("Done today", "Bugün bitti", "Hecho hoy"), style = MaterialTheme.typography.bodyMedium, color = Color(0xFF2F8F55))
                isNext -> Box(Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(18.dp)).background(pal.accent), contentAlignment = Alignment.Center) {
                    Text(s.say("Start", "Başla", "Empezar"), fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                }
                else -> Text(s.say("Later", "Sonra", "Después"), style = MaterialTheme.typography.bodyMedium, color = Ink.soft)
            }
        }
    }
}

@Composable
private fun SmallCard(type: String, child: Child, today: Today, s: Strings, onClick: () -> Unit) {
    val sub = when (type) {
        "tree" -> "${today.treeToday} ${s("tree_leaves_today")}"
        else -> child.gemsFor(type)?.let { "+$it Gem" } ?: ""
    }
    Column(Modifier.width(172.dp).height(196.dp).card().clickable(role = Role.Button, onClick = onClick)) {
        Box(Modifier.fillMaxWidth().height(118.dp).background(colorFor(type)), contentAlignment = Alignment.Center) {
            val file = lottieFor(type)
            if (file != null) TaskIcon(file, if (today.done(type)) IconState.Done else IconState.Idle, Modifier.fillMaxSize().padding(8.dp))
            else ActivityGlyph(type, Modifier.size(64.dp))
        }
        Text(s("task_$type"), style = MaterialTheme.typography.titleLarge.copy(fontSize = 19.sp), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp))
        Text(sub, style = MaterialTheme.typography.bodySmall, color = Ink.soft, modifier = Modifier.padding(horizontal = 16.dp))
    }
}

@Composable
private fun GoalCard(today: Today, s: Strings, onClick: () -> Unit) {
    val goal = today.nearestGoal
    Row(
        Modifier.width(300.dp).height(196.dp).card(Ink.main).clickable(role = Role.Button, onClick = onClick).padding(20.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Jar(fill = if (goal != null && goal.cost > 0) (today.gems.toFloat() / goal.cost).coerceIn(0f, 1f) else 0f, modifier = Modifier.size(width = 70.dp, height = 96.dp))
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(s("home_goal").uppercase(), fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFD9CDE8))
            if (goal != null) {
                Text("${goal.icon} ${goal.name}", fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp, lineHeight = 24.sp, color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text("${today.gems} / ${goal.cost} Gem", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFD9CDE8))
            } else {
                Text(s(if (today.hasAnyGoals) "home_goals_all_done" else "home_no_goals"), fontSize = 15.sp, lineHeight = 19.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

/** The Gem jar: fills as the Gems approach the nearest goal. */
@Composable
fun Jar(fill: Float, modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        drawRoundRect(Color(0xFFC9853E), topLeft = Offset(w * .25f, 0f), size = androidx.compose.ui.geometry.Size(w * .5f, h * .12f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(6f))
        val body = androidx.compose.ui.geometry.RoundRect(0f, h * .14f, w, h, androidx.compose.ui.geometry.CornerRadius(w * .22f))
        val clip = Path().apply { addRoundRect(body) }
        drawPath(clip, Color(0xFF3A2B52))
        val top = h * .14f + (h * .86f) * (1f - fill)
        clipPath(clip) { drawRect(Ink.jar, topLeft = Offset(0f, top), size = androidx.compose.ui.geometry.Size(w, h - top)) }
        drawPath(clip, Color.White, style = Stroke(width = 5f))
    }
}

/** Still drawings for the activities that have no animation yet. */
@Composable
fun ActivityGlyph(type: String, modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        val ink = Stroke(width = w * .06f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        when (type) {
            "writing" -> {
                val p = Path().apply { moveTo(w * .2f, h * .8f); lineTo(w * .28f, h * .58f); lineTo(w * .68f, h * .18f); lineTo(w * .82f, h * .32f); lineTo(w * .42f, h * .72f); close() }
                drawPath(p, Color.White); drawPath(p, Ink.main, style = ink)
                drawLine(Ink.main, Offset(w * .14f, h * .9f), Offset(w * .86f, h * .9f), ink.width, StrokeCap.Round)
            }
            "drawing" -> {
                drawCircle(Color.White, w * .4f, Offset(w * .5f, h * .5f)); drawCircle(Ink.main, w * .4f, Offset(w * .5f, h * .5f), style = ink)
                drawCircle(Color(0xFFFF5D8F), w * .07f, Offset(w * .34f, h * .42f)); drawCircle(TaskColor.math, w * .07f, Offset(w * .5f, h * .3f)); drawCircle(Ink.green, w * .07f, Offset(w * .66f, h * .38f))
            }
            "homework" -> {
                drawRoundRect(Color.White, topLeft = Offset(w * .2f, h * .14f), size = androidx.compose.ui.geometry.Size(w * .6f, h * .76f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(w * .08f))
                drawRoundRect(Ink.main, topLeft = Offset(w * .2f, h * .14f), size = androidx.compose.ui.geometry.Size(w * .6f, h * .76f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(w * .08f), style = ink)
                drawLine(Ink.main, Offset(w * .32f, h * .4f), Offset(w * .68f, h * .4f), ink.width, StrokeCap.Round)
                drawLine(Ink.main, Offset(w * .32f, h * .58f), Offset(w * .58f, h * .58f), ink.width, StrokeCap.Round)
            }
            else -> { // tree
                drawLine(Color(0xFF8A5A2B), Offset(w * .5f, h * .92f), Offset(w * .5f, h * .5f), w * .08f, StrokeCap.Round)
                drawCircle(Color.White, w * .24f, Offset(w * .5f, h * .34f)); drawCircle(Ink.main, w * .24f, Offset(w * .5f, h * .34f), style = ink)
                drawCircle(Color.White, w * .16f, Offset(w * .26f, h * .52f)); drawCircle(Ink.main, w * .16f, Offset(w * .26f, h * .52f), style = ink)
                drawCircle(Color.White, w * .16f, Offset(w * .74f, h * .52f)); drawCircle(Ink.main, w * .16f, Offset(w * .74f, h * .52f), style = ink)
            }
        }
    }
}

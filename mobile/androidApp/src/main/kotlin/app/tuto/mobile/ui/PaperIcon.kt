package app.tuto.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.*
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate

/** One two-tone illustration family for cards and navigation. */
@Composable fun PaperIcon(type: String, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w=size.width; val h=size.height
        val blue=TaskColor.math; val orange=Color(0xFFE9955E); val sage=TaskColor.puzzle
        fun polygon(points: List<Pair<Float,Float>>, c: Color) { drawPath(Path().apply { points.forEachIndexed { i,p -> if(i==0) moveTo(p.first*w,p.second*h) else lineTo(p.first*w,p.second*h) }; close() },c) }
        when(type) {
            "math" -> {
                rotate(-15f) { drawRoundRect(orange,Offset(w*.1f,h*.12f),Size(w*.8f,h*.24f),CornerRadius(w*.03f)); repeat(6) { val x=w*(.2f+it*.11f);drawLine(Ink.main,Offset(x,h*.12f),Offset(x,h*.23f),w*.015f) } }
                drawRoundRect(blue,Offset(w*.18f,h*.48f),Size(w*.32f,h*.37f),CornerRadius(w*.05f))
                drawRoundRect(sage,Offset(w*.57f,h*.43f),Size(w*.29f,h*.38f),CornerRadius(w*.05f))
                drawLine(Color.White,Offset(w*.27f,h*.66f),Offset(w*.42f,h*.66f),w*.035f,StrokeCap.Round)
                drawLine(Color.White,Offset(w*.345f,h*.58f),Offset(w*.345f,h*.74f),w*.035f,StrokeCap.Round)
            }
            "puzzle" -> { polygon(listOf(.08f to .83f,.46f to .42f,.46f to .83f),orange);polygon(listOf(.48f to .83f,.9f to .83f,.69f to .61f),Color(0xFFE6BA66));polygon(listOf(.48f to .14f,.48f to .58f,.84f to .58f),blue);polygon(listOf(.86f to .27f,.65f to .51f,.86f to .51f),sage) }
            "reading", "english", "library" -> {
                polygon(listOf(.08f to .18f,.5f to .24f,.5f to .9f,.08f to .82f),blue);polygon(listOf(.5f to .24f,.92f to .18f,.92f to .82f,.5f to .9f),blue)
                polygon(listOf(.13f to .13f,.48f to .2f,.48f to .8f,.13f to .73f),Color(0xFFFFF0D5));polygon(listOf(.52f to .2f,.87f to .13f,.87f to .73f,.52f to .8f),Color(0xFFFFF0D5))
                repeat(3) { val y=h*(.33f+it*.14f);drawLine(orange.copy(alpha=.5f),Offset(w*.2f,y),Offset(w*.4f,y+h*.035f),w*.018f);drawLine(orange.copy(alpha=.5f),Offset(w*.6f,y+h*.035f),Offset(w*.8f,y),w*.018f) }
            }
            "writing", "drawing" -> rotate(38f) { drawRoundRect(Color(0xFFE6BA66),Offset(w*.38f,h*.16f),Size(w*.24f,h*.6f),CornerRadius(w*.025f));drawRect(orange,Offset(w*.38f,h*.12f),Size(w*.24f,h*.12f));polygon(listOf(.38f to .76f,.62f to .76f,.5f to .94f),Ink.main) }
            "home" -> { drawRoundRect(Color(0xFFF7E5C4),Offset(w*.23f,h*.43f),Size(w*.56f,h*.46f),CornerRadius(w*.04f));polygon(listOf(.1f to .47f,.5f to .1f,.9f to .47f,.8f to .56f,.5f to .3f,.2f to .56f),orange);drawRoundRect(Ink.main,Offset(w*.42f,h*.62f),Size(w*.18f,h*.27f),CornerRadius(w*.06f)) }
            "goals" -> { drawRoundRect(blue,Offset(w*.15f,h*.37f),Size(w*.7f,h*.53f),CornerRadius(w*.04f));drawRect(orange,Offset(w*.45f,h*.3f),Size(w*.1f,h*.6f));drawOval(orange,Offset(w*.25f,h*.12f),Size(w*.25f,h*.2f),style=Stroke(w*.06f));drawOval(orange,Offset(w*.5f,h*.12f),Size(w*.25f,h*.2f),style=Stroke(w*.06f)) }
            else -> repeat(2) { val y=h*(.32f+it*.36f);drawLine(Ink.main,Offset(w*.12f,y),Offset(w*.88f,y),w*.07f,StrokeCap.Round);drawCircle(sage,w*.12f,Offset(w*(if(it==0).35f else .65f),y)) }
        }
    }
}

@Composable fun AnimatedPaperIcon(type: String, selected: Boolean, modifier: Modifier = Modifier) {
    val scale = remember { Animatable(1f) }
    val still = reduceMotion()
    LaunchedEffect(selected) {
        if(selected && !still) { scale.snapTo(.9f); scale.animateTo(1.16f, tween(150)); scale.animateTo(1f, tween(230)) }
    }
    PaperIcon(type, modifier.graphicsLayer { scaleX=scale.value; scaleY=scale.value; rotationZ=if(type=="puzzle") (scale.value-1f)*100f else if(type=="english") (scale.value-1f)*-40f else 0f })
}

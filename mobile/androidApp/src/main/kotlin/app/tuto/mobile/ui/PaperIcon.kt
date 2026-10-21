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
    NotebookArt(notebookIcon(type),modifier)
}

@Composable fun AnimatedPaperIcon(type: String, selected: Boolean, modifier: Modifier = Modifier) {
    val scale = remember { Animatable(1f) }
    val still = reduceMotion()
    LaunchedEffect(selected) {
        if(selected && !still) { scale.snapTo(.9f); scale.animateTo(1.16f, tween(150)); scale.animateTo(1f, tween(230)) }
    }
    PaperIcon(type, modifier.graphicsLayer { scaleX=scale.value; scaleY=scale.value; rotationZ=if(type=="puzzle") (scale.value-1f)*100f else if(type=="english") (scale.value-1f)*-40f else 0f })
}

/** Quiet, staggered motion, stopped outside the resumed screen and for reduced motion. */
@Composable fun AnimatedSubjectIcon(type:String,modifier:Modifier=Modifier) {
 val motion=remember{Animatable(0f)};val still=reduceMotion()
 val owner=androidx.lifecycle.compose.LocalLifecycleOwner.current
 var active by remember{mutableStateOf(owner.lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED))}
 DisposableEffect(owner){val observer=androidx.lifecycle.LifecycleEventObserver{_,_->active=owner.lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED)};owner.lifecycle.addObserver(observer);onDispose{owner.lifecycle.removeObserver(observer)}}
 LaunchedEffect(type,still,active){motion.snapTo(0f);if(active&&!still){kotlinx.coroutines.delay(500L+type.length*170L);while(true){motion.animateTo(1f,tween(450));motion.animateTo(-.4f,tween(350));motion.animateTo(0f,tween(300));kotlinx.coroutines.delay(5200)}}}
 PaperIcon(type,modifier.graphicsLayer{rotationZ=motion.value*(if(type=="math")4f else if(type=="english")-3f else 2f);translationY=-kotlin.math.abs(motion.value)*size.height*.025f;scaleX=1+motion.value*.018f;scaleY=scaleX})
}

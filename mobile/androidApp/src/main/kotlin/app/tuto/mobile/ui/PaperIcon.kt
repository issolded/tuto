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

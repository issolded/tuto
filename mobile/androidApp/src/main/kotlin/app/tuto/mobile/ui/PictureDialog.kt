package app.tuto.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.tuto.mobile.data.LocalStrings

@Composable fun PictureDialog(onClose: () -> Unit, content: @Composable () -> Unit) {
    val s = LocalStrings.current
    var zoom by remember { mutableFloatStateOf(1f) }
    var pan by remember { mutableStateOf(Offset.Zero) }
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(LocalPalette.current.bg).safeDrawingPadding().padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onClose) { Text(s.say("Close", "Kapat", "Cerrar")) }
                TextButton(onClick = { zoom = (zoom - .5f).coerceAtLeast(1f); pan = Offset.Zero }) { Text("−") }
                TextButton(onClick = { zoom = (zoom + .5f).coerceAtMost(4f) }) { Text("+") }
                TextButton(onClick = { zoom = 1f; pan = Offset.Zero }) { Text(s.say("Reset", "Sıfırla", "Restablecer")) }
            }
            Box(Modifier.fillMaxWidth().weight(1f).clipToBounds().background(Color.White).pointerInput(Unit) {
                detectTransformGestures { _, p, z, _ ->
                    zoom = (zoom*z).coerceIn(1f,4f)
                    val limitX=size.width*(zoom-1)/2; val limitY=size.height*(zoom-1)/2
                    pan=Offset((pan.x+p.x).coerceIn(-limitX,limitX),(pan.y+p.y).coerceIn(-limitY,limitY))
                }
            }, contentAlignment=Alignment.Center) {
                Box(Modifier.fillMaxSize().graphicsLayer { scaleX=zoom;scaleY=zoom;translationX=pan.x;translationY=pan.y }, contentAlignment=Alignment.Center) { content() }
            }
        }
    }
}

package app.tuto.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

/** Measures the actual app window, including split screen and enlarged accessibility text. */
@Composable
fun AdaptivePair(first: @Composable () -> Unit, second: @Composable () -> Unit) {
    val state = rememberSaveableStateHolder()
    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        val wide = maxWidth / LocalDensity.current.fontScale.coerceAtLeast(1f) >= 840.dp
        val padding = if (maxWidth < 600.dp) 20.dp else 32.dp
        val content = Modifier.widthIn(max = 1200.dp).fillMaxWidth()
            .verticalScroll(rememberScrollState()).padding(padding)
        if (wide) {
            Row(content.testTag("adaptive-wide"), horizontalArrangement = Arrangement.spacedBy(32.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { state.SaveableStateProvider("first") { first() } }
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { state.SaveableStateProvider("second") { second() } }
            }
        } else {
            Column(content.testTag("adaptive-stacked"), verticalArrangement = Arrangement.spacedBy(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                state.SaveableStateProvider("first") { first() }
                state.SaveableStateProvider("second") { second() }
            }
        }
    }
}

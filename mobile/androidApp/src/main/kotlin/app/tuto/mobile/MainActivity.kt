package app.tuto.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.ui.GoalsScreen
import app.tuto.mobile.ui.HomeScreen
import app.tuto.mobile.ui.LocalPalette
import app.tuto.mobile.ui.MathScreen
import app.tuto.mobile.ui.PinScreen
import app.tuto.mobile.ui.PuzzleScreen
import app.tuto.mobile.ui.SetupScreen
import app.tuto.mobile.ui.SoonScreen
import app.tuto.mobile.ui.Sunlight
import app.tuto.mobile.ui.TutoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { TutoTheme { TutoApp() } }
    }
}

@Composable
fun TutoApp(vm: TutoViewModel = viewModel()) {
    val palette = Sunlight
    CompositionLocalProvider(LocalStrings provides vm.strings, LocalPalette provides palette) {
        Box(Modifier.fillMaxSize().background(palette.bg).safeDrawingPadding()) {
            when (val s = vm.screen) {
                Screen.Setup -> SetupScreen(vm)
                Screen.Pin -> PinScreen(vm)
                Screen.Home -> HomeScreen(vm)
                Screen.Math -> MathScreen(vm)
                Screen.Goals -> GoalsScreen(vm)
                Screen.Puzzle -> PuzzleScreen(vm)
                is Screen.Soon -> SoonScreen(vm, s.type)
            }
        }
        // Back always leads home from an activity; from home it leaves the app as usual.
        BackHandler(enabled = vm.screen is Screen.Math || vm.screen is Screen.Soon || vm.screen is Screen.Goals || vm.screen is Screen.Puzzle) { vm.home() }
    }
}

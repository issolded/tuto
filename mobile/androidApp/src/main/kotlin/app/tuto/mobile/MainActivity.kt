package app.tuto.mobile

import android.os.Bundle
import android.content.Intent
import androidx.lifecycle.ViewModelProvider
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
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
import app.tuto.mobile.ui.BottomNavigation
import app.tuto.mobile.ui.SettingsScreen
import app.tuto.mobile.ui.EnglishScreen
import app.tuto.mobile.ui.BooksScreen
import app.tuto.mobile.ui.ActivitiesScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        acceptOAuth(intent)
        setContent { TutoTheme { TutoApp() } }
    }
    override fun onNewIntent(intent:Intent) {super.onNewIntent(intent);setIntent(intent);acceptOAuth(intent)}
    private fun acceptOAuth(source:Intent?) {source?.data?.toString()?.let { ViewModelProvider(this)[TutoViewModel::class.java].parentOAuthCallback(it) };source?.data=null}
}

@Composable
fun TutoApp(vm: TutoViewModel = viewModel()) {
    val palette = Sunlight
    CompositionLocalProvider(LocalStrings provides vm.strings, LocalPalette provides palette) {
        Box(Modifier.fillMaxSize().background(palette.bg).safeDrawingPadding()) {
            Scaffold(containerColor = palette.bg, bottomBar = {
                if (vm.screen == Screen.Home || vm.screen == Screen.Goals || vm.screen == Screen.Settings) BottomNavigation(vm)
            }) { padding -> Box(Modifier.fillMaxSize().padding(padding)) {
            when (val s = vm.screen) {
                Screen.Setup -> SetupScreen(vm)
                Screen.Pin -> PinScreen(vm)
                Screen.Home -> HomeScreen(vm)
                Screen.Math -> MathScreen(vm)
                Screen.Goals -> GoalsScreen(vm)
                Screen.Settings -> SettingsScreen(vm)
                Screen.Puzzle -> PuzzleScreen(vm)
                Screen.English -> EnglishScreen(vm)
                Screen.Parent -> app.tuto.mobile.ui.ParentScreen(vm)
                is Screen.Content -> if (s.type in setOf("reading", "writing", "library")) BooksScreen(vm) else ActivitiesScreen(vm, s.type)
                is Screen.Soon -> SoonScreen(vm, s.type)
            }
            } }
        }
        // Back always leads home from an activity; from home it leaves the app as usual.
        BackHandler(enabled = vm.screen is Screen.Math || vm.screen is Screen.Soon || vm.screen is Screen.Goals || vm.screen is Screen.Puzzle || vm.screen == Screen.Settings || vm.screen == Screen.English || vm.screen is Screen.Content || vm.screen == Screen.Parent) { vm.home() }
    }
}

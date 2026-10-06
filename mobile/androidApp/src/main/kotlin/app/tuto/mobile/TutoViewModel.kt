package app.tuto.mobile

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.tuto.mobile.data.Child
import app.tuto.mobile.data.HttpTutoApi
import app.tuto.mobile.data.MathEngine
import app.tuto.mobile.data.Session
import app.tuto.mobile.data.Strings
import app.tuto.mobile.data.Today
import app.tuto.mobile.data.TutoApi
import kotlinx.coroutines.launch
import java.util.Locale

/** Where the device test swaps in a fake server. Production always uses the real one. */
object Services {
    var api: TutoApi = HttpTutoApi()
    /** The sitting on screen, for the device test to read the expected answers from. */
    @Volatile var currentMath: MathRun? = null
    @Volatile var currentPuzzle: PuzzleRun? = null
}

sealed interface Screen {
    data object Setup : Screen
    data object Pin : Screen
    data object Home : Screen
    data object Math : Screen
    data object Goals : Screen
    data object Settings : Screen
    data object Puzzle : Screen
    /** An activity the tablet does not do natively yet; says so rather than pretending. */
    data class Soon(val type: String) : Screen
}

class TutoViewModel(app: Application) : AndroidViewModel(app) {
    val session = Session(app)
    val engine = MathEngine(app)
    val api: TutoApi get() = Services.api

    private val deviceLang = Locale.getDefault().language.let { if (it in setOf("tr", "es")) it else "en" }
    private val table = Strings.load(app, deviceLang)

    var child by mutableStateOf(session.child)
        private set
    /** Before sign-in there is no child, so the words follow the device. After, children.language. */
    val strings: Strings get() = table.withLang(child?.language ?: deviceLang)

    var screen by mutableStateOf<Screen>(
        when {
            session.familyCode == null -> Screen.Setup
            session.child == null -> Screen.Pin
            else -> Screen.Home
        },
    )

    var today by mutableStateOf(Today.EMPTY)
        private set
    var todayLoaded by mutableStateOf(false)
        private set
    var todayError by mutableStateOf(false)
        private set

    fun joinFamily(code: String) {
        session.familyCode = code
        screen = Screen.Pin
    }

    fun signedIn(c: Child) {
        session.child = c
        child = c
        today = Today.EMPTY
        todayLoaded = false
        screen = Screen.Home
        refreshToday()
    }

    fun signOut() {
        session.signOut()
        child = null
        today = Today.EMPTY
        todayLoaded = false
        todayError = false
        screen = Screen.Pin
    }

    fun leaveFamily() {
        session.signOut()
        session.familyCode = null
        child = null
        screen = Screen.Setup
    }

    fun refreshToday() {
        val c = child ?: return
        viewModelScope.launch {
            runCatching { api.todaySummary(c.id) }
                .onSuccess { if (child?.id == c.id) { today = it; todayLoaded = true; todayError = false } }
                .onFailure { if (child?.id == c.id) todayError = true }
        }
    }

    /** The maths sitting in progress; kept here so it survives a rotation. */
    var math by mutableStateOf<MathRun?>(null)
        private set

    fun open(type: String) {
        if (type == "math") {
            math = newMathRun()
            screen = Screen.Math
        } else if (type == "puzzle") {
            puzzle = newPuzzleRun()
            screen = Screen.Puzzle
        } else if (type == "goals" || type == "gems") {
            screen = Screen.Goals
        } else if (type == "settings") {
            screen = Screen.Settings
        } else {
            screen = Screen.Soon(type)
        }
    }

    fun openMathAgain() { math = newMathRun() }

    /** The puzzle sitting in progress. */
    var puzzle by mutableStateOf<PuzzleRun?>(null)
        private set

    fun openPuzzleAgain() { puzzle = newPuzzleRun() }

    private fun newPuzzleRun() = child?.let { PuzzleRun(viewModelScope, api, engine, it) }?.also { Services.currentPuzzle = it }

    private fun newMathRun() = child?.let { MathRun(viewModelScope, api, engine, session, it) }?.also { Services.currentMath = it }

    fun home() {
        if (screen == Screen.Puzzle && puzzle?.reviewToClose != null) {
            puzzle?.declineThen { home() }
            return
        }
        screen = Screen.Home
        refreshToday()
    }
}

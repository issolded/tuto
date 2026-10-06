package app.tuto.mobile

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import app.tuto.mobile.data.LocalStrings
import app.tuto.mobile.data.Strings
import app.tuto.mobile.ui.ExtendedMathHelp
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test

class MathHelpTest {
    @get:Rule val compose=createComposeRule()
    private fun show(json:String) { compose.setContent { CompositionLocalProvider(LocalStrings provides Strings(JSONObject(),"en")) { MaterialTheme { Column { ExtendedMathHelp(JSONObject(json)) } } } } }
    @Test fun workedStepsCheckBeforeAdvancingAndSupportSignedDecimals() {
        show("""{"kind":"steps","steps":[{"say":"First step","q":"1 − 2.5","a":-1.5},{"say":"Second step","q":"2 + 3","a":5}]}""")
        compose.onNodeWithTag("help-step-input").performTextInput("0")
        compose.onNodeWithTag("help-step-check").performClick()
        compose.onNodeWithText("Second step").assertDoesNotExist()
        compose.onNodeWithTag("help-step-input").performTextReplacement("-1.5")
        compose.onNodeWithTag("help-step-check").performClick()
        compose.onNodeWithText("Second step").assertIsDisplayed()
        compose.onNodeWithTag("help-step-input").performTextInput("5")
        compose.onNodeWithTag("help-step-check").performClick()
        compose.onNodeWithText("Now answer the question above.").assertIsDisplayed()
    }
    @Test fun halfPictogramCountsHalfTheKey() {
        show("""{"kind":"pictogram","unit":"star","each":4,"rows":[{"label":"A","count":1.5}]}""")
        compose.onNodeWithText("star").performClick()
        compose.onNodeWithText("4").assertIsDisplayed()
        compose.onNodeWithText("½ star").performClick()
        compose.onNodeWithText("6").assertIsDisplayed()
    }
}

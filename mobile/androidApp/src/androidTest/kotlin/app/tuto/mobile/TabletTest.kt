package app.tuto.mobile

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.junit.Rule
import org.junit.Test

class TabletTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun themesKeepTheSameWalletAndHome() {
        compose.onNodeWithText("✦  Stilim").performClick()
        compose.onNodeWithText("Klasik").performClick()
        compose.onNodeWithText("← Ana sayfa").performClick()
        compose.onNodeWithText("◆ 0").assertIsDisplayed()
        compose.onNodeWithText("✦  Stilim").performClick()
        compose.onNodeWithText("Morph Studio").performClick()
        compose.onNodeWithText("← Ana sayfa").performClick()
        compose.onNodeWithText("123  Matematik").assertIsDisplayed()
    }
}

package app.tuto.mobile.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.Shapes
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.tuto.mobile.R

// Paper & Play: Outfit headings and Nunito Sans body, including EN/TR/ES glyphs.
// The Baloo alias preserves the existing call sites while applying the new type system.
val Baloo = FontFamily(Font(R.font.outfit_bold, FontWeight.Bold), Font(R.font.outfit_extrabold, FontWeight.ExtraBold))
val Nunito = FontFamily(Font(R.font.nunito_sans_regular, FontWeight.Normal), Font(R.font.nunito_sans_semibold, FontWeight.SemiBold), Font(R.font.nunito_bold, FontWeight.Bold), Font(R.font.nunito_extrabold, FontWeight.ExtraBold))

object Ink {
    val main = Color(0xFF14284B)
    val soft = Color(0xFF52627A)
    val white = Color.White
    val green = Color(0xFF427659)
    val greenSoft = Color(0xFFE6F0E5)
    val wrongSoft = Color(0xFFFFE5DC)
    val lilacSoft = Color(0xFFE9EFF9)
    val jar = Color(0xFF7FD3F7)
}

/** The three simple themes from the design's Tweaks panel. Only the ground and accent change. */
data class TutoPalette(val name: String, val bg: Color, val soft: Color, val accent: Color)

val Sunlight = TutoPalette("sun", Color(0xFFFAF8F3), Color(0xFFE5EDFA), Color(0xFF426FC4))
val Forest = TutoPalette("forest", Color(0xFFEAF6EC), Color(0xFFCFEBD6), Color(0xFF46C07A))
val Sea = TutoPalette("sea", Color(0xFFE8F3FF), Color(0xFFCFE4FF), Color(0xFF62B0FF))

val LocalPalette = staticCompositionLocalOf { Sunlight }

/** Card colours per activity, the same hues as the web tiles. */
object TaskColor {
    val math = Color(0xFF5B83C7)
    val reading = Color(0xFF879B7C)
    val puzzle = Color(0xFF5F927E)
    val writing = Color(0xFFC5876C)
    val drawing = Color(0xFFD5A14F)
    val homework = Color(0xFFFF7A59)
    val tree = Color(0xFF6CC24A)
}

@Composable
fun TutoTheme(content: @Composable () -> Unit) {
    val base = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Normal, color = Ink.main)
    MaterialTheme(
        colorScheme = lightColorScheme(primary = Sunlight.accent, onPrimary = Color.White, background = Sunlight.bg, surface = Color.White, onSurface = Ink.main, onBackground = Ink.main, surfaceVariant = Color(0xFFF1EEE7), onSurfaceVariant = Ink.soft, outline = Color(0xFFCFD5DE), secondary = Color(0xFF5F927E)),
        shapes = Shapes(small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(18.dp), large = RoundedCornerShape(22.dp)),
        typography = Typography(
            bodyLarge = base.copy(fontSize = 18.sp, lineHeight = 26.sp),
            bodyMedium = base.copy(fontSize = 16.sp, lineHeight = 22.sp),
            bodySmall = base.copy(fontSize = 14.sp, lineHeight = 19.sp),
            labelLarge = base.copy(fontSize = 15.sp, fontWeight = FontWeight.ExtraBold),
            titleMedium = base.copy(fontFamily = Baloo, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 25.sp),
            headlineSmall = base.copy(fontFamily = Baloo, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 32.sp),
            labelMedium = base.copy(fontWeight = FontWeight.SemiBold, fontSize = 14.sp),
            titleLarge = base.copy(fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, lineHeight = 26.sp),
            headlineMedium = base.copy(fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 32.sp, lineHeight = 36.sp),
            headlineLarge = base.copy(fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 40.sp, lineHeight = 42.sp),
        ),
        content = content,
    )
}

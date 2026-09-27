package app.tuto.mobile.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
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

// The v3 tablet design (Design canvas, page "v3 · Tablet"). Baloo 2 for headings and Nunito for
// everything else: both carry ğ ş İ ı and the Spanish accents, which Fredoka did not.
val Baloo = FontFamily(Font(R.font.baloo2_bold, FontWeight.Bold), Font(R.font.baloo2_extrabold, FontWeight.ExtraBold))
val Nunito = FontFamily(Font(R.font.nunito_bold, FontWeight.Bold), Font(R.font.nunito_extrabold, FontWeight.ExtraBold))

object Ink {
    val main = Color(0xFF2B1D3A)
    val soft = Color(0xFF6B5F7A)
    val white = Color.White
    val green = Color(0xFF3FBF6F)
    val greenSoft = Color(0xFFDFF5E6)
    val wrongSoft = Color(0xFFFFE5DC)
    val lilacSoft = Color(0xFFF3ECFF)
    val jar = Color(0xFF7FD3F7)
}

/** The three simple themes from the design's Tweaks panel. Only the ground and accent change. */
data class TutoPalette(val name: String, val bg: Color, val soft: Color, val accent: Color)

val Sunlight = TutoPalette("sun", Color(0xFFFFF6E5), Color(0xFFFFE3C2), Color(0xFFFF9A3D))
val Forest = TutoPalette("forest", Color(0xFFEAF6EC), Color(0xFFCFEBD6), Color(0xFF46C07A))
val Sea = TutoPalette("sea", Color(0xFFE8F3FF), Color(0xFFCFE4FF), Color(0xFF62B0FF))

val LocalPalette = staticCompositionLocalOf { Sunlight }

/** Card colours per activity, the same hues as the web tiles. */
object TaskColor {
    val math = Color(0xFF4DA3FF)
    val reading = Color(0xFFA77BFF)
    val puzzle = Color(0xFF22C3A6)
    val writing = Color(0xFFFF8FB1)
    val drawing = Color(0xFFFFB23F)
    val homework = Color(0xFFFF7A59)
    val tree = Color(0xFF6CC24A)
}

@Composable
fun TutoTheme(content: @Composable () -> Unit) {
    val base = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, color = Ink.main)
    MaterialTheme(
        colorScheme = lightColorScheme(primary = Sunlight.accent, onPrimary = Ink.main, background = Sunlight.bg, surface = Color.White, onSurface = Ink.main),
        typography = Typography(
            bodyLarge = base.copy(fontSize = 18.sp, lineHeight = 26.sp),
            bodyMedium = base.copy(fontSize = 16.sp, lineHeight = 22.sp),
            bodySmall = base.copy(fontSize = 14.sp, lineHeight = 19.sp),
            labelLarge = base.copy(fontSize = 15.sp, fontWeight = FontWeight.ExtraBold),
            titleLarge = base.copy(fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, lineHeight = 26.sp),
            headlineMedium = base.copy(fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 32.sp, lineHeight = 36.sp),
            headlineLarge = base.copy(fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 40.sp, lineHeight = 42.sp),
        ),
        content = content,
    )
}

package app.tuto.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.tuto.mobile.data.MathQuestion
import com.caverock.androidsvg.SVG
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.sin

/** The picture a question comes with, or nothing. Same pictures as the browser. */
@Composable
fun QuestionFigure(q: MathQuestion, modifier: Modifier = Modifier) {
    var expanded by androidx.compose.runtime.remember(q) { androidx.compose.runtime.mutableStateOf(false) }
    if (q.svg == null && q.nativeFigure == null) return
    Column(modifier) {
        androidx.compose.material3.TextButton(onClick = { expanded = true }) { Text(app.tuto.mobile.data.LocalStrings.current.say("Enlarge picture", "Görseli büyüt", "Ampliar imagen")) }
        FigureContent(q, Modifier.fillMaxWidth())
    }
    if (expanded) PictureDialog({ expanded = false }) { FigureContent(q, Modifier.fillMaxSize()) }
}

@Composable private fun FigureContent(q: MathQuestion, modifier: Modifier) {
    when {
        q.svg != null -> SvgFigure(q.svg, modifier)
        q.nativeFigure != null && q.visual != null -> NativeFigure(q.nativeFigure, q.visual, modifier)
    }
}

/** An SVG rendered by the web's own figure components inside the engine. */
@Composable
fun SvgFigure(markup: String, modifier: Modifier = Modifier) {
    val prepared = remember(markup) { app.tuto.mobile.data.SvgMarkup.prepare(markup) }
    val svg = remember(prepared) { runCatching { SVG.getFromString(prepared) }.getOrNull() }
    if (svg == null) {
        Text(app.tuto.mobile.data.LocalStrings.current.say("Picture could not load", "Görsel yüklenemedi", "No se pudo cargar la imagen"), modifier = modifier)
        return
    }
    val box = svg.documentViewBox
    val ratio = if (box != null && box.height() > 0f) box.width() / box.height() else 1.6f
    // Render to a software bitmap at the measured physical pixel size. Root CSS dimensions
    // and Picture playback on hardware canvases must not shrink or blank the web SVG.
    androidx.compose.foundation.layout.BoxWithConstraints(modifier.fillMaxWidth().heightIn(max = 480.dp).aspectRatio(ratio)) {
        val density = androidx.compose.ui.platform.LocalDensity.current
        val width = with(density) { maxWidth.roundToPx() }.coerceIn(1, 2400)
        val height = with(density) { maxHeight.roundToPx() }.coerceIn(1, 2400)
        val bitmap = remember(prepared, width, height) {
            android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888).also {
                svg.renderToCanvas(android.graphics.Canvas(it), android.graphics.RectF(0f, 0f, width.toFloat(), height.toFloat()))
            }
        }
        androidx.compose.foundation.Image(bitmap.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Fit)
    }
}

/** The web lays these out as rows of emoji or labelled boxes (HTML), so they are drawn here. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NativeFigure(kind: String, v: JSONObject, modifier: Modifier = Modifier) {
    when (kind) {
        "count" -> FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            repeat(v.optInt("n")) { Text(v.optString("item"), fontSize = 42.sp) }
        }
        "shapes" -> FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally)) {
            val a = v.optJSONArray("shapes")
            for (i in 0 until (a?.length() ?: 0)) ShapeDrawing(a!!.optString(i), Modifier.size(120.dp))
        }
        "pictogram" -> Pictogram(v, modifier)
        "prices" -> FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            val a = v.optJSONArray("items")
            for (i in 0 until (a?.length() ?: 0)) {
                val it = a!!.optJSONObject(i) ?: continue
                Column(Modifier.clip(RoundedCornerShape(16.dp)).background(LocalPalette.current.soft).padding(horizontal = 14.dp, vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(it.optString("icon"), fontSize = 36.sp)
                    Text(it.optString("name"), fontSize = 18.sp, color = Ink.soft)
                    Text(it.optString("price"), fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, color = Ink.main)
                }
            }
        }
        "digital" -> FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally)) {
            val times = v.optJSONArray("times"); val labels = v.optJSONArray("labels")
            for (i in 0 until (times?.length() ?: 0)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.clip(RoundedCornerShape(14.dp)).background(Ink.main).padding(horizontal = 18.dp, vertical = 10.dp)) {
                        Text(times!!.optString(i), fontFamily = Baloo, fontWeight = FontWeight.ExtraBold, fontSize = 36.sp, color = Color(0xFF7CFFB2))
                    }
                    labels?.optString(i)?.takeIf { it.isNotEmpty() }?.let { Text(it, fontSize = 18.sp, color = Ink.soft) }
                }
            }
        }
    }
}

@Composable
private fun Pictogram(v: JSONObject, modifier: Modifier) {
    val unit = v.optString("unit"); val each = v.optInt("each")
    Column(modifier.horizontalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("$unit = $each", fontFamily = Baloo, fontSize = 20.sp, color = Ink.soft,
            modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(LocalPalette.current.soft).padding(horizontal = 12.dp, vertical = 4.dp))
        val rows = v.optJSONArray("rows")
        for (r in 0 until (rows?.length() ?: 0)) {
            val row = rows!!.optJSONObject(r) ?: continue
            val count = row.optDouble("count", 0.0)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(row.optString("label"), fontFamily = Baloo, fontSize = 20.sp, textAlign = TextAlign.End, modifier = Modifier.widthIn(min = 90.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    // A half symbol is the left half of one, clipped, as in a printed pictogram.
                    for (i in 0 until ceil(count).toInt()) {
                        val half = i + 1 > count
                        Box(Modifier.width(if (half) 23.dp else 38.dp).clip(RoundedCornerShape(0.dp))) { Text(unit, fontSize = 34.sp, softWrap = false) }
                    }
                }
            }
        }
    }
}

// MathScreen's shapePoints: squares and rectangles given explicitly, the rest regular and point-up.
private val SIDES = mapOf("triangle" to 3, "square" to 4, "rectangle" to 4, "pentagon" to 5, "hexagon" to 6, "heptagon" to 7, "octagon" to 8)

@Composable
fun ShapeDrawing(kind: String, modifier: Modifier) {
    Canvas(modifier) {
        val c = size.minDimension / 2f; val r = size.minDimension * .36f
        val pts: List<Pair<Float, Float>> = when (kind) {
            "square" -> listOf(-r to -r, r to -r, r to r, -r to r)
            "rectangle" -> listOf(-r * 1.35f to -r * .75f, r * 1.35f to -r * .75f, r * 1.35f to r * .75f, -r * 1.35f to r * .75f)
            else -> {
                val n = SIDES[kind] ?: 4
                (0 until n).map { i -> val a = (2 * PI * i / n - PI / 2); (r * cos(a)).toFloat() to (r * sin(a)).toFloat() }
            }
        }
        val path = Path().apply { pts.forEachIndexed { i, (x, y) -> if (i == 0) moveTo(c + x, c + y) else lineTo(c + x, c + y) }; close() }
        drawPath(path, Color(0xFFEAF3FC))
        drawPath(path, TaskColor.math, style = Stroke(width = 6f, join = StrokeJoin.Round))
    }
}

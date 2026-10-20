package app.tuto.mobile

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.RectF
import androidx.test.platform.app.InstrumentationRegistry
import app.tuto.mobile.data.MathEngine
import app.tuto.mobile.data.SvgMarkup
import com.caverock.androidsvg.SVG
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/** Unlike the JS markup check, this exercises AndroidSVG and checks the actual drawn pixels. */
class SvgPixelsTest {
    @Test fun everyRealPuzzleFigureHasInk() = runBlocking {
        val inst=InstrumentationRegistry.getInstrumentation()
        val sheet=JSONObject(inst.context.assets.open("puzzle-sheet.json").bufferedReader().use { it.readText() }).getJSONArray("questions")
        val specs=mutableListOf<JSONObject?>()
        for(i in 0 until sheet.length()) {
            val q=sheet.getJSONObject(i)
            q.optJSONArray("prompt")?.let { a -> for(j in 0 until a.length()) a.optJSONObject(j)?.let { specs.add(it) } }
            q.getJSONArray("options").let { a -> for(j in 0 until a.length()) a.getJSONObject(j).optJSONObject("spec")?.let { specs.add(it) } }
        }
        val engine=MathEngine(inst.targetContext)
        val drawings=engine.drawPuzzle(specs, 96)
        assertTrue(drawings.size > 40)
        drawings.forEachIndexed { i, markup ->
            assertNotNull("Missing figure $i", markup)
            val bitmap=Bitmap.createBitmap(360,360,Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(Color.WHITE)
            SVG.getFromString(SvgMarkup.prepare(markup!!)).renderToCanvas(Canvas(bitmap),RectF(0f,0f,360f,360f))
            var ink=0
            for(y in 0 until 360 step 2) for(x in 0 until 360 step 2) {
                val c=bitmap.getPixel(x,y)
                if(Color.red(c)<220 || Color.green(c)<220 || Color.blue(c)<220) ink++
            }
            assertTrue("Figure $i has no visible ink: $markup", ink>25)
            bitmap.recycle()
        }
    }
    @Test fun geometryUsesTheWholeNativeViewport() {
        val svg="""<svg viewBox="0 0 320 210" style="display:block;width:100%;max-height:190px"><g stroke="#24465a" stroke-width="3"><polygon points="65,165 245,165 245,45 65,45" fill="#f1f9fb"/><text x="155" y="190" fill="#24465a" font-size="16">17 cm</text></g></svg>"""
        val bitmap=Bitmap.createBitmap(960,630,Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.WHITE)
        SVG.getFromString(SvgMarkup.prepare(svg)).renderToCanvas(Canvas(bitmap),RectF(0f,0f,960f,630f))
        var left=960;var right=0
        for(y in 0 until 630) for(x in 0 until 960) {
            val c=bitmap.getPixel(x,y)
            if(Color.red(c)<140 && Color.green(c)<160 && Color.blue(c)<180) { left=minOf(left,x);right=maxOf(right,x) }
        }
        assertTrue("Diagram is still tiny: width ${right-left}", right-left>520)
        bitmap.recycle()
    }
}

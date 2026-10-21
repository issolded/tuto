package app.tuto.mobile.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalDensity
import com.caverock.androidsvg.SVG

@Composable fun NotebookArt(body:String, modifier:Modifier=Modifier, viewBox:String="0 0 120 120", description:String?=null) {
    BoxWithConstraints(modifier,contentAlignment=Alignment.Center) {
        val density=LocalDensity.current
        val w=with(density){maxWidth.toPx()}.toInt().coerceIn(1,1600)
        val h=with(density){maxHeight.toPx()}.toInt().coerceIn(1,1600)
        val bitmap=remember(body,w,h,viewBox) {
            val svg=SVG.getFromString(if(body.trimStart().startsWith("<svg")) body else """<svg xmlns="http://www.w3.org/2000/svg" viewBox="$viewBox"><g stroke="#202022" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="white">$body</g></svg>""")
            Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888).also { svg.setDocumentWidth(w.toFloat());svg.setDocumentHeight(h.toFloat());svg.renderToCanvas(android.graphics.Canvas(it)) }.asImageBitmap()
        }
        Image(bitmap,description,Modifier.fillMaxSize())
    }
}

@Composable fun NotebookPage(content:@Composable ()->Unit) {
    Box(Modifier.fillMaxSize()) {
        Canvas(Modifier.fillMaxSize()) {
            val unit=1.dp.toPx()
            drawLine(Color(0xFFE3E1DB),Offset(27*unit,0f),Offset(27*unit,size.height),unit)
            var y=24*unit
            while(y<size.height) { drawOval(Color(0xFF272727),Offset(3*unit,y),androidx.compose.ui.geometry.Size(24*unit,10*unit),style=androidx.compose.ui.graphics.drawscope.Stroke(2*unit));y+=48*unit }
        }
        Box(Modifier.fillMaxSize().padding(start=36.dp,end=14.dp)) { content() }
    }
}

internal fun notebookIcon(type:String):String=when(type) {
    "math" -> """<path d="M13 104 14 39l63 65Z"/><path d="M25 89V65l24 24ZM14 52h7m-7 12h6m-6 12h7m-7 12h6m5 16v-6m12 6v-7m12 7v-6m12 6v-7" fill="none" stroke-width="1.7"/><path d="m68 36-19 52m26-50 25 54M60 64q18 9 27 0" fill="none"/><circle cx="70" cy="30" r="9"/><circle cx="70" cy="30" r="3"/><path d="m69 21 1-12m-20 77-4 10m54-3 4 10" fill="none"/>"""
    "english" -> """<path d="M24 21 93 12l12 82-70 10-7-5-10-67q-2-8 6-11Z"/><path d="m31 25 58-8 10 70-58 9ZM24 21l12 77m-8 1 8-1m-9 5 9 1" fill="none" stroke-width="2"/><path d="m48 47 5-17 9 15m-12-5 9-1M58 54l2 18q17-1 10-10 7-8-12-8Zm2 9 8-1M81 76q-16-6-12 9 4 8 16 2" fill="none" stroke-width="2.7"/>"""
    "reading","library","writing" -> """<path d="M60 26Q34 13 12 20v77q25-7 48 4 23-11 48-4V20Q83 13 60 26Z"/><path d="M60 26v75M24 37l23 4M24 51l23 4M24 65l23 4m26-28 23-4M73 55l23-4M73 69l23-4" fill="none" stroke-width="2"/>"""
    "memory" -> """<g transform="rotate(-14 39 59)"><rect x="12" y="20" width="49" height="76" rx="6"/><rect x="18" y="26" width="37" height="64" rx="3"/><path d="m24 33 23 23m-23-13 23 23m-23-13 23 23" stroke="#AAA" stroke-width="1"/><path d="m36 41 5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1Z"/></g><g transform="rotate(13 84 62)"><rect x="62" y="23" width="48" height="76" rx="6"/><path d="m86 44 5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1Z"/></g>"""
    "tangram" -> """<path d="M30 16v30l15-15ZM30 46h32L47 31 30 16m32 0v30L47 31ZM30 46l32 31V46ZM62 77 46 93 30 77l16-16Zm0 0 22-22 15 15-15 15ZM46 93l-16 16h31ZM84 55V28l16-15v43l-16 14" fill="none"/>"""
    "words" -> """<rect x="16" y="15" width="88" height="90" rx="4"/><path d="M45 15v90m30-90v90M16 45h88m-88 30h88" fill="none"/><g font-family="sans-serif" font-size="19" fill="#202022" stroke="none" text-anchor="middle"><text x="30" y="38">C</text><text x="60" y="38">A</text><text x="90" y="38">T</text><text x="30" y="68">R</text><text x="60" y="68">O</text><text x="90" y="68">G</text><text x="30" y="98">D</text><text x="60" y="98">O</text><text x="90" y="98">G</text></g>"""
    "sudoku" -> """<rect x="16" y="15" width="88" height="90" rx="4"/><path d="M45 15v90m30-90v90M16 45h88m-88 30h88" fill="none"/><g stroke-width="2.3" fill="none"><path d="M28 26h6v10m25-10q12-3 3 5l-5 6h11m17-11q15-3 7 5 10 5-7 7M27 54v7h12m-4-7v15m30-15H55v7q16-3 8 8m25-15q-12 10-1 14 10-3-1-8M26 86h12l-8 14m27-14q14-7 8 7-15 10-8-7m32 1q-11-5-7 6h10l-5 8"/></g>"""
    "maze" -> """<path d="M65 14H15v91h90V14H81M29 91V29h62v61H44V45h32v29H59V60" fill="none"/><path d="M73 7v17m-6-7 6 7 6-7" fill="none" stroke-width="2"/>"""
    "pattern" -> """<circle cx="21" cy="46" r="15"/><path d="m44 60 13-30 13 30Z"/><rect x="79" y="30" width="27" height="30" rx="2"/><path d="m37 78 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z"/><circle cx="72" cy="91" r="12"/>"""
    "puzzle","games" -> """<path d="M18 22h30q-9 20 7 20t7-20h32v30q20-9 20 7t-20 7v32H62q9-20-7-20t-7 20H18V66q20 9 20-7T18 52Z"/>"""
    "home" -> """<path d="M12 54L59 14l49 40M25 45v61h68V45M48 106V73h24v33" fill="none"/>"""
    "goals" -> """<path d="M35 18h50v37q0 27-25 27T35 55ZM35 28H15v17q0 20 23 20m47-37h20v17q0 20-23 20M60 82v19m-22 6h44" fill="none"/>"""
    "me" -> """<circle cx="60" cy="35" r="23"/><path d="M20 108q0-45 40-45t40 45ZM49 35h1m20 0h1m-20 12q9 8 18 0"/>"""
    "explore" -> """<circle cx="60" cy="60" r="44"/><path d="m79 37-10 34-28 12 10-34Z"/><circle cx="60" cy="60" r="3" fill="#202022"/>"""
    "drawing" -> """<path d="m20 91 7-24 52-52 23 23-52 52-30 7ZM27 67l23 23M71 23l23 23M20 97l9-7M68 101h36" fill="none"/>"""
    else -> """<path d="M18 30h84M18 60h84M18 90h84"/><circle cx="40" cy="30" r="8"/><circle cx="77" cy="60" r="8"/><circle cx="50" cy="90" r="8"/>"""
}

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
    "math" -> """<rect x="25" y="15" width="70" height="90" rx="9"/><path d="M35 36h50M38 57h18m-9-9v18m20-9h15M38 80l17 16m0-16L38 96m29-13h16m-16 10h16" fill="none"/>"""
    "reading","english","library","writing" -> """<path d="M60 26Q34 13 12 20v77q25-7 48 4 23-11 48-4V20Q83 13 60 26Z"/><path d="M60 26v75M24 37l23 4M24 51l23 4M24 65l23 4m26-28 23-4M73 55l23-4M73 69l23-4" fill="none"/>"""
    "puzzle","games" -> """<path d="M18 22h30q-9 20 7 20t7-20h32v30q20-9 20 7t-20 7v32H62q9-20-7-20t-7 20H18V66q20 9 20-7T18 52Z"/>"""
    "home" -> """<path d="M12 54L59 14l49 40M25 45v61h68V45M48 106V73h24v33" fill="none"/>"""
    "goals" -> """<path d="M35 18h50v37q0 27-25 27T35 55ZM35 28H15v17q0 20 23 20m47-37h20v17q0 20-23 20M60 82v19m-22 6h44" fill="none"/>"""
    "me" -> """<circle cx="60" cy="35" r="23"/><path d="M20 108q0-45 40-45t40 45ZM49 35h1m20 0h1m-20 12q9 8 18 0"/>"""
    "explore" -> """<circle cx="60" cy="60" r="44"/><path d="m79 37-10 34-28 12 10-34Z"/><circle cx="60" cy="60" r="3" fill="#202022"/>"""
    "drawing" -> """<path d="m20 91 7-24 52-52 23 23-52 52-30 7ZM27 67l23 23M71 23l23 23M20 97l9-7M68 101h36" fill="none"/>"""
    else -> """<path d="M18 30h84M18 60h84M18 90h84"/><circle cx="40" cy="30" r="8"/><circle cx="77" cy="60" r="8"/><circle cx="50" cy="90" r="8"/>"""
}

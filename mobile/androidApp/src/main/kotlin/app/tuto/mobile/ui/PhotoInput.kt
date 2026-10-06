package app.tuto.mobile.ui

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import app.tuto.mobile.FeatureRun
import app.tuto.mobile.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL
import java.util.UUID

@Composable fun RemotePhoto(url: String?, modifier: Modifier = Modifier) {
    if (url.isNullOrBlank() || !url.startsWith("https://")) return
    var image by remember(url) { mutableStateOf<android.graphics.Bitmap?>(null) }
    var failed by remember(url) { mutableStateOf(false) }
    LaunchedEffect(url) { image = withContext(Dispatchers.IO) { runCatching {
        val c = URL(url).openConnection().apply { connectTimeout = 15000; readTimeout = 20000 }
        c.getInputStream().use { stream ->
            val bytes = stream.readLimited(12 * 1024 * 1024 + 1); require(bytes.size <= 12 * 1024 * 1024)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(bytes,0,bytes.size,bounds)
            val options = BitmapFactory.Options().apply { inSampleSize = (maxOf(bounds.outWidth,bounds.outHeight)/1600).coerceAtLeast(1) }
            BitmapFactory.decodeByteArray(bytes,0,bytes.size,options)
        }
    }.getOrNull() }; failed = image == null }
    image?.let { Image(it.asImageBitmap(), null, modifier.fillMaxWidth().heightIn(max = 340.dp), contentScale = ContentScale.Fit) }
    if (failed) Text(LocalStrings.current.say("Image couldn't load", "Görsel yüklenemedi", "No se pudo cargar la imagen"))
}

@Composable fun PhotoInput(run: FeatureRun, maximum: Int = 15) {
    val context = LocalContext.current
    val s = LocalStrings.current
    var camera by rememberSaveable { mutableStateOf<String?>(null) }
    var cropping by remember { mutableStateOf<LocalPhoto?>(null) }
    fun import(uris: List<Uri>) { run.work {
        val room = maximum - run.photos.size
        val incoming = uris.take(room.coerceAtLeast(0)).map { importPhoto(context, it) }
        if (incoming.size == 1) cropping = incoming[0] else run.photos = run.photos + incoming
    } }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { import(it) }
    val take = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok -> if (ok) camera?.let { import(listOf(Uri.parse(it))) } }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Button(onClick = { gallery.launch("image/*") }, enabled = !run.busy && run.photos.size < maximum) { Text(s.say("Add photos", "Fotoğraf ekle", "Añadir fotos")) }
        TextButton(onClick = {
            val dir = File(context.cacheDir, "photos").apply { mkdirs() }
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", File(dir, "${UUID.randomUUID()}.jpg"))
            camera = uri.toString(); take.launch(uri)
        }, enabled = !run.busy && run.photos.size < maximum) { Text(s.say("Camera", "Kamera", "Cámara")) }
    }
    run.photos.forEachIndexed { i, photo ->
        val bitmap = remember(photo.path) { runCatching { photoBitmap(photo) }.getOrNull() }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            bitmap?.let { Image(it.asImageBitmap(), s.say("Photo ${i + 1}", "Fotoğraf ${i + 1}", "Foto ${i + 1}"), Modifier.size(100.dp), contentScale = ContentScale.Fit) }
            TextButton(onClick = { run.photos = run.photos - photo }, enabled = !run.busy) { Text(s.say("Remove", "Kaldır", "Quitar")) }
            TextButton(onClick = { run.photos = run.photos - photo; cropping = photo }, enabled = !run.busy) { Text(s.say("Crop", "Kırp", "Recortar")) }
        }
    }
    cropping?.let { photo ->
        var l by remember(photo.path) { mutableFloatStateOf(0f) }; var r by remember(photo.path) { mutableFloatStateOf(1f) }
        var t by remember(photo.path) { mutableFloatStateOf(0f) }; var b by remember(photo.path) { mutableFloatStateOf(1f) }
        val bitmap = remember(photo.path) { runCatching { photoBitmap(photo) }.getOrNull() }
        AlertDialog(onDismissRequest = { run.photos = run.photos + photo; cropping = null }, title = { Text(s.say("Crop photo", "Fotoğrafı kırp", "Recortar foto")) }, text = {
            Column {
                bitmap?.let { image ->
                    Box(Modifier.fillMaxWidth().aspectRatio(image.width.toFloat()/image.height)) {
                        Image(image.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
                        androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) { drawRect(androidx.compose.ui.graphics.Color(0xFF008577), androidx.compose.ui.geometry.Offset(l*size.width,t*size.height), androidx.compose.ui.geometry.Size((r-l)*size.width,(b-t)*size.height), style = androidx.compose.ui.graphics.drawscope.Stroke(3.dp.toPx())) }
                    }
                }
                Text(s.say("Left / right", "Sol / sağ", "Izquierda / derecha")); RangeSlider(value = l..r, onValueChange = { if (it.endInclusive - it.start > .08f) { l = it.start; r = it.endInclusive } })
                Text(s.say("Top / bottom", "Üst / alt", "Arriba / abajo")); RangeSlider(value = t..b, onValueChange = { if (it.endInclusive - it.start > .08f) { t = it.start; b = it.endInclusive } })
            }
        }, confirmButton = { TextButton(onClick = { run.work { run.photos = run.photos + cropPhoto(context, photo, l, t, r, b); cropping = null } }, enabled = !run.busy) { Text(s.say("Use photo", "Fotoğrafı kullan", "Usar foto")) } }, dismissButton = { TextButton(onClick = { run.photos = run.photos + photo; cropping = null }) { Text(s.say("Keep original", "Orijinali koru", "Conservar original")) } })
    }
}

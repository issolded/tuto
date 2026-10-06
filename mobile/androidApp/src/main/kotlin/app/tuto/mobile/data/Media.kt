package app.tuto.mobile.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.util.UUID
import kotlin.math.min

/** Private cache file: screen rotation does not retain large photos in saved-state bundles. */
data class LocalPhoto(val path: String, val mime: String, val modified: Long? = null) {
    fun bytes() = File(path).readBytes()
    fun part() = JSONObject().put("inline_data", JSONObject().put("mime_type", mime).put("data", Base64.encodeToString(bytes(), Base64.NO_WRAP)))
}
suspend fun importPhoto(context: Context, uri: Uri): LocalPhoto = withContext(Dispatchers.IO) {
    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
    require(mime.startsWith("image/"))
    val bytes = context.contentResolver.openInputStream(uri)!!.use { it.readLimited(25 * 1024 * 1024 + 1) }
    require(bytes.size <= 25 * 1024 * 1024) { "Photo is too large" }
    val dir = File(context.cacheDir, "photos").apply { mkdirs() }
    val file = File(dir, UUID.randomUUID().toString()); file.writeBytes(bytes)
    LocalPhoto(file.absolutePath, mime)
}
fun photoBitmap(photo: LocalPhoto): Bitmap {
    val opt = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeFile(photo.path, opt)
    opt.inJustDecodeBounds = false; opt.inSampleSize = (maxOf(opt.outWidth, opt.outHeight) / 1600).coerceAtLeast(1)
    val raw = requireNotNull(BitmapFactory.decodeFile(photo.path, opt))
    val orientation = runCatching { ExifInterface(photo.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1) }.getOrDefault(1)
    val matrix = Matrix().apply { when (orientation) { 2 -> setScale(-1f, 1f); 3 -> postRotate(180f); 4 -> setScale(1f, -1f); 5 -> { postRotate(90f); postScale(-1f, 1f) }; 6 -> postRotate(90f); 7 -> { postRotate(270f); postScale(-1f, 1f) }; 8 -> postRotate(270f) } }
    return Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true)
}
suspend fun cropPhoto(context: Context, photo: LocalPhoto, left: Float, top: Float, right: Float, bottom: Float): LocalPhoto = withContext(Dispatchers.IO) {
    if (left == 0f && top == 0f && right == 1f && bottom == 1f) return@withContext photo
    val bitmap = photoBitmap(photo)
    val x = (left * bitmap.width).toInt(); val y = (top * bitmap.height).toInt()
    val w = ((right - left) * bitmap.width).toInt().coerceIn(1, bitmap.width - x)
    val h = ((bottom - top) * bitmap.height).toInt().coerceIn(1, bitmap.height - y)
    val cropped = Bitmap.createBitmap(bitmap, x, y, w, h)
    val file = File(File(context.cacheDir, "photos").apply { mkdirs() }, "${UUID.randomUUID()}.jpg")
    file.outputStream().use { cropped.compress(Bitmap.CompressFormat.JPEG, 95, it) }
    LocalPhoto(file.absolutePath, "image/jpeg")
}
suspend fun modelJSON(api: TutoApi, child: Child, prompt: String, photos: List<LocalPhoto>): JSONObject {
    val parts = org.json.JSONArray().put(JSONObject().put("text", prompt)); photos.forEach { parts.put(it.part()) }
    val r = api.call("POST", "/api/gemini/generate", JSONObject().put("childId", child.id).put("parts", parts).put("generationConfig", JSONObject().put("response_mime_type", "application/json")))
    val text = r.getJSONArray("candidates").getJSONObject(0).getJSONObject("content").getJSONArray("parts").objects().filter { !it.optBoolean("thought") }.joinToString("") { it.optString("text") }
    return JSONObject(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1))
}

/** Bounded read compatible with Android 8; InputStream.readNBytes needs API 33. */
fun java.io.InputStream.readLimited(limit: Int): ByteArray {
    val out = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
    while (out.size() < limit) { val count = read(buffer, 0, minOf(buffer.size, limit-out.size())); if(count < 0) break; if(count > 0) out.write(buffer,0,count) }
    return out.toByteArray()
}

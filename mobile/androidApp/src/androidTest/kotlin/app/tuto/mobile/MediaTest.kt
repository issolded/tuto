package app.tuto.mobile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.media.ExifInterface
import android.util.Base64
import androidx.test.platform.app.InstrumentationRegistry
import app.tuto.mobile.data.*
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.Random

/** Real Android decoders/EXIF/encoders, with synthetic images; no network or family data. */
class MediaTest {
    private fun file() = File.createTempFile("media-test-", ".jpg", InstrumentationRegistry.getInstrumentation().targetContext.cacheDir)

    @Test fun noisyFifteenPageRequestFitsServerLimitAndLeavesOriginalIntact() = runBlocking {
        val file = file()
        try {
            val bitmap = Bitmap.createBitmap(2400, 1600, Bitmap.Config.ARGB_8888)
            val random = Random(6006)
            val row = IntArray(bitmap.width)
            repeat(bitmap.height) { y ->
                for (x in row.indices) row[x] = Color.rgb(random.nextInt(256), random.nextInt(256), random.nextInt(256))
                bitmap.setPixels(row, 0, row.size, 0, y, row.size, 1)
            }
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }; bitmap.recycle()
            val original = file.readBytes()
            val photo = LocalPhoto(file.absolutePath, "image/png")
            val part = photo.part()
            val inline = part.getJSONObject("inline_data")
            assertEquals("image/jpeg", inline.getString("mime_type"))
            val bytes = Base64.decode(inline.getString("data"), Base64.NO_WRAP)
            assertTrue(bytes.size <= MODEL_PHOTO_MAX_BYTES)
            val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            assertTrue(maxOf(decoded.width, decoded.height) <= 1600)
            assertTrue(minOf(decoded.width, decoded.height) >= 700)
            decoded.recycle()
            val parts = JSONArray().put(JSONObject().put("text", "Read these fifteen pages."))
            repeat(15) { parts.put(part) }
            val body = JSONObject().put("childId", "isolated-test").put("parts", parts).toString().toByteArray()
            assertTrue("15 pages must fit the server's JSON limit", body.size < 15 * 1024 * 1024)
            assertArrayEquals("Private upload must retain original bytes", original, photo.bytes())
        } finally { file.delete() }
    }

    @Test fun inlinePhotoAppliesExifRotationAndRetainsOriginalDate() = runBlocking {
        val file = file()
        try {
            val bitmap = Bitmap.createBitmap(2000, 1000, Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(Color.RED)
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it) }; bitmap.recycle()
            ExifInterface(file.path).apply {
                setAttribute(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_ROTATE_90.toString())
                setAttribute(ExifInterface.TAG_DATETIME_ORIGINAL, "2026:10:01 10:11:12")
                saveAttributes()
            }
            val original = file.readBytes()
            val image = LocalPhoto(file.path, "image/jpeg").modelImage()
            val bytes = Base64.decode(image.base64, Base64.NO_WRAP)
            val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            assertEquals(800, decoded.width); assertEquals(1600, decoded.height)
            decoded.recycle()
            assertArrayEquals(original, file.readBytes())
            assertEquals("2026:10:01 10:11:12", ExifInterface(file.path).getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL))
        } finally { file.delete() }
    }

    @Test fun unreadablePhotoFailsBeforeSending() = runBlocking {
        val file = file()
        try {
            file.writeText("not an image")
            assertTrue(runCatching { LocalPhoto(file.path, "image/jpeg").modelImage() }.isFailure)
        } finally { file.delete() }
    }
}

package app.tuto.mobile

import android.content.Context
import androidx.compose.runtime.*
import app.tuto.mobile.data.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Long-running saves belong to the ViewModel and survive rotation. */
class FeatureRun(val child: Child, val api: TutoApi, val cloud: Cloud, private val scope: CoroutineScope, context: Context) {
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null)
    var data by mutableStateOf(JSONObject())
    var selected by mutableStateOf<JSONObject?>(null)
    var page by mutableStateOf("list")
    var title by mutableStateOf("")
    var text by mutableStateOf("")
    var photos by mutableStateOf<List<LocalPhoto>>(emptyList())
    var evaluation by mutableStateOf<JSONObject?>(null)
    var questions by mutableStateOf<List<JSONObject>>(emptyList())
    var answers by mutableStateOf<List<JSONObject>>(emptyList())
    var index by mutableIntStateOf(0)
    private val strings = Strings.load(context, child.language)
    val local = context.getSharedPreferences("tuto-work-${child.id}", Context.MODE_PRIVATE)
    val path get() = "/api/children/${child.id}"
    fun work(block: suspend () -> Unit) {
        if (busy) return
        busy = true; error = null; notice = null
        scope.launch { try { block() } catch (e: Exception) { error = if (e is ApiFailure && e.status == 409) strings.say("This draft changed on another device. Your local copy is kept. Reload before saving.", "Taslak başka cihazda değişti. Yerel kopyan korundu; sunucudaki sürümü açabilir veya yeni hikâye olarak saklayabilirsin.", "El borrador cambió en otro dispositivo. Tu copia local se conserva. Carga la copia del servidor.") else strings.say("Could not complete this request. Please try again.", "İstek tamamlanamadı. Lütfen tekrar dene.", "No se pudo completar. Inténtalo de nuevo.") } finally { busy = false } }
    }
    fun clearError() { error = null }
}

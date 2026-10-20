package app.tuto.mobile.data

import android.content.Context
import androidx.compose.runtime.staticCompositionLocalOf
import org.json.JSONObject

/**
 * The child's words. The web dictionary (src/lib/i18n.js) is the source: mobile/engine/build.mjs
 * exports every key in every language to assets/i18n.json, so a translation fixed on the web is
 * fixed here on the next build. Language is children.language, never the parent's.
 */
class Strings(private val table: JSONObject, val lang: String) {
    operator fun invoke(key: String): String = table.optJSONObject(key)?.optString(lang)?.takeIf { it.isNotEmpty() }
        ?: table.optJSONObject(key)?.optString("en").orEmpty().ifEmpty { key }

    /** For "%n% days" style entries. */
    fun fill(key: String, vararg pairs: Pair<String, Any>): String =
        pairs.fold(invoke(key)) { acc, (k, v) -> acc.replace("%$k%", v.toString()) }

    /**
     * Words the web dictionary does not have yet (they belong to screens only the tablet has).
     * Three languages spelled out every time, like say() on the web: a two-way choice would fall
     * back to English for the third language without anyone noticing.
     */
    fun say(en: String, tr: String, es: String): String = when (lang) { "tr" -> tr; "es" -> es; else -> en }

    fun withLang(l: String) = Strings(table, l)

    companion object {
        fun load(context: Context, lang: String): Strings {
            val text = runCatching { context.assets.open("i18n.json").bufferedReader().use { it.readText() } }.getOrNull()
            val table = text?.let { JSONObject(it).optJSONObject("strings") } ?: JSONObject()
            return Strings(table, lang)
        }
    }
}

val LocalStrings = staticCompositionLocalOf<Strings> { error("Strings not provided") }

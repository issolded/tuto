package app.tuto.mobile.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import app.tuto.mobile.BuildConfig
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import java.util.concurrent.TimeUnit

private val client = okhttp3.OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(120, TimeUnit.SECONDS).build()

fun enc(value: String): String = URLEncoder.encode(value, "UTF-8").replace("+", "%20")

/** One HTTP implementation for PostgREST, Auth, private Storage and parent API requests. */
internal suspend fun http(url: String, method: String = "GET", body: ByteArray? = null, headers: Map<String, String> = emptyMap()): String = withContext(Dispatchers.IO) {
    val request = okhttp3.Request.Builder().url(url)
    headers.forEach { (key, value) -> request.header(key, value) }
    request.header("Accept", "application/json")
    val data = body ?: if (method in setOf("POST", "PUT", "PATCH")) ByteArray(0) else null
    request.method(method, data?.toRequestBody((headers["Content-Type"] ?: "application/json").toMediaType()))
    client.newCall(request.build()).execute().use { response ->
        val text = response.body?.string().orEmpty()
        if (!response.isSuccessful) throw ApiFailure(response.code, runCatching { JSONObject(text) }.getOrElse { JSONObject().put("error", "Request failed (${response.code})") })
        text
    }
}

/** Refresh tokens are encrypted by a non-exportable Android Keystore key. */
class ParentCredentials(context: Context, private val slot:String = "session") {
    private val prefs = context.getSharedPreferences("tuto-parent", Context.MODE_PRIVATE)
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey("tuto-parent-session", null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("tuto-parent-session", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun read(): JSONObject? = prefs.getString(slot, null)?.let { stored -> runCatching {
        val parts = stored.split(':'); val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
        JSONObject(String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8))
    }.getOrNull() }
    fun write(value: JSONObject?) {
        if (value == null) { prefs.edit().remove(slot).apply(); return }
        val c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE, key())
        val bytes = c.doFinal(value.toString().toByteArray())
        prefs.edit().putString(slot, Base64.encodeToString(c.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(bytes, Base64.NO_WRAP)).apply()
    }
}

open class Cloud(context: Context) {
    private val config = JSONObject(context.assets.open("public-config.json").bufferedReader().use { it.readText() })
    val base: String = config.getString("url")
    private val anon = config.getString("anon") // Public anon/publishable key, never service_role.
    private val credentials = ParentCredentials(context)
    private val oauth = ParentCredentials(context,"oauth-pkce")
    private var auth = credentials.read()
    private val refreshLock = Mutex()
    open val parentId get() = auth?.optJSONObject("user")?.optString("id")
    val parentSignedIn get() = parentId?.isNotBlank() == true
    private fun acceptSession(j: JSONObject) { j.put("expires_at", System.currentTimeMillis() / 1000 + j.optLong("expires_in", 3600)); credentials.write(j); auth = j }
    open suspend fun signIn(email: String, password: String) {
        cancelOAuth()
        val j = JSONObject(http("$base/auth/v1/token?grant_type=password", "POST", JSONObject().put("email", email.trim()).put("password", password).toString().toByteArray(), mapOf("apikey" to anon)))
        require(j.has("access_token") && j.has("refresh_token")); acceptSession(j)
    }
    open suspend fun signUp(email: String, password: String): Boolean {
        val j = JSONObject(http("$base/auth/v1/signup", "POST", JSONObject().put("email", email.trim()).put("password", password).toString().toByteArray(), mapOf("apikey" to anon)))
        if (j.has("access_token") && !j.isNull("access_token")) { acceptSession(j); return true }; return false
    }
    open suspend fun resetPassword(email: String) { http("$base/auth/v1/recover", "POST", JSONObject().put("email", email.trim()).toString().toByteArray(), mapOf("apikey" to anon)) }
    open fun beginGoogleOAuth():String {
        val verifier=OAuthPkce.verifier()
        oauth.write(JSONObject().put("verifier",verifier).put("started",System.currentTimeMillis()))
        return "$base/auth/v1/authorize?provider=google&redirect_to=${enc(OAuthPkce.REDIRECT)}&code_challenge=${enc(OAuthPkce.challenge(verifier))}&code_challenge_method=s256&prompt=select_account"
    }
    open val hasPendingOAuth get()=oauth.read()?.let { System.currentTimeMillis()-it.optLong("started") in 0..OAuthPkce.MAX_AGE_MS } ?: false
    open fun cancelOAuth() {oauth.write(null)}
    open suspend fun completeGoogleOAuth(url:String) {
        val pending=oauth.read() ?: throw IOException("Sign in required")
        try {
            val code=OAuthPkce.code(url,pending.getLong("started"),System.currentTimeMillis())
            val j=JSONObject(http("$base/auth/v1/token?grant_type=pkce","POST",JSONObject().put("auth_code",code).put("code_verifier",pending.getString("verifier")).toString().toByteArray(),mapOf("apikey" to anon)))
            require(j.has("access_token") && j.has("refresh_token"));acceptSession(j)
        } finally {cancelOAuth()}
    }
    open suspend fun token(): String = refreshLock.withLock {
        val current = auth ?: throw IOException("Sign in required")
        if (current.optLong("expires_at") < System.currentTimeMillis() / 1000 + 60) {
            val j = JSONObject(http("$base/auth/v1/token?grant_type=refresh_token", "POST", JSONObject().put("refresh_token", current.getString("refresh_token")).toString().toByteArray(), mapOf("apikey" to anon)))
            acceptSession(j)
        }
        auth!!.getString("access_token")
    }
    open suspend fun signOut() { try { http("$base/auth/v1/logout?scope=local", "POST", headers = mapOf("apikey" to anon, "Authorization" to "Bearer ${token()}")) } finally { auth = null; credentials.write(null); cancelOAuth() } }
    open suspend fun rows(table: String, query: String, method: String = "GET", body: Any? = null, parent: Boolean = false): List<JSONObject> {
        require(table.matches(Regex("[a-z_]+")))
        val t = if (parent) token() else anon // Child never inherits a parent session.
        val txt = http("$base/rest/v1/$table?$query", method, body?.toString()?.toByteArray(), mapOf("apikey" to anon, "Authorization" to "Bearer $t", "Prefer" to "return=representation"))
        return if (txt.isBlank()) emptyList() else JSONArray(txt).objects()
    }
    open suspend fun parentCall(method: String, path: String, body: JSONObject? = null): JSONObject {
        require(path.startsWith("/api/"))
        val text = http(BuildConfig.SERVER_URL + path, method, body?.toString()?.toByteArray(), mapOf("Authorization" to "Bearer ${token()}"))
        return if (text.isBlank()) JSONObject() else JSONObject(text)
    }
    open suspend fun upload(bucket: String, path: String, bytes: ByteArray, mime: String): String {
        http("$base/storage/v1/object/${enc(bucket)}/${path.split('/').joinToString("/") { enc(it) }}", "POST", bytes,
            mapOf("apikey" to anon, "Authorization" to "Bearer $anon", "Content-Type" to mime, "x-upsert" to "false"))
        return path
    }
    open suspend fun updatePrefs(transform: (JSONObject) -> JSONObject): JSONObject {
        val uid = parentId ?: throw IOException("Sign in required")
        repeat(3) {
            val row = rows("parents", "id=eq.${enc(uid)}&select=prefs", parent = true).single()
            val old = row.optJSONObject("prefs")
            val next = transform(JSONObject(old?.toString() ?: "{}"))
            val filter = if (old == null) "prefs=is.null" else "prefs=eq.${enc(old.toString())}"
            if (rows("parents", "id=eq.${enc(uid)}&$filter", "PATCH", JSONObject().put("prefs", next), true).isNotEmpty()) return next
        }
        throw IOException("Preferences changed elsewhere. Refresh and try again.")
    }
}

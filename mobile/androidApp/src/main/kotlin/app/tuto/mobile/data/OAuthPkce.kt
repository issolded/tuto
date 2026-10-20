package app.tuto.mobile.data

import java.net.URI
import java.net.URLDecoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

object OAuthPkce {
    const val REDIRECT = "app.tuto.mobile://auth/callback"
    const val MAX_AGE_MS = 10 * 60 * 1000L
    fun verifier():String = ByteArray(32).also { SecureRandom().nextBytes(it) }.let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) }
    fun challenge(verifier:String):String = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)))
    fun isCallback(url:String):Boolean = runCatching { val u=URI(url);u.scheme=="app.tuto.mobile" && u.rawAuthority=="auth" && u.path=="/callback" && u.fragment==null }.getOrDefault(false)
    fun code(url:String,started:Long,now:Long):String {
        require(isCallback(url) && now-started in 0..MAX_AGE_MS)
        val params=(URI(url).rawQuery ?: "").split('&').filter { it.isNotEmpty() }.map { pair ->
            val bits=pair.split('=',limit=2)
            URLDecoder.decode(bits[0],"UTF-8") to URLDecoder.decode(bits.getOrElse(1){""},"UTF-8")
        }
        require(params.none { it.first=="error" || it.first=="error_description" })
        val code=params.filter { it.first=="code" }.single().second
        require(code.length in 1..2048 && code.none { it.isWhitespace() })
        return code
    }
}

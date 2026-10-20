package app.tuto.mobile
import app.tuto.mobile.data.OAuthPkce
import org.junit.Assert.*
import org.junit.Test
class OAuthPkceTest {
    @Test fun challengeMatchesRfc7636AndVerifiersAreUnique() {
        assertEquals("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",OAuthPkce.challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
        val a=OAuthPkce.verifier();val b=OAuthPkce.verifier();assertNotEquals(a,b);assertTrue(a.matches(Regex("[A-Za-z0-9_-]{43}")))
    }
    @Test fun callbackRejectsForeignOriginsTokensDuplicatesAndExpiredRequests() {
        assertEquals("code-1",OAuthPkce.code(OAuthPkce.REDIRECT+"?code=code-1",1000,2000))
        for(url in listOf("https://example.com?code=x","app.tuto.mobile://auth.evil/callback?code=x",OAuthPkce.REDIRECT+"?code=x&code=y",OAuthPkce.REDIRECT+"#access_token=x",OAuthPkce.REDIRECT+"?error=denied")) assertTrue(runCatching {OAuthPkce.code(url,1000,2000)}.isFailure)
        assertTrue(runCatching {OAuthPkce.code(OAuthPkce.REDIRECT+"?code=x",1000,1000+OAuthPkce.MAX_AGE_MS+1)}.isFailure)
    }
}

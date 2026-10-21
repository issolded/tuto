package app.tuto.mobile.data
import android.content.Context
import org.json.JSONObject

data class Avatar(val hair:Int=0,val skin:Int=0,val shirt:Int=0,val accessory:Int=0,val pet:Int=0,val face:Int=0,val outfit:Int=0,val gender:Int=0,val nickname:String="",val petName:String="",val hairColor:Int=0,val petColor:Int=0) {
    fun json()=JSONObject().put("schema",2).put("hairColor",hairColor).put("petColor",petColor).put("hair",hair).put("skin",skin).put("shirt",shirt).put("accessory",accessory).put("pet",pet).put("face",face).put("outfit",outfit).put("gender",gender).put("nickname",nickname).put("petName",petName).toString()
    companion object { fun read(raw:String?)=runCatching { val j=JSONObject(raw?:"{}");Avatar(j.optInt("hair").coerceIn(0,9),j.optInt("skin").coerceIn(0,4),j.optInt("shirt").coerceIn(0,5),j.optInt("accessory").coerceIn(0,3),j.optInt("pet").coerceIn(-1,5),(if(j.optInt("schema")>=2)j.optInt("face") else 0).coerceIn(0,4),j.optInt("outfit").coerceIn(0,2),j.optInt("gender",if(j.optInt("outfit")==2)1 else 0).coerceIn(0,1),j.optString("nickname").take(30),j.optString("petName").take(30),j.optInt("hairColor").coerceIn(0,6),j.optInt("petColor").coerceIn(0,4)) }.getOrDefault(Avatar()) }
}
class AvatarStore(context:Context) {
 private val prefs=context.getSharedPreferences("tuto-notebook-avatar-v1",Context.MODE_PRIVATE)
 fun read(childId:String)=Avatar.read(prefs.getString(childId,null))
 fun save(childId:String,avatar:Avatar)=prefs.edit().putString(childId,avatar.json()).apply()
}

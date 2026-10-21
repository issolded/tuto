package app.tuto.mobile

import androidx.compose.runtime.*
import app.tuto.mobile.data.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/** Uses the same server-owned questions, answer keys and rewards as the web English ladder. */
class LiteracyRun(private val scope:CoroutineScope,private val api:TutoApi,private val child:Child) {
 var started=false;private set
 var sitting:String?=null;private set
 var item by mutableStateOf<JSONObject?>(null);private set
 var n by mutableIntStateOf(0);private set
 var total by mutableIntStateOf(10);private set
 var busy by mutableStateOf(false);private set
 var error by mutableStateOf(false);private set
 var uncertainAnswer by mutableStateOf(false);private set
 var done by mutableStateOf(false);private set
 var gems by mutableIntStateOf(0);private set
 var values by mutableStateOf<Map<String,List<String>>>(emptyMap());private set
 var results by mutableStateOf<List<JSONObject>?>(null);private set
 var audioOk by mutableStateOf<Boolean?>(null)
 val questions get()=item?.optJSONArray("questions").objects()
 val ready get()=questions.isNotEmpty()&&questions.all{q-> val v=values[q.getString("id")].orEmpty();v.size==if(q.optString("mode")=="build")q.getJSONArray("letters").length()else q.optInt("pick",1)}
 fun choose(q:JSONObject,id:String){if(busy||results!=null||uncertainAnswer)return;val key=q.getString("id");val old=values[key].orEmpty();values=values+(key to if(q.optString("mode")=="build")old+id else if(q.optInt("pick",1)==1)listOf(id)else if(id in old)old-id else (old+id).takeLast(q.optInt("pick",1)))}
 fun undo(q:JSONObject){if(!busy&&results==null)values=values+(q.getString("id") to values[q.getString("id")].orEmpty().dropLast(1))}
 fun next(noSound:Boolean=false){
  if(busy||uncertainAnswer)return
  started=true;busy=true;error=false
  val body=JSONObject().put("sitting_id",sitting?:JSONObject.NULL)
  if(noSound){audioOk=false;body.put("no_audio",true).put("discard_item",item?.getString("id"))}
  else if(audioOk==false)body.put("no_audio",true)
  scope.launch{runCatching{api.call("POST","/api/children/${child.id}/literacy/next",body)}.onSuccess{r->
   sitting=r.getString("sitting_id");n=r.optInt("n");total=r.optInt("of",10);done=r.optBoolean("done");gems=r.optInt("gems_earned")
   item=r.optJSONObject("item");values=emptyMap();results=null
  }.onFailure{error=true};busy=false}
 }
 fun send(skipped:Boolean=false){
  val current=item?:return;if(busy||results!=null||uncertainAnswer||(!skipped&&!ready))return
  val answers=JSONArray();questions.forEach{q->val v=values[q.getString("id")].orEmpty();val chosen:Any=if(q.optString("mode")=="build")v.joinToString(""){id->q.getJSONArray("letters").objects().first{it.getString("id")==id}.getString("letter")}else JSONArray(v);answers.put(JSONObject().put("question_id",q.getString("id")).put("chosen",chosen))}
  busy=true;error=false
  scope.launch{runCatching{api.call("POST","/api/literacy-sittings/$sitting/answer",JSONObject().put("item_id",current.getString("id")).put("answers",answers).put("skipped",skipped))}.onSuccess{results=it.getJSONArray("results").objects()}.onFailure{error=true;uncertainAnswer=true};busy=false}
 }
}

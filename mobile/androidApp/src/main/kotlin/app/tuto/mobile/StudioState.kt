package app.tuto.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.compose.runtime.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.util.UUID

data class BookRecord(val id:String, val title:String, val total:Int, val page:Int = 0)
data class NoteRecord(val id:String, val title:String, val body:String, val date:String)
data class Contribution(val id:String, val title:String, val category:String, val date:String)

/** Device-only preview data. No simulated approvals, AI evaluations or production writes. */
class StudioState(app:Application): AndroidViewModel(app) {
    private val prefs = app.getSharedPreferences("tuto-studio-v2",0)
    var age by mutableIntStateOf(prefs.getInt("age",8)); private set
    var books by mutableStateOf(readArray("books").map { BookRecord(it.getString("id"),it.getString("title"),it.getInt("total"),it.optInt("page")) }); private set
    var stories by mutableStateOf(readArray("stories").map { NoteRecord(it.getString("id"),it.getString("title"),it.getString("body"),it.getString("date")) }); private set
    var homework by mutableStateOf(readArray("homework").map { NoteRecord(it.getString("id"),it.getString("title"),it.getString("body"),it.getString("date")) }); private set
    var contributions by mutableStateOf(readArray("contributions").map { Contribution(it.getString("id"),it.getString("title"),it.getString("category"),it.getString("date")) }); private set
    var storyTitle by mutableStateOf(prefs.getString("storyTitle","") ?: ""); private set
    var storyBody by mutableStateOf(prefs.getString("storyBody","") ?: ""); private set
    var goal by mutableStateOf(prefs.getString("goal","Roblox · 15 minutes") ?: "Roblox · 15 minutes"); private set
    var drawing by mutableStateOf(prefs.getString("drawing","cat") ?: "cat"); private set
    var step by mutableIntStateOf(prefs.getInt("step",0)); private set
    var scienceDone by mutableStateOf(prefs.getStringSet("scienceDone",emptySet())!!.toSet()); private set
    val band get() = if(age<=8) "6–8" else if(age<=10) "9–10" else "11–13"
    val todayCount get() = contributions.count { it.date == LocalDate.now().toString() }
    fun age(value:Int) { age=value.coerceIn(6,13); prefs.edit().putInt("age",age).apply() }
    fun addBook(title:String,total:Int) { if(title.isBlank() || total !in 1..10000)return; books=books+BookRecord(UUID.randomUUID().toString(),title.trim().take(100),total); saveBooks() }
    fun page(id:String,page:Int) { books=books.map { if(it.id==id) it.copy(page=page.coerceIn(0,it.total)) else it }; saveBooks() }
    fun removeBook(id:String) { books=books.filterNot { it.id==id }; saveBooks() }
    private fun saveBooks()=writeArray("books",books.map { JSONObject().put("id",it.id).put("title",it.title).put("total",it.total).put("page",it.page) })
    fun draft(title:String,body:String) { storyTitle=title.take(120);storyBody=body.take(12000);prefs.edit().putString("storyTitle",storyTitle).putString("storyBody",storyBody).apply() }
    fun saveStory() { if(storyTitle.isBlank()||storyBody.isBlank())return; stories=stories+NoteRecord(UUID.randomUUID().toString(),storyTitle,storyBody,LocalDate.now().toString()); saveNotes("stories",stories);draft("","") }
    fun addHomework(title:String,body:String) { if(title.isBlank())return;homework=homework+NoteRecord(UUID.randomUUID().toString(),title.trim().take(120),body.take(4000),LocalDate.now().toString());saveNotes("homework",homework) }
    private fun saveNotes(key:String,notes:List<NoteRecord>)=writeArray(key,notes.map { JSONObject().put("id",it.id).put("title",it.title).put("body",it.body).put("date",it.date) })
    fun contribute(title:String,category:String) { if(title.isBlank())return; contributions=contributions+Contribution(UUID.randomUUID().toString(),title.trim().take(120),category,LocalDate.now().toString());saveContributions() }
    fun removeContribution(id:String) { contributions=contributions.filterNot { it.id==id };saveContributions() }
    private fun saveContributions()=writeArray("contributions",contributions.map { JSONObject().put("id",it.id).put("title",it.title).put("category",it.category).put("date",it.date) })
    fun chooseDrawing(id:String) { drawing=id;step=0;prefs.edit().putString("drawing",id).putInt("step",0).apply() }
    fun step(value:Int) { step=value.coerceAtLeast(0);prefs.edit().putInt("step",step).apply() }
    fun goal(value:String) { goal=value;prefs.edit().putString("goal",value).apply() }
    fun finishScience(id:String) { scienceDone=scienceDone+id;prefs.edit().putStringSet("scienceDone",scienceDone).apply() }
    private fun readArray(key:String):List<JSONObject> = runCatching { val a=JSONArray(prefs.getString(key,"[]"));(0 until a.length()).map(a::getJSONObject) }.getOrDefault(emptyList())
    private fun writeArray(key:String,items:List<JSONObject>) { val a=JSONArray();items.forEach(a::put);prefs.edit().putString(key,a.toString()).apply() }
}

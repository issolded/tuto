package app.tuto.mobile.screentime
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.content.ContentValues
import org.json.JSONObject

/** Counters and replay cursor commit atomically; only changed buckets are uploaded. */
class UsageDatabase(context:Context):SQLiteOpenHelper(context,"tuto-screen-usage.db",null,1) {
 override fun onCreate(db:SQLiteDatabase){db.execSQL("CREATE TABLE buckets(day TEXT NOT NULL, package TEXT NOT NULL, label TEXT NOT NULL, ms INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT -1, PRIMARY KEY(day,package))");db.execSQL("CREATE TABLE state(k TEXT PRIMARY KEY,v TEXT NOT NULL)")}
 override fun onUpgrade(db:SQLiteDatabase,oldVersion:Int,newVersion:Int){}
 fun readState(key:String,fallback:String):String=readableDatabase.rawQuery("SELECT v FROM state WHERE k=?",arrayOf(key)).use {if(it.moveToFirst())it.getString(0) else fallback}
 fun writeState(key:String,value:String){writableDatabase.insertWithOnConflict("state",null,ContentValues().apply{put("k",key);put("v",value)},SQLiteDatabase.CONFLICT_REPLACE)}
 fun reset(now:Long){val db=writableDatabase;db.beginTransaction();try{db.delete("buckets",null,null);db.delete("state",null,null);writeState("cursor",now.toString());db.setTransactionSuccessful()}finally{db.endTransaction()}}
 fun add(row:JSONObject){val db=writableDatabase;val day=row.getString("day");val pkg=row.getString("package");db.execSQL("INSERT OR IGNORE INTO buckets(day,package,label) VALUES(?,?,?)",arrayOf(day,pkg,row.getString("label")));db.execSQL("UPDATE buckets SET ms=ms+? WHERE day=? AND package=?",arrayOf(row.getLong("ms"),day,pkg))}
 fun today(day:String):Map<String,Long> = readableDatabase.rawQuery("SELECT package,ms FROM buckets WHERE day=?",arrayOf(day)).use{c->buildMap{while(c.moveToNext())put(c.getString(0),c.getLong(1)/1000)}}
 fun pending():List<JSONObject> = readableDatabase.rawQuery("SELECT day,package,label,ms FROM buckets WHERE ms>sent ORDER BY day,package LIMIT 3000",null).use{c->buildList{while(c.moveToNext())add(JSONObject().put("day",c.getString(0)).put("package",c.getString(1)).put("label",c.getString(2)).put("ms",c.getLong(3)).put("seconds",(c.getLong(3)/1000).coerceAtMost(90000)))}}
 fun acknowledge(rows:List<JSONObject>,cutoff:String){val db=writableDatabase;db.beginTransaction();try{rows.forEach{db.execSQL("UPDATE buckets SET sent=MAX(sent,?) WHERE day=? AND package=?",arrayOf(it.getLong("ms"),it.getString("day"),it.getString("package")))};db.delete("buckets","day<? AND ms<=sent",arrayOf(cutoff));db.setTransactionSuccessful()}finally{db.endTransaction()}}
}

package app.tuto.mobile.screentime
import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit
class ScreenSyncWorker(context:Context,params:WorkerParameters):CoroutineWorker(context,params) {
 override suspend fun doWork():Result=try {ScreenStore(applicationContext).sync();Result.success()}catch(e:Exception){Result.retry()}
 companion object {fun schedule(context:Context) {WorkManager.getInstance(context).enqueueUniquePeriodicWork("screen-sync",ExistingPeriodicWorkPolicy.KEEP,PeriodicWorkRequestBuilder<ScreenSyncWorker>(15,TimeUnit.MINUTES).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())}}
}

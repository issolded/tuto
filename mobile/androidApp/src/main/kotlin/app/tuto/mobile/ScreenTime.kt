package app.tuto.mobile

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import app.tuto.core.ScreenTimePort
import java.time.LocalDate
import java.time.ZoneId

class AndroidScreenTime(private val context: Context) : ScreenTimePort {
    @Suppress("DEPRECATION")
    override fun hasUsagePermission(): Boolean {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        return ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
    }
    override fun measuredMinutesToday(packageName: String): Long? {
        if (!hasUsagePermission()) return null
        val start = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val stats = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        // Aggregate stats are device-reported and can be delayed. Not an enforcement timer.
        return stats.queryAndAggregateUsageStats(start, System.currentTimeMillis())[packageName]?.totalTimeInForeground?.div(60_000) ?: 0L
    }
}
@Composable fun ScreenTime(vm: MobileState) {
    val context = LocalContext.current
    val service = remember { AndroidScreenTime(context) }
    var allowed by remember { mutableStateOf(service.hasUsagePermission()) }
    var minutes by remember { mutableStateOf<Long?>(null) }
    Text(vm.text("Ekran zamanı", "Screen time"), fontSize = 32.sp, fontWeight = FontWeight.Black)
    Text(vm.text("Ebeveyninle birlikte ayarla", "Set this up with your parent"), fontSize = 20.sp)
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(vm.text("Bu cihazdaki Roblox kullanımı", "Roblox use on this device"), fontWeight = FontWeight.Bold)
            Text(minutes?.let { vm.text("Bugün yaklaşık $it dakika", "About $it minutes today") } ?: vm.text("Henüz ölçüm okunmadı", "No measurement read yet"), fontSize = 24.sp)
            if (!allowed) Button(onClick = { context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }) { Text(vm.text("Kullanım erişimi ayarını aç", "Open usage access settings")) }
            OutlinedButton(onClick = { allowed = service.hasUsagePermission(); minutes = runCatching { service.measuredMinutesToday("com.roblox.client") }.getOrNull() }) { Text(vm.text("Ölçümü yenile", "Refresh measurement")) }
            Text(vm.text("Android'in yaklaşık kullanım kaydıdır; geç güncellenebilir. Diğer cihazları kapsamaz. Bu sürüm uygulama engellemez veya Roblox'a süre yüklemez.", "Android's approximate usage record may update late. Other devices are not included. This version does not block apps or add time to Roblox."))
        }
    }
}

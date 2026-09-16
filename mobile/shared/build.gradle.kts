plugins { kotlin("multiplatform"); id("com.android.library") }
kotlin {
    androidTarget()
    jvm()
    if (System.getProperty("os.name").contains("Mac")) {
        listOf(iosArm64(), iosSimulatorArm64()).forEach {
            it.binaries.framework { baseName = "TutoCore"; isStatic = true }
        }
    }
    sourceSets { commonTest.dependencies { implementation(kotlin("test")) } }
}
android { namespace = "app.tuto.core"; compileSdk = 35; defaultConfig { minSdk = 26 } }

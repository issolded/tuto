plugins { id("com.android.application"); kotlin("android"); id("org.jetbrains.kotlin.plugin.compose") }
android {
    namespace = "app.tuto.mobile"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.tuto.mobile.preview"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.3.0-native"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // The same Express server the web app talks to. Override with -PtutoServer=... for staging.
        val server = (project.findProperty("tutoServer") as String?) ?: "https://tuto-production-d1db.up.railway.app"
        buildConfigField("String", "SERVER_URL", "\"$server\"")
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    // The maths engine is a JavaScript file; keep it readable in the APK rather than compressed.
    androidResources { noCompress += listOf("js") }
}
dependencies {
    implementation(project(":shared"))
    implementation(platform("androidx.compose:compose-bom:2025.04.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    // Tuto and the task icons (design/native-icons).
    implementation("com.airbnb.android:lottie-compose:6.7.1")
    // Runs the web app's own maths engine (mobile/engine). alpha13 is the last build made with a
    // Kotlin this project's compiler can read; later ones need Kotlin 2.3.
    implementation("io.github.dokar3:quickjs-kt-android:1.0.0-alpha13")
    // Draws the maths figures the engine renders as SVG.
    implementation("com.caverock:androidsvg-aar:1.4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    androidTestImplementation(platform("androidx.compose:compose-bom:2025.04.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

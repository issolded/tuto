plugins { id("com.android.application"); kotlin("android"); id("org.jetbrains.kotlin.plugin.compose") }
// Keep the alpha13 Kotlin/JNI API; rebuild its native library with a modern NDK.
// Only classes.jar is imported, so the old 4 KiB .so cannot enter the APK.
val quickJsAar by configurations.creating { isTransitive = false }
val quickJsClasses = tasks.register<Copy>("prepareQuickJsClasses") {
    from({ zipTree(quickJsAar.singleFile) }) { include("classes.jar"); rename { "quickjs.jar" } }
    into(layout.buildDirectory.dir("quickjs-classes"))
}
android {
    namespace = "app.tuto.mobile"
    compileSdk = 35
    ndkVersion = "28.0.13004108"
    defaultConfig {
        applicationId = "app.tuto.mobile.preview"
        minSdk = 26
        targetSdk = 35
        versionCode = 11
        versionName = "0.8.0-interactive-hints"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64", "x86") }
        externalNativeBuild { cmake { arguments += "-DCMAKE_BUILD_TYPE=MinSizeRel" } }
        // The same Express server the web app talks to. Override with -PtutoServer=... for staging.
        val server = (project.findProperty("tutoServer") as String?) ?: "https://tuto-production-d1db.up.railway.app"
        buildConfigField("String", "SERVER_URL", "\"$server\"")
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    // The maths engine is a JavaScript file; keep it readable in the APK rather than compressed.
    androidResources { noCompress += listOf("js") }
    externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt"); version = "3.22.1" } }
}
dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation(project(":shared"))
    implementation(platform("androidx.compose:compose-bom:2025.04.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    // Tuto and the task icons (design/native-icons).
    implementation("com.airbnb.android:lottie-compose:6.7.1")
    quickJsAar("io.github.dokar3:quickjs-kt-android:1.0.0-alpha13@aar")
    implementation(files(layout.buildDirectory.file("quickjs-classes/quickjs.jar")).builtBy(quickJsClasses))
    // Draws the maths figures the engine renders as SVG.
    implementation("com.caverock:androidsvg-aar:1.4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    androidTestImplementation(platform("androidx.compose:compose-bom:2025.04.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}

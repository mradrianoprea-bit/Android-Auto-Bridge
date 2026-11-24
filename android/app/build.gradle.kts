import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) {
        keystorePropsFile.inputStream().use { load(it) }
    }
}

android {
    namespace = "ro.autobridge.applecall"
    compileSdk = 35

    defaultConfig {
        applicationId = "ro.autobridge.applecall"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "DEFAULT_APPLE_NUMBER", "\"+40 722 450 890\"")
        buildConfigField("String", "DEFAULT_ANDROID_NUMBER", "\"+40 744 112 300\"")
        buildConfigField("String", "DEFAULT_APPLE_DEVICE_NAME", "\"iPhone 15 Pro — Adrian\"")
        buildConfigField("int", "DEFAULT_RSSI_THRESHOLD", "-72")
        buildConfigField("String", "DEFAULT_BRIDGE_MODE", "\"ios_shortcut_forwarding\"")
        buildConfigField("boolean", "DEFAULT_AUTO_ANSWER", "false")
        buildConfigField("int", "DEFAULT_AUTO_ANSWER_DELAY_SEC", "3")
        buildConfigField("boolean", "DEFAULT_AUTO_REVERT", "true")
        buildConfigField("boolean", "DEFAULT_STRICT_MATCH", "true")
    }

    signingConfigs {
        create("release") {
            val storePath = System.getenv("KEYSTORE_FILE")
                ?: keystoreProps.getProperty("storeFile")
                ?: "release-keystore.jks"
            val storePass = System.getenv("KEYSTORE_PASSWORD")
                ?: keystoreProps.getProperty("storePassword")
                ?: ""
            val aliasName = System.getenv("KEY_ALIAS")
                ?: keystoreProps.getProperty("keyAlias")
                ?: "autobridge-release"
            val keyPass = System.getenv("KEY_PASSWORD")
                ?: keystoreProps.getProperty("keyPassword")
                ?: storePass

            if (file(storePath).exists() && storePass.isNotBlank()) {
                storeFile = file(storePath)
                storePassword = storePass
                keyAlias = aliasName
                keyPassword = keyPass
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val releaseSign = signingConfigs.getByName("release")
            if (releaseSign.storeFile != null) {
                signingConfig = releaseSign
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    lint {
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Jetpack Compose Material 3
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")

    // Android Auto Car App Library (CarConnection + CarAppService)
    implementation("androidx.car.app:app:1.4.0")

    // Coroutines pentru orchestrare BLE + Android Auto
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}

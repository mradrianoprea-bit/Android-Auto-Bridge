import { BridgeConfig, ProjectFile } from '../types/bridge';

export function sanitizeVersionTag(versionName: string): string {
  return versionName.trim().replace(/[^a-zA-Z0-9._-]/g, '') || '1.0.0';
}

function sanitizePackageName(appId: string): string {
  const segments = appId
    .trim()
    .toLowerCase()
    .split('.')
    .map((seg) => seg.replace(/[^a-z0-9_]/g, '').replace(/^[0-9]+/, ''))
    .filter(Boolean);
  if (segments.length < 2) {
    return 'ro.autobridge.applecall';
  }
  return segments.join('.');
}

function sanitizePackagePath(appId: string): string {
  return sanitizePackageName(appId).replace(/\./g, '/');
}

function escapeKotlinString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/\r?\n/g, ' ');
}

function escapeBuildConfigString(value: string): string {
  const javaEscaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
  return escapeKotlinString(`"${javaEscaped}"`);
}

function escapeXmlString(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

function escapeBashDoubleQuoted(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/\r?\n/g, ' ');
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function generateAndroidProjectFiles(config: BridgeConfig): ProjectFile[] {
  const pkg = sanitizePackageName(config.applicationId);
  const pkgPath = sanitizePackagePath(config.applicationId);
  const versionTag = sanitizeVersionTag(config.versionName);
  const safeVersionCode = Math.max(1, Math.floor(Number(config.versionCode) || 1));
  const rawAppleNum = config.applePhoneNumber.trim();
  const appleNum = escapeKotlinString(rawAppleNum);
  const appleNumClean = normalizePhone(config.applePhoneNumber);
  const rawAndroidNum = config.androidPhoneNumber.trim();
  const androidNumClean = normalizePhone(config.androidPhoneNumber);
  const rawAppleDevice = config.appleDeviceName.trim();
  const rawAppName = config.appDisplayName.trim() || 'AutoBridge AA';
  const appNameKotlin = escapeKotlinString(rawAppName);
  const appNameXml = escapeXmlString(rawAppName);
  const aliasKotlin = escapeKotlinString(config.keystoreAlias.trim() || 'autobridge-release');
  const aliasBash = escapeBashDoubleQuoted(config.keystoreAlias.trim() || 'autobridge-release');
  const orgBash = escapeBashDoubleQuoted(config.organizationName.trim() || 'AutoBridge Mobile');

  const files: ProjectFile[] = [
    {
      path: '.gitignore',
      language: 'properties',
      category: 'Gradle & Build',
      description: 'Previne încărcarea accidentală a cheilor de semnare și a fișierelor temporare Gradle în Git.',
      content: `.gradle/
build/
app/build/
dist/
local.properties
keystore.properties
*.jks
*.keystore
.idea/
*.iml
.DS_Store
`,
    },
    {
      path: 'settings.gradle.kts',
      language: 'gradle',
      category: 'Gradle & Build',
      description: 'Definirea depozitelor Maven/Google și a modulului :app.',
      content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "AutoBridgeAA"
include(":app")
`,
    },
    {
      path: 'build.gradle.kts',
      language: 'gradle',
      category: 'Gradle & Build',
      description: 'Configurația Gradle de nivel rădăcină (AGP 8.7.2 + Kotlin 2.0.21).',
      content: `plugins {
    id("com.android.application") version "8.7.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}
`,
    },
    {
      path: 'gradle.properties',
      language: 'properties',
      category: 'Gradle & Build',
      description: 'Setări JVM, AndroidX și R8 pentru compilare release.',
      content: `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`,
    },
    {
      path: 'gradle/wrapper/gradle-wrapper.properties',
      language: 'properties',
      category: 'Gradle & Build',
      description: 'Versiunea recomandată Gradle (8.10.2) pentru deschidere directă în Android Studio.',
      content: `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,
    },
    {
      path: 'app/build.gradle.kts',
      language: 'gradle',
      category: 'Gradle & Build',
      description: 'Dependențe Android Auto Car App Library, Jetpack Compose și semnare APK Release.',
      content: `import java.util.Properties

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
    namespace = "${pkg}"
    compileSdk = 35

    defaultConfig {
        applicationId = "${pkg}"
        minSdk = 29
        targetSdk = 35
        versionCode = ${safeVersionCode}
        versionName = "${escapeKotlinString(versionTag)}"

        buildConfigField("String", "DEFAULT_APPLE_NUMBER", "${escapeBuildConfigString(rawAppleNum)}")
        buildConfigField("String", "DEFAULT_ANDROID_NUMBER", "${escapeBuildConfigString(rawAndroidNum)}")
        buildConfigField("String", "DEFAULT_APPLE_DEVICE_NAME", "${escapeBuildConfigString(rawAppleDevice)}")
        buildConfigField("int", "DEFAULT_RSSI_THRESHOLD", "${config.rssiThresholdDbm}")
        buildConfigField("String", "DEFAULT_BRIDGE_MODE", "${escapeBuildConfigString(config.bridgeMode)}")
        buildConfigField("boolean", "DEFAULT_AUTO_ANSWER", "${config.autoAnswerEnabled}")
        buildConfigField("int", "DEFAULT_AUTO_ANSWER_DELAY_SEC", "${config.autoAnswerDelaySec}")
        buildConfigField("boolean", "DEFAULT_AUTO_REVERT", "${config.autoRevertOnDisconnect}")
        buildConfigField("boolean", "DEFAULT_STRICT_MATCH", "${config.strictAppleNumberMatch}")
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
                ?: "${aliasKotlin}"
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
`,
    },
    {
      path: 'app/proguard-rules.pro',
      language: 'properties',
      category: 'Gradle & Build',
      description: 'Reguli R8/ProGuard pentru păstrarea serviciilor Android Auto, Telecom și a adnotărilor.',
      content: `-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class androidx.car.app.** { *; }
-keep class * extends androidx.car.app.CarAppService { *; }
-keep class ${pkg}.car.** { *; }
-keep class ${pkg}.telecom.** { *; }
-keep class ${pkg}.service.** { *; }
-dontwarn androidx.car.app.**
`,
    },
    {
      path: 'app/src/main/AndroidManifest.xml',
      language: 'xml',
      category: 'Manifest & Resurse',
      description: 'Permisiuni Bluetooth LE (API 29–35), Telecom, Foreground Service și declararea Android Auto CarAppService.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Bluetooth & BLE proximitate iPhone (Android 10-11 necesită ACCESS_FINE_LOCATION pentru scanare BLE) -->
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
    <uses-permission
        android:name="android.permission.BLUETOOTH_SCAN"
        android:usesPermissionFlags="neverForLocation"
        tools:targetApi="s" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />

    <!-- Telecom & gestionare preluare apeluri pe Android Auto -->
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.READ_CALL_LOG" />
    <uses-permission android:name="android.permission.ANSWER_PHONE_CALLS" />
    <uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
    <uses-permission android:name="android.permission.CALL_PHONE" />

    <!-- Serviciu persistent în fundal & notificări -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />

    <application
        android:allowBackup="false"
        android:icon="@drawable/ic_launcher"
        android:roundIcon="@drawable/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.Light.NoActionBar">

        <!-- Metadate Android Auto -->
        <meta-data
            android:name="com.google.android.gms.car.application"
            android:resource="@xml/automotive_app_desc" />
        <meta-data
            android:name="androidx.car.app.minCarApiLevel"
            android:value="1" />

        <activity
            android:name=".ui.MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Serviciul principal de monitorizare Android Auto + proximitate Apple BLE -->
        <service
            android:name=".service.CallBridgeForegroundService"
            android:exported="false"
            android:foregroundServiceType="connectedDevice" />

        <!-- Serviciul Android Telecom pentru rutarea apelurilor preluate către sistemul audio al mașinii -->
        <service
            android:name=".telecom.BridgeConnectionService"
            android:exported="true"
            android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE">
            <intent-filter>
                <action android:name="android.telecom.ConnectionService" />
            </intent-filter>
        </service>

        <!-- Interfața nativă afișată pe ecranul mașinii (Android Auto) -->
        <service
            android:name=".car.AutoBridgeCarAppService"
            android:exported="true">
            <intent-filter>
                <action android:name="androidx.car.app.CarAppService" />
                <category android:name="androidx.car.app.category.IOT" />
            </intent-filter>
        </service>
    </application>
</manifest>
`,
    },
    {
      path: 'app/src/main/res/drawable/ic_launcher.xml',
      language: 'xml',
      category: 'Manifest & Resurse',
      description: 'Pictogramă vectorială necesară launcher-ului Android și barei Android Auto (Action.APP_ICON).',
      content: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#2563EB"
        android:pathData="M0,0h108v108h-108z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M34,30C34,27.8 35.8,26 38,26H46C48,26 49.7,27.4 50,29.4L52.2,40.4C52.5,42 51.8,43.7 50.4,44.6L45.1,48.1C47.8,53.9 52.5,58.6 58.3,61.3L61.8,56C62.7,54.6 64.4,53.9 66,54.2L77,56.4C79,56.8 80.4,58.5 80.4,60.5V68.5C80.4,70.7 78.6,72.5 76.4,72.5C52.9,72.5 34,53.5 34,30Z" />
</vector>
`,
    },
    {
      path: 'app/src/main/res/xml/automotive_app_desc.xml',
      language: 'xml',
      category: 'Manifest & Resurse',
      description: 'Descriptorul Android Auto care declară suportul de proiecție template.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="template" />
</automotiveApp>
`,
    },
    {
      path: 'app/src/main/res/values/strings.xml',
      language: 'xml',
      category: 'Manifest & Resurse',
      description: 'Resurse text ale aplicației în limba română (escape XML valid).',
      content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${appNameXml}</string>
    <string name="channel_bridge_name">Serviciu Android Auto Call Bridge</string>
    <string name="channel_bridge_desc">Monitorizează conectarea la Android Auto și proximitatea iPhone-ului setat.</string>
</resources>
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/data/BridgePreferences.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Stocarea persistentă a numărului Apple, pragului RSSI și preferințelor de preluare.',
      content: `package ${pkg}.data

import android.content.Context
import ${pkg}.BuildConfig

data class BridgeSettings(
    val applePhoneNumber: String = BuildConfig.DEFAULT_APPLE_NUMBER,
    val androidPhoneNumber: String = BuildConfig.DEFAULT_ANDROID_NUMBER,
    val appleDeviceName: String = BuildConfig.DEFAULT_APPLE_DEVICE_NAME,
    val rssiThresholdDbm: Int = BuildConfig.DEFAULT_RSSI_THRESHOLD,
    val bridgeMode: String = BuildConfig.DEFAULT_BRIDGE_MODE,
    val autoAnswerEnabled: Boolean = BuildConfig.DEFAULT_AUTO_ANSWER,
    val autoAnswerDelaySec: Int = BuildConfig.DEFAULT_AUTO_ANSWER_DELAY_SEC,
    val autoRevertOnDisconnect: Boolean = BuildConfig.DEFAULT_AUTO_REVERT,
    val strictAppleNumberMatch: Boolean = BuildConfig.DEFAULT_STRICT_MATCH
)

class BridgePreferences(context: Context) {
    private val prefs = context.getSharedPreferences("autobridge_prefs", Context.MODE_PRIVATE)

    fun load(): BridgeSettings = BridgeSettings(
        applePhoneNumber = prefs.getString("apple_phone", BuildConfig.DEFAULT_APPLE_NUMBER)
            ?: BuildConfig.DEFAULT_APPLE_NUMBER,
        androidPhoneNumber = prefs.getString("android_phone", BuildConfig.DEFAULT_ANDROID_NUMBER)
            ?: BuildConfig.DEFAULT_ANDROID_NUMBER,
        appleDeviceName = prefs.getString("apple_device", BuildConfig.DEFAULT_APPLE_DEVICE_NAME)
            ?: BuildConfig.DEFAULT_APPLE_DEVICE_NAME,
        rssiThresholdDbm = prefs.getInt("rssi_threshold", BuildConfig.DEFAULT_RSSI_THRESHOLD),
        bridgeMode = prefs.getString("bridge_mode", BuildConfig.DEFAULT_BRIDGE_MODE)
            ?: BuildConfig.DEFAULT_BRIDGE_MODE,
        autoAnswerEnabled = prefs.getBoolean("auto_answer", BuildConfig.DEFAULT_AUTO_ANSWER),
        autoAnswerDelaySec = prefs.getInt("auto_answer_delay", BuildConfig.DEFAULT_AUTO_ANSWER_DELAY_SEC),
        autoRevertOnDisconnect = prefs.getBoolean("auto_revert", BuildConfig.DEFAULT_AUTO_REVERT),
        strictAppleNumberMatch = prefs.getBoolean("strict_match", BuildConfig.DEFAULT_STRICT_MATCH)
    )

    fun save(settings: BridgeSettings) {
        prefs.edit()
            .putString("apple_phone", settings.applePhoneNumber.trim())
            .putString("android_phone", settings.androidPhoneNumber.trim())
            .putString("apple_device", settings.appleDeviceName.trim())
            .putInt("rssi_threshold", settings.rssiThresholdDbm)
            .putString("bridge_mode", settings.bridgeMode)
            .putBoolean("auto_answer", settings.autoAnswerEnabled)
            .putInt("auto_answer_delay", settings.autoAnswerDelaySec)
            .putBoolean("auto_revert", settings.autoRevertOnDisconnect)
            .putBoolean("strict_match", settings.strictAppleNumberMatch)
            .apply()
    }
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/car/AndroidAutoMonitor.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Detectează în timp real conectarea și deconectarea de la Android Auto prin androidx.car.app.connection.CarConnection.',
      content: `package ${pkg}.car

import android.content.Context
import androidx.car.app.connection.CarConnection
import androidx.lifecycle.Observer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class CarProjectionState {
    DISCONNECTED,
    ANDROID_AUTO_PROJECTED,
    AUTOMOTIVE_NATIVE
}

class AndroidAutoMonitor(context: Context) {
    private val carConnection = CarConnection(context.applicationContext)
    private val _state = MutableStateFlow(CarProjectionState.DISCONNECTED)
    val state: StateFlow<CarProjectionState> = _state.asStateFlow()

    private val observer = Observer<Int> { connectionType ->
        _state.value = when (connectionType) {
            CarConnection.CONNECTION_TYPE_PROJECTION -> CarProjectionState.ANDROID_AUTO_PROJECTED
            CarConnection.CONNECTION_TYPE_NATIVE -> CarProjectionState.AUTOMOTIVE_NATIVE
            else -> CarProjectionState.DISCONNECTED
        }
    }

    fun start() {
        carConnection.type.observeForever(observer)
    }

    fun stop() {
        carConnection.type.removeObserver(observer)
    }

    fun isConnected(): Boolean = _state.value != CarProjectionState.DISCONNECTED
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/bluetooth/AppleProximityScanner.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Scanează pachetele BLE Apple Continuity (Company ID 0x004C) cu verificare permisiuni API 29–35 și medie mobilă RSSI.',
      content: `package ${pkg}.bluetooth

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AppleProximitySnapshot(
    val detected: Boolean = false,
    val inCabinRange: Boolean = false,
    val rssiDbm: Int = -120,
    val deviceLabel: String = "",
    val lastSeenEpochMs: Long = 0L
)

class AppleProximityScanner(
    private val context: Context,
    private val targetDeviceNameProvider: () -> String,
    private val rssiThresholdProvider: () -> Int
) {
    companion object {
        // Apple Inc. Bluetooth SIG Company Identifier (0x004C)
        const val APPLE_MANUFACTURER_ID = 0x004C
        private const val STALE_TIMEOUT_MS = 12_000L
    }

    private val _snapshot = MutableStateFlow(AppleProximitySnapshot())
    val snapshot: StateFlow<AppleProximitySnapshot> = _snapshot.asStateFlow()

    private val rssiWindow = ArrayDeque<Int>(5)
    private var isScanning = false

    fun hasScanPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        }
    }

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val record = result.scanRecord ?: return
            val hasAppleManufacturerData = record.getManufacturerSpecificData(APPLE_MANUFACTURER_ID) != null
            val advertisedName = try {
                result.device?.name ?: record.deviceName ?: ""
            } catch (_: SecurityException) {
                record.deviceName ?: ""
            }
            val targetName = targetDeviceNameProvider().trim()

            val matchesTarget = when {
                targetName.isNotEmpty() && advertisedName.equals(targetName, ignoreCase = true) -> true
                hasAppleManufacturerData && (advertisedName.isEmpty() || advertisedName.contains("iPhone", ignoreCase = true)) -> true
                else -> false
            }

            if (!matchesTarget) return

            if (rssiWindow.size >= 5) rssiWindow.removeFirst()
            rssiWindow.addLast(result.rssi)
            val smoothedRssi = rssiWindow.average().toInt()
            val threshold = rssiThresholdProvider()

            _snapshot.value = AppleProximitySnapshot(
                detected = true,
                inCabinRange = smoothedRssi >= threshold,
                rssiDbm = smoothedRssi,
                deviceLabel = advertisedName.ifBlank { targetName.ifBlank { "Apple iPhone (BLE 0x004C)" } },
                lastSeenEpochMs = System.currentTimeMillis()
            )
        }
    }

    @SuppressLint("MissingPermission")
    fun startScanning() {
        if (isScanning || !hasScanPermission()) return
        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
        val scanner = btManager.adapter?.bluetoothLeScanner ?: return

        val appleFilter = ScanFilter.Builder()
            .setManufacturerData(APPLE_MANUFACTURER_ID, byteArrayOf())
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        try {
            scanner.startScan(listOf(appleFilter), settings, scanCallback)
            isScanning = true
        } catch (_: SecurityException) {
            isScanning = false
        }
    }

    @SuppressLint("MissingPermission")
    fun stopScanning() {
        if (!isScanning) return
        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
        try {
            btManager.adapter?.bluetoothLeScanner?.stopScan(scanCallback)
        } catch (_: SecurityException) {
            // Ignoră dacă permisiunea a fost revocată
        }
        isScanning = false
        rssiWindow.clear()
        _snapshot.value = AppleProximitySnapshot()
    }

    fun pruneStale() {
        val current = _snapshot.value
        if (current.detected && System.currentTimeMillis() - current.lastSeenEpochMs > STALE_TIMEOUT_MS) {
            _snapshot.value = current.copy(detected = false, inCabinRange = false, rssiDbm = -120)
        }
    }
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/telecom/BridgeConnectionService.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Integrează apelurile preluate de la numărul Apple configurat cu Android Telecom și sistemul audio Android Auto.',
      content: `package ${pkg}.telecom

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.telecom.CallAudioState
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager

class BridgeConnectionService : ConnectionService() {

    companion object {
        const val ACCOUNT_ID = "autobridge_apple_call_account"
        const val EXTRA_APPLE_SOURCE_NUMBER = "extra_apple_source_number"
        private val NON_PHONE_CHARS = Regex("""[^\\d+]""")

        fun phoneAccountHandle(context: Context): PhoneAccountHandle {
            return PhoneAccountHandle(
                ComponentName(context, BridgeConnectionService::class.java),
                ACCOUNT_ID
            )
        }

        fun registerPhoneAccount(context: Context) {
            val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return
            try {
                val account = PhoneAccount.builder(phoneAccountHandle(context), "${appNameKotlin} (iPhone)")
                    .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                    .setShortDescription("Preluare apeluri iPhone pe Android Auto")
                    .build()
                telecom.registerPhoneAccount(account)
            } catch (_: SecurityException) {
                // Contul Telecom necesită permisiunea MANAGE_OWN_CALLS
            }
        }

        fun normalizePhoneNumber(raw: String): String = raw.replace(NON_PHONE_CHARS, "")

        fun matchesConfiguredAppleNumber(incoming: String, configured: String): Boolean {
            val a = normalizePhoneNumber(incoming)
            val b = normalizePhoneNumber(configured)
            if (a.isEmpty() || b.isEmpty()) return false
            return a == b || a.endsWith(b.takeLast(9)) || b.endsWith(a.takeLast(9))
        }
    }

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest
    ): Connection {
        val callerUri = request.address ?: Uri.fromParts(PhoneAccount.SCHEME_TEL, "${appleNumClean}", null)
        val appleSource = request.extras?.getString(EXTRA_APPLE_SOURCE_NUMBER) ?: "${appleNum}"

        return BridgeCallConnection(appleSource).apply {
            setAddress(callerUri, TelecomManager.PRESENTATION_ALLOWED)
            setCallerDisplayName("iPhone • $appleSource", TelecomManager.PRESENTATION_ALLOWED)
            connectionProperties = Connection.PROPERTY_SELF_MANAGED
            audioModeIsVoip = true
            setRinging()
        }
    }

    class BridgeCallConnection(
        private val sourceAppleNumber: String
    ) : Connection() {

        @Suppress("DEPRECATION")
        override fun onAnswer() {
            setActive()
            setAudioRoute(CallAudioState.ROUTE_BLUETOOTH)
        }

        override fun onReject() {
            setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
            destroy()
        }

        override fun onDisconnect() {
            setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
            destroy()
        }

        @Suppress("DEPRECATION")
        override fun onCallAudioStateChanged(state: CallAudioState?) {
            super.onCallAudioStateChanged(state)
            if (state != null && state.route != CallAudioState.ROUTE_BLUETOOTH) {
                setAudioRoute(CallAudioState.ROUTE_BLUETOOTH)
            }
        }
    }
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/service/CallBridgeForegroundService.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Orchestrează Android Auto + proximitatea Apple BLE, semnalizarea GATT iOS și compatibilitatea Foreground Service API 34/35.',
      content: `package ${pkg}.service

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.ParcelUuid
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import ${pkg}.R
import ${pkg}.bluetooth.AppleProximityScanner
import ${pkg}.car.AndroidAutoMonitor
import ${pkg}.car.CarProjectionState
import ${pkg}.data.BridgePreferences
import ${pkg}.telecom.BridgeConnectionService
import java.util.UUID

data class BridgeRuntimeState(
    val carState: CarProjectionState = CarProjectionState.DISCONNECTED,
    val appleDetected: Boolean = false,
    val appleInRange: Boolean = false,
    val rssiDbm: Int = -120,
    val bridgeActive: Boolean = false,
    val targetAppleNumber: String = "${appleNum}"
)

class CallBridgeForegroundService : LifecycleService() {

    companion object {
        private const val CHANNEL_ID = "autobridge_channel"
        private const val NOTIFICATION_ID = 4201
        // UUID BLE semnalizare către automatizarea iOS Shortcuts / Apple Companion
        val BRIDGE_TRIGGER_SERVICE_UUID: UUID = UUID.fromString("7E4A1000-4B1C-4A2A-9F01-AA0000002101")

        private val _runtimeState = MutableStateFlow(BridgeRuntimeState())
        val runtimeState: StateFlow<BridgeRuntimeState> = _runtimeState.asStateFlow()

        fun hasRequiredBluetoothPermissions(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
                    PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) ==
                    PackageManager.PERMISSION_GRANTED
            } else {
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                    PackageManager.PERMISSION_GRANTED
            }
        }

        fun start(context: Context) {
            if (!hasRequiredBluetoothPermissions(context)) return
            val intent = Intent(context, CallBridgeForegroundService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (_: SecurityException) {
                // Permisiunile connectedDevice nu au fost încă acordate
            }
        }
    }

    private lateinit var preferences: BridgePreferences
    private lateinit var autoMonitor: AndroidAutoMonitor
    private lateinit var proximityScanner: AppleProximityScanner
    private var gattServer: BluetoothGattServer? = null
    private var advertisingActive = false

    override fun onCreate() {
        super.onCreate()
        preferences = BridgePreferences(this)
        BridgeConnectionService.registerPhoneAccount(this)
        createNotificationChannel()

        val initialNotification = buildNotification("Se monitorizează Android Auto...")
        val fgsType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        } else {
            0
        }
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, initialNotification, fgsType)
        } catch (_: SecurityException) {
            stopSelf()
            return
        }

        autoMonitor = AndroidAutoMonitor(this)
        proximityScanner = AppleProximityScanner(
            context = this,
            targetDeviceNameProvider = { preferences.load().appleDeviceName },
            rssiThresholdProvider = { preferences.load().rssiThresholdDbm }
        )

        autoMonitor.start()
        proximityScanner.startScanning()

        lifecycleScope.launch {
            while (true) {
                proximityScanner.pruneStale()
                delay(3_000L)
            }
        }

        lifecycleScope.launch {
            combine(autoMonitor.state, proximityScanner.snapshot) { car, apple ->
                val cfg = preferences.load()
                val shouldActivateBridge = (car != CarProjectionState.DISCONNECTED) && apple.inCabinRange
                BridgeRuntimeState(
                    carState = car,
                    appleDetected = apple.detected,
                    appleInRange = apple.inCabinRange,
                    rssiDbm = apple.rssiDbm,
                    bridgeActive = shouldActivateBridge,
                    targetAppleNumber = cfg.applePhoneNumber
                )
            }.collect { state ->
                val previouslyActive = _runtimeState.value.bridgeActive
                _runtimeState.value = state

                if (state.bridgeActive && !previouslyActive) {
                    activateIosBridgeSignal()
                } else if (!state.bridgeActive && previouslyActive && preferences.load().autoRevertOnDisconnect) {
                    deactivateIosBridgeSignal()
                }

                updateNotification(state)
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun activateIosBridgeSignal() {
        // Anunță serviciul GATT BLE pentru ca iPhone-ul aflat în proximitate să activeze redirecționarea (*21*${androidNumClean}#)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_ADVERTISE) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val btManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
        val advertiser = btManager.adapter?.bluetoothLeAdvertiser ?: return
        if (advertisingActive) return

        try {
            val service = BluetoothGattService(
                BRIDGE_TRIGGER_SERVICE_UUID,
                BluetoothGattService.SERVICE_TYPE_PRIMARY
            )
            gattServer = btManager.openGattServer(this, object : BluetoothGattServerCallback() {})
            gattServer?.addService(service)

            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
                .setConnectable(true)
                .build()
            val data = AdvertiseData.Builder()
                .addServiceUuid(ParcelUuid(BRIDGE_TRIGGER_SERVICE_UUID))
                .build()

            advertiser.startAdvertising(settings, data, advertiseCallback)
            advertisingActive = true
        } catch (_: SecurityException) {
            // Permisiunea BLUETOOTH_ADVERTISE nu a fost acordată încă
        }
    }

    @SuppressLint("MissingPermission")
    private fun deactivateIosBridgeSignal() {
        val btManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
        try {
            if (advertisingActive) {
                btManager.adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
                advertisingActive = false
            }
            gattServer?.close()
            gattServer = null
        } catch (_: SecurityException) {
            // Ignoră dacă permisiunea a fost revocată
        }
    }

    private val advertiseCallback = object : AdvertiseCallback() {}

    override fun onDestroy() {
        deactivateIosBridgeSignal()
        if (::proximityScanner.isInitialized) proximityScanner.stopScanning()
        if (::autoMonitor.isInitialized) autoMonitor.stop()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_bridge_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.channel_bridge_desc)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(statusText: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setContentTitle("${appNameKotlin}")
            .setContentText(statusText)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(state: BridgeRuntimeState) {
        val text = when {
            state.bridgeActive -> "Activ pe Android Auto • Apeluri preluate de pe \${state.targetAppleNumber}"
            state.carState != CarProjectionState.DISCONNECTED -> "Android Auto conectat • Se caută iPhone în apropiere..."
            else -> "În așteptare conexiune Android Auto"
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm?.notify(NOTIFICATION_ID, buildNotification(text))
    }
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/car/AutoBridgeCarAppService.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Aplicația nativă afișată pe ecranul mașinii Android Auto cu actualizare automată la schimbarea proximității BLE.',
      content: `package ${pkg}.car

import android.content.Intent
import androidx.car.app.CarAppService
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.Session
import androidx.car.app.model.Action
import androidx.car.app.model.Pane
import androidx.car.app.model.PaneTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.car.app.validation.HostValidator
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import ${pkg}.data.BridgePreferences
import ${pkg}.service.CallBridgeForegroundService

class AutoBridgeCarAppService : CarAppService() {
    override fun createHostValidator(): HostValidator = HostValidator.ALLOW_ALL_HOSTS_VALIDATOR

    override fun onCreateSession(): Session {
        CallBridgeForegroundService.start(applicationContext)
        return object : Session() {
            override fun onCreateScreen(intent: Intent): Screen = AutoBridgeCarScreen(carContext)
        }
    }
}

class AutoBridgeCarScreen(carContext: CarContext) : Screen(carContext) {

    init {
        lifecycleScope.launch {
            CallBridgeForegroundService.runtimeState.collectLatest {
                invalidate()
            }
        }
    }

    @Suppress("DEPRECATION")
    override fun onGetTemplate(): Template {
        val runtime = CallBridgeForegroundService.runtimeState.value
        val settings = BridgePreferences(carContext).load()

        val statusTitle = if (runtime.bridgeActive) {
            "Preluare apeluri iPhone activă"
        } else {
            "Se caută telefonul Apple în apropiere"
        }

        val pane = Pane.Builder()
            .addRow(
                Row.Builder()
                    .setTitle("Număr Apple monitorizat")
                    .addText(settings.applePhoneNumber)
                    .build()
            )
            .addRow(
                Row.Builder()
                    .setTitle("Proximitate Bluetooth LE")
                    .addText(
                        if (runtime.appleInRange) {
                            "În habitaclu (\${runtime.rssiDbm} dBm)"
                        } else {
                            "Indisponibil sau prea departe"
                        }
                    )
                    .build()
            )
            .addAction(
                Action.Builder()
                    .setTitle("Actualizează starea")
                    .setOnClickListener { invalidate() }
                    .build()
            )
            .build()

        return PaneTemplate.Builder(pane)
            .setTitle("${appNameKotlin} — $statusTitle")
            .setHeaderAction(Action.APP_ICON)
            .build()
    }
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/ui/MainActivity.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Interfața Jetpack Compose de pe telefonul Android pentru configurarea completă (număr Apple, prag RSSI, răspuns automat) și permisiuni.',
      content: `package ${pkg}.ui

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ${pkg}.data.BridgePreferences
import ${pkg}.service.CallBridgeForegroundService
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        if (CallBridgeForegroundService.hasRequiredBluetoothPermissions(this)) {
            CallBridgeForegroundService.start(this)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val preferences = BridgePreferences(this)

        requestRuntimePermissions()

        setContent {
            MaterialTheme {
                var settings by remember { mutableStateOf(preferences.load()) }
                val runtime by CallBridgeForegroundService.runtimeState.collectAsState()
                var savedMessage by remember { mutableStateOf<String?>(null) }

                Surface(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = "${appNameKotlin}",
                            style = MaterialTheme.typography.headlineSmall
                        )
                        Text(
                            text = if (runtime.bridgeActive) {
                                "Activ pe Android Auto • iPhone în proximitate (\${runtime.rssiDbm} dBm)"
                            } else {
                                "Stare Android Auto: \${runtime.carState.name}"
                            },
                            style = MaterialTheme.typography.bodyMedium
                        )

                        OutlinedTextField(
                            value = settings.applePhoneNumber,
                            onValueChange = { settings = settings.copy(applePhoneNumber = it) },
                            label = { Text("Număr telefon Apple (iPhone)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = settings.androidPhoneNumber,
                            onValueChange = { settings = settings.copy(androidPhoneNumber = it) },
                            label = { Text("Număr telefon Android (Android Auto)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = settings.appleDeviceName,
                            onValueChange = { settings = settings.copy(appleDeviceName = it) },
                            label = { Text("Nume Bluetooth iPhone") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = "Prag proximitate BLE: \${settings.rssiThresholdDbm} dBm",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Slider(
                                value = settings.rssiThresholdDbm.toFloat(),
                                onValueChange = {
                                    settings = settings.copy(rssiThresholdDbm = it.roundToInt())
                                },
                                valueRange = -86f..-55f
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Răspuns automat hands-free",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Switch(
                                checked = settings.autoAnswerEnabled,
                                onCheckedChange = {
                                    settings = settings.copy(autoAnswerEnabled = it)
                                }
                            )
                        }

                        Button(
                            onClick = {
                                preferences.save(settings)
                                if (CallBridgeForegroundService.hasRequiredBluetoothPermissions(this@MainActivity)) {
                                    CallBridgeForegroundService.start(this@MainActivity)
                                    savedMessage = "Configurație salvată și serviciu activat."
                                } else {
                                    requestRuntimePermissions()
                                    savedMessage = "Configurație salvată. Acordă permisiunile Bluetooth pentru pornire."
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Salvează și pornește monitorizarea")
                        }

                        if (savedMessage != null) {
                            Text(text = savedMessage!!, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }

    private fun requestRuntimePermissions() {
        val perms = mutableListOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.ANSWER_PHONE_CALLS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms += listOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_ADVERTISE
            )
        } else {
            perms += Manifest.permission.ACCESS_FINE_LOCATION
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms += Manifest.permission.POST_NOTIFICATIONS
        }
        permissionLauncher.launch(perms.toTypedArray())
    }
}
`,
    },
    {
      path: 'build-signed-apk.sh',
      language: 'bash',
      category: 'Semnare & CI/CD',
      description: 'Script complet care generează cheia RSA-4096, compilează APK-ul release, aliniază cu zipalign și semnează/verifică cu apksigner.',
      content: `#!/usr/bin/env bash
set -euo pipefail

APP_VERSION="${escapeBashDoubleQuoted(versionTag)}"
KEYSTORE_PATH="app/release-keystore.jks"
KEY_ALIAS="${aliasBash}"
KEYSTORE_PASS="\${KEYSTORE_PASSWORD:-AutoBridge2026!}"
ORG_NAME="${orgBash}"
OUT_DIR="dist"
FINAL_APK="\${OUT_DIR}/AutoBridgeAA-v\${APP_VERSION}-signed.apk"

mkdir -p "\${OUT_DIR}"

# 1. Generează certificatul de semnare RSA-4096 dacă nu există
if [ ! -f "\${KEYSTORE_PATH}" ]; then
  echo "[1/4] Generare keystore de semnare (\${KEYSTORE_PATH})..."
  keytool -genkeypair -v \\
    -keystore "\${KEYSTORE_PATH}" \\
    -storetype PKCS12 \\
    -keyalg RSA \\
    -keysize 4096 \\
    -validity 10000 \\
    -alias "\${KEY_ALIAS}" \\
    -storepass "\${KEYSTORE_PASS}" \\
    -keypass "\${KEYSTORE_PASS}" \\
    -dname "CN=\${ORG_NAME}, OU=Mobile, O=\${ORG_NAME}, L=Bucuresti, C=RO"
fi

# 2. Scrie keystore.properties pentru Gradle release signingConfig
cat > keystore.properties <<EOF
storeFile=release-keystore.jks
storePassword=\${KEYSTORE_PASS}
keyAlias=\${KEY_ALIAS}
keyPassword=\${KEYSTORE_PASS}
EOF

# 3. Compilează APK-ul release (necesită JDK 17 + Android SDK 35)
echo "[2/4] Compilare Gradle assembleRelease..."
if [ -x "./gradlew" ]; then
  ./gradlew assembleRelease --no-daemon
else
  gradle assembleRelease --no-daemon
fi

UNSIGNED_OR_SIGNED="app/build/outputs/apk/release/app-release.apk"
if [ ! -f "\${UNSIGNED_OR_SIGNED}" ]; then
  UNSIGNED_OR_SIGNED="app/build/outputs/apk/release/app-release-unsigned.apk"
fi

if [ ! -f "\${UNSIGNED_OR_SIGNED}" ]; then
  echo "Eroare: nu a fost găsit APK-ul generat în app/build/outputs/apk/release/." >&2
  exit 1
fi

# 4. Aliniere și verificare / semnare apksigner (V1 + V2 + V3 + V4)
SDK_ROOT="\${ANDROID_HOME:-\${ANDROID_SDK_ROOT:-\$HOME/Android/Sdk}}"
BUILD_TOOLS_DIR="\$(ls -d "\${SDK_ROOT}"/build-tools/* 2>/dev/null | sort -V | tail -n 1 || true)"

if [ -z "\${BUILD_TOOLS_DIR}" ] || [ ! -x "\${BUILD_TOOLS_DIR}/apksigner" ]; then
  echo "Eroare: Android build-tools (zipalign/apksigner) nu au fost găsite în \${SDK_ROOT}/build-tools." >&2
  exit 1
fi

echo "[3/4] Aliniere zipalign și semnare apksigner (\${BUILD_TOOLS_DIR})..."
"\${BUILD_TOOLS_DIR}/zipalign" -f -p 4 "\${UNSIGNED_OR_SIGNED}" "\${OUT_DIR}/aligned.apk"
"\${BUILD_TOOLS_DIR}/apksigner" sign \\
  --ks "\${KEYSTORE_PATH}" \\
  --ks-key-alias "\${KEY_ALIAS}" \\
  --ks-pass "pass:\${KEYSTORE_PASS}" \\
  --key-pass "pass:\${KEYSTORE_PASS}" \\
  --out "\${FINAL_APK}" \\
  "\${OUT_DIR}/aligned.apk"

echo "[4/4] Verificare semnătură digitală APK..."
"\${BUILD_TOOLS_DIR}/apksigner" verify --verbose --print-certs "\${FINAL_APK}"
rm -f "\${OUT_DIR}/aligned.apk"

echo "Succes! APK compilat și semnat disponibil la: \${FINAL_APK}"
`,
    },
    {
      path: '.github/workflows/build-signed-apk.yml',
      language: 'yaml',
      category: 'Semnare & CI/CD',
      description: 'Pipeline GitHub Actions care instalează SDK 35 + Build Tools 35.0.0, compilează și semnează automat APK-ul în cloud.',
      content: `name: Compile & Sign AutoBridge AA APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-signed-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout proiect
        uses: actions/checkout@v4

      - name: Configurare JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Configurare Gradle 8.10.2
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.10.2'

      - name: Instalare Android SDK 35 & Build Tools 35.0.0
        uses: android-actions/setup-android@v3
        with:
          packages: 'platforms;android-35 build-tools;35.0.0'

      - name: Compilare și semnare APK Release
        env:
          KEYSTORE_PASSWORD: \${{ secrets.KEYSTORE_PASSWORD }}
        run: |
          chmod +x build-signed-apk.sh
          ./build-signed-apk.sh

      - name: Încarcă APK semnat ca Artifact descărcabil
        uses: actions/upload-artifact@v4
        with:
          name: AutoBridgeAA-v${versionTag}-signed-apk
          path: dist/*.apk
`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      category: 'Semnare & CI/CD',
      description: 'Documentație tehnică completă de compilare, semnare APK și configurare pe iPhone.',
      content: `# ${rawAppName} (v${versionTag})

Aplicație Android Kotlin care detectează conectarea telefonului Android la **Android Auto** (\`CarConnection.CONNECTION_TYPE_PROJECTION\`), verifică proximitatea telefonului **Apple iPhone** (\`${config.appleDeviceName}\`, prag \`${config.rssiThresholdDbm} dBm\`) prin Bluetooth LE și preia apelurile asociate numărului **${config.applePhoneNumber}** direct pe ecranul și sistemul audio al mașinii.

## Configurație inclusă la generare

- **Număr iPhone (sursă apeluri):** \`${config.applePhoneNumber}\`
- **Număr Android (Android Auto):** \`${config.androidPhoneNumber}\`
- **Dispozitiv Apple monitorizat:** \`${config.appleDeviceName}\`
- **Prag proximitate BLE RSSI:** \`${config.rssiThresholdDbm} dBm\`
- **ID pachet Android:** \`${pkg}\`
- **Alias certificat semnare:** \`${config.keystoreAlias.trim() || 'autobridge-release'}\`

## 1. Compilare și semnare APK (Local, o singură comandă)

Cerințe: JDK 17, Gradle 8.10+ și Android SDK (API 35 + Build Tools).

\`\`\`bash
chmod +x build-signed-apk.sh
./build-signed-apk.sh
\`\`\`

APK-ul final semnat (V1/V2/V3/V4) și verificat cu \`apksigner verify\` va fi generat în:
\`dist/AutoBridgeAA-v${versionTag}-signed.apk\`

## 2. Compilare automată în Cloud (fără Android Studio)

1. Creează un repository GitHub privat și încarcă **conținutul** acestui folder (astfel încât \`.github/workflows/build-signed-apk.yml\` să fie în rădăcina repository-ului).
2. Accesează fila **Actions** → **Compile & Sign AutoBridge AA APK** → **Run workflow**.
3. Descarcă fișierul \`AutoBridgeAA-v${versionTag}-signed.apk\` din secțiunea **Artifacts**.

## 3. Configurare automatizare pe iPhone (Apple Shortcuts)

Deoarece iOS nu permite unui telefon Android extern să preia direct canalul celular fără consimțământul iPhone-ului, configurează pe iPhone două automatizări simple în aplicația **Shortcuts (Scurtături)**:

1. **La conectarea Bluetooth a mașinii / a telefonului Android** → Acțiunea **Call (Apelează)** \`*21*${androidNumClean}#\` (activează redirecționarea apelurilor de pe \`${config.applePhoneNumber}\` către \`${config.androidPhoneNumber}\`).
2. **La deconectarea Bluetooth a mașinii** → Acțiunea **Call (Apelează)** \`##21#\` (dezactivează redirecționarea automată).
`,
    },
  ];

  return files;
}

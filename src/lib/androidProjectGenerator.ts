import { BridgeConfig, ProjectFile } from '../types/bridge';

function sanitizePackagePath(appId: string): string {
  const cleaned = appId.trim().replace(/[^a-zA-Z0-9._]/g, '');
  return (cleaned || 'ro.autobridge.applecall').replace(/\./g, '/');
}

function sanitizePackageName(appId: string): string {
  const cleaned = appId.trim().replace(/[^a-zA-Z0-9._]/g, '');
  return cleaned || 'ro.autobridge.applecall';
}

function escapeKotlinString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function generateAndroidProjectFiles(config: BridgeConfig): ProjectFile[] {
  const pkg = sanitizePackageName(config.applicationId);
  const pkgPath = sanitizePackagePath(config.applicationId);
  const appleNum = escapeKotlinString(config.applePhoneNumber.trim());
  const appleNumClean = normalizePhone(config.applePhoneNumber);
  const androidNum = escapeKotlinString(config.androidPhoneNumber.trim());
  const androidNumClean = normalizePhone(config.androidPhoneNumber);
  const appleDevice = escapeKotlinString(config.appleDeviceName.trim());
  const appName = escapeKotlinString(config.appDisplayName.trim() || 'AutoBridge AA');
  const alias = escapeKotlinString(config.keystoreAlias.trim() || 'autobridge-release');
  const orgName = escapeKotlinString(config.organizationName.trim() || 'AutoBridge Mobile');

  const files: ProjectFile[] = [
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
      description: 'Configurația Gradle de nivel rădăcină (AGP 8.7 + Kotlin 2.0).',
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
        versionCode = ${config.versionCode}
        versionName = "${escapeKotlinString(config.versionName)}"

        buildConfigField("String", "DEFAULT_APPLE_NUMBER", "\\"${appleNum}\\"")
        buildConfigField("String", "DEFAULT_ANDROID_NUMBER", "\\"${androidNum}\\"")
        buildConfigField("String", "DEFAULT_APPLE_DEVICE_NAME", "\\"${appleDevice}\\"")
        buildConfigField("int", "DEFAULT_RSSI_THRESHOLD", "${config.rssiThresholdDbm}")
        buildConfigField("String", "DEFAULT_BRIDGE_MODE", "\\"${config.bridgeMode}\\"")
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
                ?: "${alias}"
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
      description: 'Reguli R8/ProGuard pentru păstrarea serviciilor Android Auto și Telecom.',
      content: `-keep class androidx.car.app.** { *; }
-keep class ${pkg}.car.** { *; }
-keep class ${pkg}.telecom.** { *; }
-keep class ${pkg}.service.** { *; }
`,
    },
    {
      path: 'app/src/main/AndroidManifest.xml',
      language: 'xml',
      category: 'Manifest & Resurse',
      description: 'Permisiuni Bluetooth LE, Telecom, Foreground Service și declararea Android Auto CarAppService.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Bluetooth & BLE proximitate iPhone -->
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
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
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />

    <application
        android:allowBackup="false"
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
      description: 'Resurse text ale aplicației în limba română.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${appName}</string>
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
      description: 'Scanează pachetele BLE Apple Continuity (Company ID 0x004C) și evaluează proximitatea RSSI a iPhone-ului țintă.',
      content: `package ${pkg}.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
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

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val record = result.scanRecord ?: return
            val hasAppleManufacturerData = record.getManufacturerSpecificData(APPLE_MANUFACTURER_ID) != null
            val advertisedName = result.device?.name ?: record.deviceName ?: ""
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
        if (isScanning) return
        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
        val scanner = btManager.adapter?.bluetoothLeScanner ?: return

        val appleFilter = ScanFilter.Builder()
            .setManufacturerData(APPLE_MANUFACTURER_ID, byteArrayOf())
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        scanner.startScan(listOf(appleFilter), settings, scanCallback)
        isScanning = true
    }

    @SuppressLint("MissingPermission")
    fun stopScanning() {
        if (!isScanning) return
        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
        btManager.adapter?.bluetoothLeScanner?.stopScan(scanCallback)
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
import android.os.Bundle
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

        fun phoneAccountHandle(context: Context): PhoneAccountHandle {
            return PhoneAccountHandle(
                ComponentName(context, BridgeConnectionService::class.java),
                ACCOUNT_ID
            )
        }

        fun registerPhoneAccount(context: Context) {
            val telecom = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val account = PhoneAccount.builder(phoneAccountHandle(context), "${appName} (iPhone)")
                .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                .setShortDescription("Preluare apeluri iPhone pe Android Auto")
                .build()
            telecom.registerPhoneAccount(account)
        }

        fun normalizePhoneNumber(raw: String): String = raw.replace(Regex("[^\\d+]"), "")

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
      description: 'Orchestrează starea Android Auto + proximitatea Apple BLE și activează/dezactivează puntea de apeluri.',
      content: `package ${pkg}.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.ParcelUuid
import androidx.core.app.NotificationCompat
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

        fun start(context: Context) {
            val intent = Intent(context, CallBridgeForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
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
        startForeground(NOTIFICATION_ID, buildNotification("Se monitorizează Android Auto..."))

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

    private fun activateIosBridgeSignal() {
        // Anunță serviciul GATT BLE pentru ca iPhone-ul aflat în proximitate să activeze redirecționarea (*21*${androidNumClean}#)
        val btManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
        val advertiser = btManager.adapter?.bluetoothLeAdvertiser ?: return
        if (advertisingActive) return

        try {
            val service = BluetoothGattService(
                BRIDGE_TRIGGER_SERVICE_UUID,
                BluetoothGattService.SERVICE_TYPE_PRIMARY
            )
            gattServer = btManager.openGattServer(this, object : android.bluetooth.BluetoothGattServerCallback() {})
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
        proximityScanner.stopScanning()
        autoMonitor.stop()
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
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(statusText: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setContentTitle("${appName}")
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
        nm.notify(NOTIFICATION_ID, buildNotification(text))
    }
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/car/AutoBridgeCarAppService.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Aplicația nativă afișată pe ecranul mașinii Android Auto cu starea punții iPhone.',
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
            .setTitle("${appName} — $statusTitle")
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
      description: 'Interfața Jetpack Compose de pe telefonul Android pentru setarea numărului Apple și pornirea serviciului.',
      content: `package ${pkg}.ui

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ${pkg}.data.BridgePreferences
import ${pkg}.service.CallBridgeForegroundService

class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        CallBridgeForegroundService.start(this)
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
                            .padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = "${appName}",
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

                        Button(
                            onClick = {
                                preferences.save(settings)
                                CallBridgeForegroundService.start(this@MainActivity)
                                savedMessage = "Configurație salvată și serviciu activat."
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

APP_VERSION="${escapeKotlinString(config.versionName)}"
KEYSTORE_PATH="app/release-keystore.jks"
KEY_ALIAS="${alias}"
KEYSTORE_PASS="\${KEYSTORE_PASSWORD:-AutoBridge2026!}"
ORG_NAME="${orgName}"
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
gradle assembleRelease --no-daemon

UNSIGNED_OR_SIGNED="app/build/outputs/apk/release/app-release.apk"
if [ ! -f "\${UNSIGNED_OR_SIGNED}" ]; then
  UNSIGNED_OR_SIGNED="app/build/outputs/apk/release/app-release-unsigned.apk"
fi

# 4. Aliniere și verificare / semnare apksigner (V1 + V2 + V3 + V4)
BUILD_TOOLS_DIR="\$(ls -d "\${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/* | sort -V | tail -n 1)"
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
      description: 'Pipeline GitHub Actions care compilează și semnează automat APK-ul în cloud fără să instalezi Android Studio.',
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

      - name: Configurare Gradle 8.10
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.10.2'

      - name: Instalare Android SDK 35 & Build Tools
        uses: android-actions/setup-android@v3

      - name: Compilare și semnare APK Release
        env:
          KEYSTORE_PASSWORD: \${{ secrets.KEYSTORE_PASSWORD }}
        run: |
          chmod +x build-signed-apk.sh
          ./build-signed-apk.sh

      - name: Încarcă APK semnat ca Artifact descărcabil
        uses: actions/upload-artifact@v4
        with:
          name: AutoBridgeAA-v${escapeKotlinString(config.versionName)}-signed-apk
          path: dist/*.apk
`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      category: 'Semnare & CI/CD',
      description: 'Documentație tehnică completă de compilare, semnare APK și configurare pe iPhone.',
      content: `# ${appName} (v${config.versionName})

Aplicație Android Kotlin care detectează conectarea telefonului Android la **Android Auto** (\`CarConnection.CONNECTION_TYPE_PROJECTION\`), verifică proximitatea telefonului **Apple iPhone** (\`${config.appleDeviceName}\`, prag \`${config.rssiThresholdDbm} dBm\`) prin Bluetooth LE și preia apelurile asociate numărului **${config.applePhoneNumber}** direct pe ecranul și sistemul audio al mașinii.

## Configurație inclusă la generare

- **Număr iPhone (sursă apeluri):** \`${config.applePhoneNumber}\`
- **Număr Android (Android Auto):** \`${config.androidPhoneNumber}\`
- **Dispozitiv Apple monitorizat:** \`${config.appleDeviceName}\`
- **Prag proximitate BLE RSSI:** \`${config.rssiThresholdDbm} dBm\`
- **ID pachet Android:** \`${pkg}\`
- **Alias certificat semnare:** \`${alias}\`

## 1. Compilare și semnare APK (Local, o singură comandă)

Cerințe: JDK 17, Gradle 8.10+ și Android SDK (API 35 + Build Tools).

\`\`\`bash
chmod +x build-signed-apk.sh
./build-signed-apk.sh
\`\`\`

APK-ul final semnat (V1/V2/V3/V4) și verificat cu \`apksigner verify\` va fi generat în:
\`dist/AutoBridgeAA-v${config.versionName}-signed.apk\`

## 2. Compilare automată în Cloud (fără Android Studio)

1. Creează un repository GitHub privat și încarcă acest proiect.
2. Accesează fila **Actions** → **Compile & Sign AutoBridge AA APK** → **Run workflow**.
3. Descarcă fișierul \`AutoBridgeAA-v${config.versionName}-signed.apk\` din secțiunea **Artifacts**.

## 3. Configurare automatizare pe iPhone (Apple Shortcuts)

Deoarece iOS nu permite unui telefon Android extern să preia direct canalul celular fără consimțământul iPhone-ului, configurează pe iPhone două automatizări simple în aplicația **Shortcuts (Scurtături)**:

1. **La conectarea Bluetooth a mașinii / a telefonului Android** → Acțiunea **Call (Apelează)** \`*21*${androidNumClean}#\` (activează redirecționarea apelurilor de pe \`${config.applePhoneNumber}\` către \`${config.androidPhoneNumber}\`).
2. **La deconectarea Bluetooth a mașinii** → Acțiunea **Call (Apelează)** \`##21#\` (dezactivează redirecționarea automată).
`,
    },
  ];

  return files;
}

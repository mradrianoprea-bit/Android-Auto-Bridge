import { BridgeConfig, ProjectFile } from '../types/bridge';

export function sanitizeVersionTag(versionName: string): string {
  return versionName.trim().replace(/[^a-zA-Z0-9._-]/g, '') || '1.1.0';
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
  const safeVersionCode = Math.max(1, Math.floor(Number(config.versionCode) || 2));
  const rawAppleNum = config.applePhoneNumber.trim();
  const appleNum = escapeKotlinString(rawAppleNum);
  const appleNumClean = normalizePhone(config.applePhoneNumber);
  const rawAndroidNum = config.androidPhoneNumber.trim();
  const androidNumClean = normalizePhone(config.androidPhoneNumber);
  const rawAppleDevice = config.appleDeviceName.trim();
  const rawAppleAddress = (config.appleDeviceAddress || '').trim().toUpperCase();
  const rawAppName = config.appDisplayName.trim() || 'AutoBridge AA';
  const appNameKotlin = escapeKotlinString(rawAppName);
  const appNameXml = escapeXmlString(rawAppName);
  const aliasKotlin = escapeKotlinString(config.keystoreAlias.trim() || 'autobridge-release');
  const aliasBash = escapeBashDoubleQuoted(config.keystoreAlias.trim() || 'autobridge-release');
  const orgBash = escapeBashDoubleQuoted(config.organizationName.trim() || 'AutoBridge Mobile');

  const files: ProjectFile[] = [
    {
      path: '.gitattributes',
      language: 'properties',
      category: 'Gradle & Build',
      description: 'Forțează sfârșituri de linie LF pe scripturile bash și fișierele sursă pentru push de pe Windows/macOS/Linux.',
      content: `* text=auto eol=lf
*.sh text eol=lf
*.kt text eol=lf
*.kts text eol=lf
*.xml text eol=lf
*.yml text eol=lf
*.properties text eol=lf
`,
    },
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
        buildConfigField("String", "DEFAULT_APPLE_DEVICE_ADDRESS", "${escapeBuildConfigString(rawAppleAddress)}")
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

    // Coroutines pentru orchestrare BLE ANCS + Android Auto
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
`,
    },
    {
      path: 'app/proguard-rules.pro',
      language: 'properties',
      category: 'Gradle & Build',
      description: 'Reguli R8/ProGuard pentru păstrarea serviciilor Android Auto, ANCS și Telecom.',
      content: `-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class androidx.car.app.** { *; }
-keep class * extends androidx.car.app.CarAppService { *; }
-keep class ${pkg}.car.** { *; }
-keep class ${pkg}.telecom.** { *; }
-keep class ${pkg}.service.** { *; }
-keep class ${pkg}.bluetooth.** { *; }
-dontwarn androidx.car.app.**
`,
    },
    {
      path: 'app/src/main/AndroidManifest.xml',
      language: 'xml',
      category: 'Manifest & Resurse',
      description: 'Permisiuni Bluetooth LE ANCS (API 29–35), Telecom, auto-pornire la conectarea mașinii și Android Auto CarAppService.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Bluetooth & BLE ANCS proximitate iPhone -->
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

    <!-- Serviciu persistent în fundal, auto-pornire & notificări -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

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

        <!-- Pornește automat serviciul la conectarea Bluetooth/Android Auto sau repornire -->
        <receiver
            android:name=".service.CarConnectionReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.bluetooth.device.action.ACL_CONNECTED" />
                <action android:name="androidx.car.app.connection.action.CAR_CONNECTION_UPDATED" />
            </intent-filter>
        </receiver>

        <!-- Serviciul principal de monitorizare Android Auto + Apple ANCS + redirecționare automată -->
        <service
            android:name=".service.CallBridgeForegroundService"
            android:exported="false"
            android:foregroundServiceType="connectedDevice" />

        <!-- Serviciul Android Telecom pentru afișarea apelurilor ANCS pe Android Auto -->
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
    <string name="channel_bridge_desc">Monitorizează conectarea la Android Auto și apelurile iPhone prin Apple ANCS.</string>
</resources>
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/data/BridgePreferences.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Stocarea persistentă a numărului Apple, adresei Bluetooth a iPhone-ului, pragului RSSI și modului ANCS.',
      content: `package ${pkg}.data

import android.content.Context
import ${pkg}.BuildConfig

data class BridgeSettings(
    val applePhoneNumber: String = BuildConfig.DEFAULT_APPLE_NUMBER,
    val androidPhoneNumber: String = BuildConfig.DEFAULT_ANDROID_NUMBER,
    val appleDeviceName: String = BuildConfig.DEFAULT_APPLE_DEVICE_NAME,
    val appleDeviceAddress: String = BuildConfig.DEFAULT_APPLE_DEVICE_ADDRESS,
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
        appleDeviceAddress = prefs.getString("apple_address", BuildConfig.DEFAULT_APPLE_DEVICE_ADDRESS)
            ?: BuildConfig.DEFAULT_APPLE_DEVICE_ADDRESS,
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
            .putString("apple_address", settings.appleDeviceAddress.trim().uppercase())
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
      path: `app/src/main/java/${pkgPath}/bluetooth/AppleAncsClient.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Client real Apple ANCS (BLE GATT) care se conectează la iPhone-ul asociat, citește RSSI live, detectează apelurile primite și trimite acțiunea Decline/Accept.',
      content: `package ${pkg}.bluetooth

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

enum class AncsConnectionStatus {
    UNPAIRED,
    CONNECTING,
    CONNECTED_NO_ANCS,
    READY
}

data class AncsState(
    val status: AncsConnectionStatus = AncsConnectionStatus.UNPAIRED,
    val deviceName: String = "",
    val deviceAddress: String = "",
    val rssiDbm: Int = -120,
    val inCabinRange: Boolean = false,
    val detailMessage: String = "Asociază iPhone-ul prin Bluetooth și selectează-l din listă."
)

data class AncsIncomingCallEvent(
    val notificationUidBytes: ByteArray,
    val notificationUidInt: Int,
    val supportsNegativeAction: Boolean,
    val supportsPositiveAction: Boolean,
    val isRemoved: Boolean = false
)

class AppleAncsClient(
    private val context: Context,
    private val targetDeviceAddressProvider: () -> String,
    private val targetDeviceNameProvider: () -> String,
    private val rssiThresholdProvider: () -> Int
) {
    companion object {
        // Specificația oficială Apple Notification Center Service (ANCS)
        val ANCS_SERVICE_UUID: UUID = UUID.fromString("7905F431-B5CE-4E99-A40F-4B1E122D00D0")
        val NOTIFICATION_SOURCE_UUID: UUID = UUID.fromString("9FBF120D-6301-42D9-8C58-25E699A21DBD")
        val CONTROL_POINT_UUID: UUID = UUID.fromString("69D1D8F3-45E1-49A8-9821-9BBDFDAAD9D9")
        val DATA_SOURCE_UUID: UUID = UUID.fromString("22EAC6E9-24D6-4BB5-BE44-B36ACE7C7BFB")
        val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB")

        private const val EVENT_ID_NOTIFICATION_ADDED = 0
        private const val EVENT_ID_NOTIFICATION_REMOVED = 2
        private const val CATEGORY_ID_INCOMING_CALL = 1
        private const val EVENT_FLAG_POSITIVE_ACTION = 0x08
        private const val EVENT_FLAG_NEGATIVE_ACTION = 0x10

        private const val COMMAND_PERFORM_NOTIFICATION_ACTION: Byte = 0x02
        const val ACTION_ID_POSITIVE_ACCEPT: Byte = 0x00
        const val ACTION_ID_NEGATIVE_DECLINE: Byte = 0x01
    }

    private val _state = MutableStateFlow(AncsState())
    val state: StateFlow<AncsState> = _state.asStateFlow()

    private val _incomingCalls = MutableSharedFlow<AncsIncomingCallEvent>(extraBufferCapacity = 8)
    val incomingCalls: SharedFlow<AncsIncomingCallEvent> = _incomingCalls.asSharedFlow()

    private var gatt: BluetoothGatt? = null
    private var controlPointChar: BluetoothGattCharacteristic? = null
    private var dataSourceChar: BluetoothGattCharacteristic? = null
    private val rssiWindow = ArrayDeque<Int>(4)
    private var lastConnectedAddress: String = ""

    fun hasConnectPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    @SuppressLint("MissingPermission")
    fun listBondedDevices(): List<Pair<String, String>> {
        if (!hasConnectPermission()) return emptyList()
        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return emptyList()
        return btManager.adapter?.bondedDevices
            ?.map { (it.name ?: "Dispozitiv Bluetooth") to it.address }
            ?.sortedByDescending { it.first.contains("iPhone", ignoreCase = true) }
            ?: emptyList()
    }

    @SuppressLint("MissingPermission")
    private fun findTargetBondedDevice(): BluetoothDevice? {
        if (!hasConnectPermission()) return null
        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return null
        val bonded = btManager.adapter?.bondedDevices ?: return null
        val wantedAddress = targetDeviceAddressProvider().trim().uppercase()
        val wantedName = targetDeviceNameProvider().trim()

        if (wantedAddress.isNotEmpty()) {
            bonded.firstOrNull { it.address.equals(wantedAddress, ignoreCase = true) }?.let { return it }
        }
        if (wantedName.isNotEmpty()) {
            bonded.firstOrNull { (it.name ?: "").equals(wantedName, ignoreCase = true) }?.let { return it }
            bonded.firstOrNull { (it.name ?: "").contains(wantedName, ignoreCase = true) }?.let { return it }
        }
        return bonded.firstOrNull { (it.name ?: "").contains("iPhone", ignoreCase = true) }
    }

    @SuppressLint("MissingPermission")
    fun connectIfNeeded(forceReconnect: Boolean = false) {
        if (!hasConnectPermission()) {
            _state.value = AncsState(
                status = AncsConnectionStatus.UNPAIRED,
                detailMessage = "Lipsește permisiunea BLUETOOTH_CONNECT."
            )
            return
        }

        val target = findTargetBondedDevice()
        if (target == null) {
            disconnect()
            _state.value = AncsState(
                status = AncsConnectionStatus.UNPAIRED,
                detailMessage = "iPhone-ul nu este asociat Bluetooth cu acest telefon Android."
            )
            return
        }

        if (!forceReconnect && gatt != null && lastConnectedAddress.equals(target.address, ignoreCase = true)) {
            return
        }

        disconnect()
        lastConnectedAddress = target.address
        val label = target.name ?: targetDeviceNameProvider().ifBlank { "Apple iPhone" }
        _state.value = AncsState(
            status = AncsConnectionStatus.CONNECTING,
            deviceName = label,
            deviceAddress = target.address,
            detailMessage = "Se conectează la Apple ANCS pe $label..."
        )

        try {
            gatt = target.connectGatt(context, true, gattCallback, BluetoothDevice.TRANSPORT_LE)
        } catch (_: SecurityException) {
            _state.value = AncsState(
                status = AncsConnectionStatus.UNPAIRED,
                detailMessage = "Eroare permisiuni Bluetooth la conectarea ANCS."
            )
        }
    }

    @SuppressLint("MissingPermission")
    fun pollRssi() {
        if (!hasConnectPermission()) return
        try {
            gatt?.readRemoteRssi()
        } catch (_: SecurityException) {
            // Ignoră dacă permisiunea a fost revocată
        }
    }

    @SuppressLint("MissingPermission")
    fun performCallAction(uidBytes: ByteArray, accept: Boolean): Boolean {
        if (!hasConnectPermission() || uidBytes.size != 4) return false
        val currentGatt = gatt ?: return false
        val cp = controlPointChar ?: return false

        val actionByte = if (accept) ACTION_ID_POSITIVE_ACCEPT else ACTION_ID_NEGATIVE_DECLINE
        val payload = byteArrayOf(
            COMMAND_PERFORM_NOTIFICATION_ACTION,
            uidBytes[0],
            uidBytes[1],
            uidBytes[2],
            uidBytes[3],
            actionByte
        )

        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                currentGatt.writeCharacteristic(
                    cp,
                    payload,
                    BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                ) == android.bluetooth.BluetoothStatusCodes.SUCCESS
            } else {
                @Suppress("DEPRECATION")
                cp.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                @Suppress("DEPRECATION")
                cp.value = payload
                @Suppress("DEPRECATION")
                currentGatt.writeCharacteristic(cp)
            }
        } catch (_: SecurityException) {
            false
        }
    }

    @SuppressLint("MissingPermission")
    fun disconnect() {
        try {
            gatt?.disconnect()
            gatt?.close()
        } catch (_: SecurityException) {
            // Ignoră
        }
        gatt = null
        controlPointChar = null
        dataSourceChar = null
        rssiWindow.clear()
        lastConnectedAddress = ""
    }

    private val gattCallback = object : BluetoothGattCallback() {

        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                val label = gatt.device?.name ?: _state.value.deviceName.ifBlank { "iPhone" }
                _state.value = _state.value.copy(
                    status = AncsConnectionStatus.CONNECTING,
                    deviceName = label,
                    deviceAddress = gatt.device?.address ?: "",
                    detailMessage = "Conectat BLE la $label. Se descoperă serviciul Apple ANCS..."
                )
                try {
                    gatt.discoverServices()
                    gatt.readRemoteRssi()
                } catch (_: SecurityException) {
                    // Ignoră
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                controlPointChar = null
                dataSourceChar = null
                rssiWindow.clear()
                _state.value = _state.value.copy(
                    status = AncsConnectionStatus.CONNECTING,
                    rssiDbm = -120,
                    inCabinRange = false,
                    detailMessage = "iPhone deconectat sau ieșit din rază. Se așteaptă reconectare automată..."
                )
            }
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) return
            val ancsService = gatt.getService(ANCS_SERVICE_UUID)
            if (ancsService == null) {
                _state.value = _state.value.copy(
                    status = AncsConnectionStatus.CONNECTED_NO_ANCS,
                    detailMessage = "iPhone conectat, dar ANCS lipsește. Activează pe iPhone: Setări → Bluetooth → (i) → Partajare notificări sistem."
                )
                return
            }

            val notifSource = ancsService.getCharacteristic(NOTIFICATION_SOURCE_UUID)
            controlPointChar = ancsService.getCharacteristic(CONTROL_POINT_UUID)
            dataSourceChar = ancsService.getCharacteristic(DATA_SOURCE_UUID)

            if (notifSource == null || controlPointChar == null) {
                _state.value = _state.value.copy(
                    status = AncsConnectionStatus.CONNECTED_NO_ANCS,
                    detailMessage = "Caracteristicile ANCS nu sunt disponibile. Reasociază iPhone-ul."
                )
                return
            }

            enableNotifications(gatt, notifSource)
        }

        @SuppressLint("MissingPermission")
        override fun onDescriptorWrite(
            gatt: BluetoothGatt,
            descriptor: BluetoothGattDescriptor,
            status: Int
        ) {
            if (status != BluetoothGatt.GATT_SUCCESS) return
            val charUuid = descriptor.characteristic.uuid
            if (charUuid == NOTIFICATION_SOURCE_UUID) {
                val ds = dataSourceChar
                if (ds != null) {
                    enableNotifications(gatt, ds)
                } else {
                    markAncsReady()
                }
            } else if (charUuid == DATA_SOURCE_UUID) {
                markAncsReady()
            }
        }

        private fun markAncsReady() {
            val currentRssi = _state.value.rssiDbm
            val effectiveInRange = currentRssi == -120 || currentRssi >= rssiThresholdProvider()
            _state.value = _state.value.copy(
                status = AncsConnectionStatus.READY,
                inCabinRange = effectiveInRange,
                detailMessage = "Apple ANCS activ pe \${_state.value.deviceName}. Monitorizează apelurile primite."
            )
            pollRssi()
        }

        override fun onReadRemoteRssi(gatt: BluetoothGatt, rssi: Int, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) return
            if (rssiWindow.size >= 4) rssiWindow.removeFirst()
            rssiWindow.addLast(rssi)
            val smoothed = rssiWindow.average().toInt()
            val inRange = smoothed >= rssiThresholdProvider()
            _state.value = _state.value.copy(
                rssiDbm = smoothed,
                inCabinRange = inRange
            )
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            handleCharacteristicUpdate(characteristic.uuid, value)
        }

        @Deprecated("Deprecated in API 33")
        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic
        ) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                val bytes = characteristic.value ?: return
                handleCharacteristicUpdate(characteristic.uuid, bytes)
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun enableNotifications(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
        try {
            gatt.setCharacteristicNotification(characteristic, true)
            val cccd = characteristic.getDescriptor(CCCD_UUID) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                gatt.writeDescriptor(cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
            } else {
                @Suppress("DEPRECATION")
                cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                @Suppress("DEPRECATION")
                gatt.writeDescriptor(cccd)
            }
        } catch (_: SecurityException) {
            // Ignoră
        }
    }

    private fun handleCharacteristicUpdate(uuid: UUID, value: ByteArray) {
        if (uuid != NOTIFICATION_SOURCE_UUID || value.size < 8) return
        val eventId = value[0].toInt() and 0xFF
        val eventFlags = value[1].toInt() and 0xFF
        val categoryId = value[2].toInt() and 0xFF

        if (categoryId != CATEGORY_ID_INCOMING_CALL) return

        val uidBytes = value.copyOfRange(4, 8)
        val uidInt = (uidBytes[0].toInt() and 0xFF) or
            ((uidBytes[1].toInt() and 0xFF) shl 8) or
            ((uidBytes[2].toInt() and 0xFF) shl 16) or
            ((uidBytes[3].toInt() and 0xFF) shl 24)

        when (eventId) {
            EVENT_ID_NOTIFICATION_ADDED -> {
                _incomingCalls.tryEmit(
                    AncsIncomingCallEvent(
                        notificationUidBytes = uidBytes,
                        notificationUidInt = uidInt,
                        supportsNegativeAction = (eventFlags and EVENT_FLAG_NEGATIVE_ACTION) != 0,
                        supportsPositiveAction = (eventFlags and EVENT_FLAG_POSITIVE_ACTION) != 0,
                        isRemoved = false
                    )
                )
            }
            EVENT_ID_NOTIFICATION_REMOVED -> {
                _incomingCalls.tryEmit(
                    AncsIncomingCallEvent(
                        notificationUidBytes = uidBytes,
                        notificationUidInt = uidInt,
                        supportsNegativeAction = false,
                        supportsPositiveAction = false,
                        isRemoved = true
                    )
                )
            }
        }
    }
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/bluetooth/AppleProximityScanner.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Scanner auxiliar BLE Apple (0x004C) care detectează prezența iPhone-ului și declanșează reconectarea ANCS.',
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
            .setScanMode(ScanSettings.SCAN_MODE_BALANCED)
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
            // Ignoră
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
      description: 'Integrează apelurile semnalate de pe iPhone cu Android Telecom și sistemul audio Android Auto.',
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
        const val EXTRA_ANCS_UID_BYTES = "extra_ancs_uid_bytes"
        private val NON_PHONE_CHARS = Regex("""[^\\d+]""")

        @Volatile
        var onCallActionCallback: ((uidBytes: ByteArray, accept: Boolean) -> Unit)? = null

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

        fun presentIncomingAppleCall(
            context: Context,
            appleNumber: String,
            ancsUidBytes: ByteArray?
        ) {
            val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return
            val extras = Bundle().apply {
                putString(EXTRA_APPLE_SOURCE_NUMBER, appleNumber)
                if (ancsUidBytes != null) {
                    putByteArray(EXTRA_ANCS_UID_BYTES, ancsUidBytes)
                }
                putParcelable(
                    TelecomManager.EXTRA_INCOMING_CALL_ADDRESS,
                    Uri.fromParts(PhoneAccount.SCHEME_TEL, normalizePhoneNumber(appleNumber).ifBlank { "${appleNumClean}" }, null)
                )
            }
            try {
                telecom.addNewIncomingCall(phoneAccountHandle(context), extras)
            } catch (_: SecurityException) {
                // Necesită MANAGE_OWN_CALLS
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
        val uidBytes = request.extras?.getByteArray(EXTRA_ANCS_UID_BYTES)

        return BridgeCallConnection(uidBytes).apply {
            setAddress(callerUri, TelecomManager.PRESENTATION_ALLOWED)
            setCallerDisplayName("iPhone • $appleSource", TelecomManager.PRESENTATION_ALLOWED)
            connectionProperties = Connection.PROPERTY_SELF_MANAGED
            audioModeIsVoip = true
            setRinging()
        }
    }

    class BridgeCallConnection(
        private val ancsUidBytes: ByteArray?
    ) : Connection() {

        @Suppress("DEPRECATION")
        override fun onAnswer() {
            setActive()
            setAudioRoute(CallAudioState.ROUTE_BLUETOOTH)
            ancsUidBytes?.let { onCallActionCallback?.invoke(it, true) }
        }

        override fun onReject() {
            ancsUidBytes?.let { onCallActionCallback?.invoke(it, false) }
            setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
            destroy()
        }

        override fun onDisconnect() {
            ancsUidBytes?.let { onCallActionCallback?.invoke(it, false) }
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
      path: `app/src/main/java/${pkgPath}/telecom/IncomingCallMonitor.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Monitorizează apelurile celulare redirecționate către telefonul Android și poate răspunde automat hands-free pe Android Auto.',
      content: `package ${pkg}.telecom

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telecom.TelecomManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat

class IncomingCallMonitor(
    private val context: Context,
    private val shouldAutoAnswerProvider: () -> Pair<Boolean, Int>,
    private val onRingingDetected: () -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
    private var api31Callback: TelephonyCallback? = null

    @Suppress("DEPRECATION")
    private var legacyListener: PhoneStateListener? = null
    private var pendingAutoAnswer: Runnable? = null

    fun start() {
        val tm = telephonyManager ?: return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            startApi31(tm)
        } else {
            startLegacy(tm)
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private fun startApi31(tm: TelephonyManager) {
        val cb = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
            override fun onCallStateChanged(state: Int) {
                handleCallState(state)
            }
        }
        api31Callback = cb
        try {
            tm.registerTelephonyCallback(context.mainExecutor, cb)
        } catch (_: SecurityException) {
            // Lipsă READ_PHONE_STATE
        }
    }

    @Suppress("DEPRECATION")
    private fun startLegacy(tm: TelephonyManager) {
        val listener = object : PhoneStateListener() {
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                handleCallState(state)
            }
        }
        legacyListener = listener
        try {
            tm.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
        } catch (_: SecurityException) {
            // Lipsă READ_PHONE_STATE
        }
    }

    private fun handleCallState(state: Int) {
        pendingAutoAnswer?.let { mainHandler.removeCallbacks(it) }
        pendingAutoAnswer = null

        if (state == TelephonyManager.CALL_STATE_RINGING) {
            onRingingDetected()
            val (shouldAnswer, delaySec) = shouldAutoAnswerProvider()
            if (shouldAnswer) {
                val task = Runnable { acceptRingingCallSafely() }
                pendingAutoAnswer = task
                mainHandler.postDelayed(task, (delaySec.coerceIn(1, 8)) * 1000L)
            }
        }
    }

    @SuppressLint("MissingPermission")
    @Suppress("DEPRECATION")
    private fun acceptRingingCallSafely() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ANSWER_PHONE_CALLS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return
        try {
            telecom.acceptRingingCall()
        } catch (_: SecurityException) {
            // Permisiune revocată
        }
    }

    fun stop() {
        pendingAutoAnswer?.let { mainHandler.removeCallbacks(it) }
        pendingAutoAnswer = null
        val tm = telephonyManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            api31Callback?.let { tm.unregisterTelephonyCallback(it) }
            api31Callback = null
        } else {
            @Suppress("DEPRECATION")
            legacyListener?.let { tm.listen(it, PhoneStateListener.LISTEN_NONE) }
            legacyListener = null
        }
    }
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/service/CarConnectionReceiver.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Pornește automat CallBridgeForegroundService când telefonul se conectează la Bluetooth-ul mașinii sau la Android Auto.',
      content: `package ${pkg}.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CarConnectionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (CallBridgeForegroundService.hasRequiredBluetoothPermissions(context)) {
            CallBridgeForegroundService.start(context.applicationContext)
        }
    }
}
`,
    },
    {
      path: `app/src/main/java/${pkgPath}/service/CallBridgeForegroundService.kt`,
      language: 'kotlin',
      category: 'Cod Kotlin',
      description: 'Orchestrează Android Auto + Apple ANCS + redirecționare automată instant (*67*) + răspuns automat pe Android Auto.',
      content: `package ${pkg}.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
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
import ${pkg}.bluetooth.AncsConnectionStatus
import ${pkg}.bluetooth.AncsIncomingCallEvent
import ${pkg}.bluetooth.AppleAncsClient
import ${pkg}.bluetooth.AppleProximityScanner
import ${pkg}.car.AndroidAutoMonitor
import ${pkg}.car.CarProjectionState
import ${pkg}.data.BridgePreferences
import ${pkg}.telecom.BridgeConnectionService
import ${pkg}.telecom.IncomingCallMonitor

data class BridgeRuntimeState(
    val carState: CarProjectionState = CarProjectionState.DISCONNECTED,
    val ancsStatus: AncsConnectionStatus = AncsConnectionStatus.UNPAIRED,
    val ancsDeviceName: String = "",
    val ancsDetail: String = "Serviciul nu a pornit încă.",
    val appleInRange: Boolean = false,
    val rssiDbm: Int = -120,
    val bridgeActive: Boolean = false,
    val targetAppleNumber: String = "${appleNum}",
    val lastEventMessage: String = "În așteptare conexiune Android Auto și iPhone (ANCS)."
)

class CallBridgeForegroundService : LifecycleService() {

    companion object {
        private const val CHANNEL_ID = "autobridge_channel"
        private const val NOTIFICATION_ID = 4201
        const val ACTION_RECONNECT_ANCS = "${pkg}.ACTION_RECONNECT_ANCS"

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

        fun reconnectAncs(context: Context) {
            if (!hasRequiredBluetoothPermissions(context)) return
            val intent = Intent(context, CallBridgeForegroundService::class.java).apply {
                action = ACTION_RECONNECT_ANCS
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (_: SecurityException) {
                // Ignoră
            }
        }
    }

    private lateinit var preferences: BridgePreferences
    private lateinit var autoMonitor: AndroidAutoMonitor
    private lateinit var ancsClient: AppleAncsClient
    private lateinit var proximityScanner: AppleProximityScanner
    private lateinit var incomingCallMonitor: IncomingCallMonitor
    private var lastHandoverEpochMs: Long = 0L

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        if (intent?.action == ACTION_RECONNECT_ANCS && ::ancsClient.isInitialized) {
            ancsClient.connectIfNeeded(forceReconnect = true)
        }
        return START_STICKY
    }

    override fun onCreate() {
        super.onCreate()
        preferences = BridgePreferences(this)
        BridgeConnectionService.registerPhoneAccount(this)
        createNotificationChannel()

        val initialNotification = buildNotification("Se monitorizează Android Auto și iPhone (ANCS)...")
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
        ancsClient = AppleAncsClient(
            context = this,
            targetDeviceAddressProvider = { preferences.load().appleDeviceAddress },
            targetDeviceNameProvider = { preferences.load().appleDeviceName },
            rssiThresholdProvider = { preferences.load().rssiThresholdDbm }
        )
        proximityScanner = AppleProximityScanner(
            context = this,
            targetDeviceNameProvider = { preferences.load().appleDeviceName },
            rssiThresholdProvider = { preferences.load().rssiThresholdDbm }
        )
        incomingCallMonitor = IncomingCallMonitor(
            context = this,
            shouldAutoAnswerProvider = {
                val cfg = preferences.load()
                val runtime = _runtimeState.value
                val recentHandover = (System.currentTimeMillis() - lastHandoverEpochMs) <= 20_000L
                val shouldAnswer = cfg.autoAnswerEnabled && (runtime.bridgeActive || recentHandover)
                shouldAnswer to cfg.autoAnswerDelaySec
            },
            onRingingDetected = {
                val recentHandover = (System.currentTimeMillis() - lastHandoverEpochMs) <= 20_000L
                if (recentHandover) {
                    setLastEvent("Apelul redirecționat de pe iPhone sună acum nativ pe Android Auto!")
                }
            }
        )

        BridgeConnectionService.onCallActionCallback = { uidBytes, accept ->
            ancsClient.performCallAction(uidBytes, accept)
        }

        autoMonitor.start()
        ancsClient.connectIfNeeded(forceReconnect = true)
        proximityScanner.startScanning()
        incomingCallMonitor.start()

        // Verificare periodică RSSI și reconectare ANCS
        lifecycleScope.launch {
            while (true) {
                proximityScanner.pruneStale()
                if (ancsClient.state.value.status == AncsConnectionStatus.READY) {
                    ancsClient.pollRssi()
                } else {
                    ancsClient.connectIfNeeded(forceReconnect = false)
                }
                delay(4_000L)
            }
        }

        // Ascultă apelurile primite în timp real pe iPhone prin Apple ANCS
        lifecycleScope.launch {
            ancsClient.incomingCalls.collect { callEvent ->
                handleAncsIncomingCall(callEvent)
            }
        }

        // Combină starea Android Auto + ANCS + proximitate BLE
        lifecycleScope.launch {
            combine(autoMonitor.state, ancsClient.state, proximityScanner.snapshot) { car, ancs, ble ->
                val cfg = preferences.load()
                val effectiveRssi = if (ancs.rssiDbm > -120) ancs.rssiDbm else ble.rssiDbm
                val ancsReady = ancs.status == AncsConnectionStatus.READY
                val inRange = if (ancsReady) {
                    ancs.inCabinRange || ble.inCabinRange
                } else {
                    ble.inCabinRange
                }
                val active = (car != CarProjectionState.DISCONNECTED) && ancsReady && inRange

                _runtimeState.value.copy(
                    carState = car,
                    ancsStatus = ancs.status,
                    ancsDeviceName = ancs.deviceName.ifBlank { cfg.appleDeviceName },
                    ancsDetail = ancs.detailMessage,
                    appleInRange = inRange,
                    rssiDbm = effectiveRssi,
                    bridgeActive = active,
                    targetAppleNumber = cfg.applePhoneNumber
                )
            }.collect { state ->
                _runtimeState.value = state
                updateNotification(state)
            }
        }
    }

    private fun handleAncsIncomingCall(event: AncsIncomingCallEvent) {
        if (event.isRemoved) return

        val cfg = preferences.load()
        val state = _runtimeState.value

        if (state.carState == CarProjectionState.DISCONNECTED) {
            setLastEvent("Apel pe iPhone ignorat: telefonul Android nu este conectat la Android Auto.")
            return
        }

        if (!state.appleInRange) {
            setLastEvent("Apel pe iPhone ignorat: iPhone prea departe (\${state.rssiDbm} dBm < \${cfg.rssiThresholdDbm} dBm).")
            return
        }

        when (cfg.bridgeMode) {
            "ancs_busy_forward", "ios_shortcut_forwarding" -> {
                // Trimite ANCS Decline (Ocupat) către iPhone -> operatorul redirecționează instant prin *67*<Android># către Android Auto cu voce completă!
                val sent = ancsClient.performCallAction(event.notificationUidBytes, accept = false)
                if (sent) {
                    lastHandoverEpochMs = System.currentTimeMillis()
                    setLastEvent("Apel detectat pe iPhone → transferat instant către Android Auto (*67*${androidNumClean}#).")
                } else {
                    setLastEvent("Apel detectat pe iPhone, dar comanda ANCS a eșuat. Verifică conexiunea Bluetooth.")
                }
            }
            else -> {
                // Mod Telecom ANCS: afișează apelul pe Android Auto și permite Răspunde/Respinge spre iPhone
                BridgeConnectionService.presentIncomingAppleCall(
                    context = this,
                    appleNumber = cfg.applePhoneNumber,
                    ancsUidBytes = event.notificationUidBytes
                )
                setLastEvent("Apel iPhone semnalat pe Android Auto prin BridgeConnectionService.")
            }
        }
    }

    private fun setLastEvent(message: String) {
        val updated = _runtimeState.value.copy(lastEventMessage = message)
        _runtimeState.value = updated
        updateNotification(updated)
    }

    override fun onDestroy() {
        BridgeConnectionService.onCallActionCallback = null
        if (::incomingCallMonitor.isInitialized) incomingCallMonitor.stop()
        if (::ancsClient.isInitialized) ancsClient.disconnect()
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
            state.bridgeActive -> "ACTIV pe Android Auto • iPhone ANCS (\${state.rssiDbm} dBm)"
            state.carState != CarProjectionState.DISCONNECTED && state.ancsStatus != AncsConnectionStatus.READY ->
                "Android Auto conectat • Conectează iPhone prin Bluetooth (ANCS)"
            state.carState != CarProjectionState.DISCONNECTED ->
                "Android Auto conectat • iPhone prea departe (\${state.rssiDbm} dBm)"
            state.ancsStatus == AncsConnectionStatus.READY ->
                "iPhone ANCS conectat • Se așteaptă Android Auto"
            else -> "În așteptare Android Auto și iPhone"
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
      description: 'Aplicația nativă afișată pe ecranul mașinii Android Auto cu starea live ANCS și a ultimului apel preluat.',
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
import ${pkg}.bluetooth.AncsConnectionStatus
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

        val statusTitle = when {
            runtime.bridgeActive -> "Preluare apeluri iPhone activă"
            runtime.ancsStatus == AncsConnectionStatus.CONNECTED_NO_ANCS -> "Activează Partajare notificări pe iPhone"
            runtime.ancsStatus != AncsConnectionStatus.READY -> "Conectare Bluetooth ANCS la iPhone..."
            else -> "iPhone în afara razei BLE"
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
                    .setTitle("Conexiune Apple ANCS")
                    .addText(
                        if (runtime.ancsStatus == AncsConnectionStatus.READY) {
                            "\${runtime.ancsDeviceName} (\${runtime.rssiDbm} dBm)"
                        } else {
                            runtime.ancsDetail
                        }
                    )
                    .build()
            )
            .addRow(
                Row.Builder()
                    .setTitle("Ultimul eveniment")
                    .addText(runtime.lastEventMessage)
                    .build()
            )
            .addAction(
                Action.Builder()
                    .setTitle("Reconectează iPhone")
                    .setOnClickListener {
                        CallBridgeForegroundService.reconnectAncs(carContext)
                        invalidate()
                    }
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
      description: 'Interfață Jetpack Compose cu diagnostic live (Android Auto + Apple ANCS), selector Bluetooth pentru iPhone-ul asociat și ghidul *67*.',
      content: `package ${pkg}.ui

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
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
import ${pkg}.bluetooth.AncsConnectionStatus
import ${pkg}.car.CarProjectionState
import ${pkg}.data.BridgePreferences
import ${pkg}.service.CallBridgeForegroundService
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {

    private var onPermissionsUpdated: (() -> Unit)? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        if (CallBridgeForegroundService.hasRequiredBluetoothPermissions(this)) {
            CallBridgeForegroundService.start(this)
        }
        onPermissionsUpdated?.invoke()
    }

    @SuppressLint("MissingPermission")
    private fun loadBondedBluetoothDevices(): List<Pair<String, String>> {
        if (!CallBridgeForegroundService.hasRequiredBluetoothPermissions(this)) return emptyList()
        val btManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return emptyList()
        return try {
            btManager.adapter?.bondedDevices
                ?.map { (it.name ?: "Dispozitiv Bluetooth") to it.address }
                ?.sortedByDescending { it.first.contains("iPhone", ignoreCase = true) }
                ?: emptyList()
        } catch (_: SecurityException) {
            emptyList()
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
                var bondedDevices by remember { mutableStateOf(loadBondedBluetoothDevices()) }
                var savedMessage by remember { mutableStateOf<String?>(null) }

                DisposableEffect(Unit) {
                    onPermissionsUpdated = {
                        bondedDevices = loadBondedBluetoothDevices()
                    }
                    onDispose { onPermissionsUpdated = null }
                }

                val cleanAndroidNum = settings.androidPhoneNumber.replace(Regex("""[^\\d+]"""), "")

                Surface(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Text(
                            text = "${appNameKotlin}",
                            style = MaterialTheme.typography.headlineSmall
                        )

                        // Card diagnostic live
                        OutlinedCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = if (runtime.bridgeActive) {
                                        "STARE: ACTIVĂ (gata de preluare pe Android Auto)"
                                    } else {
                                        "STARE: ÎN AȘTEPTARE"
                                    },
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Text(
                                    text = "Android Auto: \${if (runtime.carState != CarProjectionState.DISCONNECTED) "Conectat" else "Deconectat"}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    text = "iPhone ANCS: \${runtime.ancsStatus.name} (\${runtime.rssiDbm} dBm)",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    text = runtime.ancsDetail,
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    text = "Ultimul eveniment: \${runtime.lastEventMessage}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }

                        // Pași obligatorii pe iPhone (1 dată)
                        OutlinedCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = "Configurare obligatorie pe iPhone (o singură dată)",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Text(
                                    text = "1. Asociază prin Bluetooth iPhone-ul cu acest telefon Android, apoi pe iPhone intră în Setări → Bluetooth → (i) lângă Android și activează «Partajare notificări sistem».",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    text = "2. Pe iPhone, din aplicația Telefon (tastatură), apelează o singură dată codul: *67*$cleanAndroidNum# (activează redirecționarea la ocupat). Pentru anulare oricând: #67#.",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }

                        // Selector iPhone din dispozitivele Bluetooth asociate
                        Text(
                            text = "Selectează iPhone-ul asociat Bluetooth",
                            style = MaterialTheme.typography.titleSmall
                        )
                        if (bondedDevices.isEmpty()) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                OutlinedButton(
                                    onClick = {
                                        startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
                                    }
                                ) {
                                    Text("Deschide Setări Bluetooth")
                                }
                                TextButton(onClick = { bondedDevices = loadBondedBluetoothDevices() }) {
                                    Text("Reîncarcă")
                                }
                            }
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                bondedDevices.take(6).forEach { (name, address) ->
                                    val selected = settings.appleDeviceAddress.equals(address, ignoreCase = true)
                                    OutlinedButton(
                                        onClick = {
                                            settings = settings.copy(
                                                appleDeviceName = name,
                                                appleDeviceAddress = address
                                            )
                                            preferences.save(settings)
                                            CallBridgeForegroundService.reconnectAncs(this@MainActivity)
                                            savedMessage = "iPhone selectat: $name ($address). Se conectează ANCS..."
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = if (selected) "✓ $name ($address)" else "$name ($address)"
                                        )
                                    }
                                }
                            }
                        }

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
                                valueRange = -90f..-55f
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Răspuns automat hands-free pe Android Auto",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Switch(
                                checked = settings.autoAnswerEnabled,
                                onCheckedChange = {
                                    settings = settings.copy(autoAnswerEnabled = it)
                                }
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = {
                                    preferences.save(settings)
                                    if (CallBridgeForegroundService.hasRequiredBluetoothPermissions(this@MainActivity)) {
                                        CallBridgeForegroundService.reconnectAncs(this@MainActivity)
                                        savedMessage = "Configurație salvată și conectare ANCS repornită."
                                    } else {
                                        requestRuntimePermissions()
                                        savedMessage = "Acordă permisiunile Bluetooth și Telefon pentru pornire."
                                    }
                                },
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Salvează și conectează")
                            }
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

permissions:
  contents: read

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
      description: 'Documentație tehnică completă de compilare, semnare APK și configurare pe iPhone (Apple ANCS + *67*).',
      content: `# ${rawAppName} (v${versionTag})

Aplicație Android Kotlin care detectează conectarea telefonului Android la **Android Auto** (\`CarConnection.CONNECTION_TYPE_PROJECTION\`), se conectează prin **Apple ANCS (BLE GATT)** la iPhone-ul asociat și transferă automat apelurile primite pe **${config.applePhoneNumber}** direct pe ecranul și sistemul audio al mașinii (Android Auto).

## Cum funcționează (fără root, fără jailbreak, fără Shortcuts blocate de iOS)

1. **Detectare apel în timp real pe iPhone (Apple ANCS):** telefonul Android se conectează nativ la serviciul Apple ANCS (\`7905F431-B5CE-4E99-A40F-4B1E122D00D0\`) al iPhone-ului asociat Bluetooth și măsoară proximitatea RSSI (\`${config.rssiThresholdDbm} dBm\`).
2. **Transfer instant pe Android Auto:** doar atunci când telefonul Android este conectat la Android Auto și iPhone-ul este în habitaclu, la sosirea unui apel pe iPhone, Android trimite automat comanda ANCS *Decline (Ocupat)*.
3. **Voce 100% nativă pe sistemul mașinii:** deoarece pe iPhone este activată o singură dată redirecționarea la ocupat (\`*67*${androidNumClean}#\`), operatorul mobil transferă instant apelul (cu numărul apelantului și voce HD) pe telefonul Android conectat la Android Auto!
4. **Când ieși din mașină (Android Auto deconectat):** aplicația Android nu mai trimite comanda ANCS, deci apelurile sună din nou normal pe iPhone.

## Configurare pe iPhone (o singură dată, 1 minut)

1. Asociază prin **Bluetooth** iPhone-ul cu telefonul Android, apoi intră pe iPhone în **Setări → Bluetooth → (i) lângă telefonul Android** și activează **Partajare notificări sistem (Share System Notifications)**.
2. Deschide aplicația **AutoBridge AA** pe Android și selectează iPhone-ul din lista de dispozitive Bluetooth asociate.
3. Pe iPhone, din aplicația **Telefon** (tastatură), apelează o singură dată codul GSM:
   \`*67*${androidNumClean}#\`
   *(Pentru a dezactiva oricând redirecționarea la ocupat, apelează \`#67#\`.)*

## Compilare și semnare APK (Local)

\`\`\`bash
chmod +x build-signed-apk.sh
./build-signed-apk.sh
\`\`\`

APK-ul final semnat (V1/V2/V3/V4) este generat în \`dist/AutoBridgeAA-v${versionTag}-signed.apk\`.
`,
    },
  ];

  return files;
}

package ro.autobridge.applecall.data

import android.content.Context
import ro.autobridge.applecall.BuildConfig

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

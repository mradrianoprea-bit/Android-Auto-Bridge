package ro.autobridge.applecall.bluetooth

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

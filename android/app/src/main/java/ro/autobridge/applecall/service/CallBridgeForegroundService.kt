package ro.autobridge.applecall.service

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
import ro.autobridge.applecall.R
import ro.autobridge.applecall.bluetooth.AppleProximityScanner
import ro.autobridge.applecall.car.AndroidAutoMonitor
import ro.autobridge.applecall.car.CarProjectionState
import ro.autobridge.applecall.data.BridgePreferences
import ro.autobridge.applecall.telecom.BridgeConnectionService
import java.util.UUID

data class BridgeRuntimeState(
    val carState: CarProjectionState = CarProjectionState.DISCONNECTED,
    val appleDetected: Boolean = false,
    val appleInRange: Boolean = false,
    val rssiDbm: Int = -120,
    val bridgeActive: Boolean = false,
    val targetAppleNumber: String = "+40 722 450 890"
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
        // Anunță serviciul GATT BLE pentru ca iPhone-ul aflat în proximitate să activeze redirecționarea (*21*+40744112300#)
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
            .setContentTitle("AutoBridge AA")
            .setContentText(statusText)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(state: BridgeRuntimeState) {
        val text = when {
            state.bridgeActive -> "Activ pe Android Auto • Apeluri preluate de pe ${state.targetAppleNumber}"
            state.carState != CarProjectionState.DISCONNECTED -> "Android Auto conectat • Se caută iPhone în apropiere..."
            else -> "În așteptare conexiune Android Auto"
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm?.notify(NOTIFICATION_ID, buildNotification(text))
    }
}

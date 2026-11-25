package ro.autobridge.applecall.service

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
import ro.autobridge.applecall.R
import ro.autobridge.applecall.bluetooth.AncsConnectionStatus
import ro.autobridge.applecall.bluetooth.AncsIncomingCallEvent
import ro.autobridge.applecall.bluetooth.AppleAncsClient
import ro.autobridge.applecall.bluetooth.AppleProximityScanner
import ro.autobridge.applecall.car.AndroidAutoMonitor
import ro.autobridge.applecall.car.CarProjectionState
import ro.autobridge.applecall.data.BridgePreferences
import ro.autobridge.applecall.telecom.BridgeConnectionService
import ro.autobridge.applecall.telecom.IncomingCallMonitor

data class BridgeRuntimeState(
    val carState: CarProjectionState = CarProjectionState.DISCONNECTED,
    val ancsStatus: AncsConnectionStatus = AncsConnectionStatus.UNPAIRED,
    val ancsDeviceName: String = "",
    val ancsDetail: String = "Serviciul nu a pornit încă.",
    val appleInRange: Boolean = false,
    val rssiDbm: Int = -120,
    val bridgeActive: Boolean = false,
    val targetAppleNumber: String = "+40 722 450 890",
    val lastEventMessage: String = "În așteptare conexiune Android Auto și iPhone (ANCS)."
)

class CallBridgeForegroundService : LifecycleService() {

    companion object {
        private const val CHANNEL_ID = "autobridge_channel"
        private const val NOTIFICATION_ID = 4201
        const val ACTION_RECONNECT_ANCS = "ro.autobridge.applecall.ACTION_RECONNECT_ANCS"

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
            setLastEvent("Apel pe iPhone ignorat: iPhone prea departe (${state.rssiDbm} dBm < ${cfg.rssiThresholdDbm} dBm).")
            return
        }

        when (cfg.bridgeMode) {
            "ancs_busy_forward", "ios_shortcut_forwarding" -> {
                // Trimite ANCS Decline (Ocupat) către iPhone -> operatorul redirecționează instant prin *67*<Android># către Android Auto cu voce completă!
                val sent = ancsClient.performCallAction(event.notificationUidBytes, accept = false)
                if (sent) {
                    lastHandoverEpochMs = System.currentTimeMillis()
                    setLastEvent("Apel detectat pe iPhone → transferat instant către Android Auto (*67*+40744112300#).")
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
            .setContentTitle("AutoBridge AA")
            .setContentText(statusText)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(state: BridgeRuntimeState) {
        val text = when {
            state.bridgeActive -> "ACTIV pe Android Auto • iPhone ANCS (${state.rssiDbm} dBm)"
            state.carState != CarProjectionState.DISCONNECTED && state.ancsStatus != AncsConnectionStatus.READY ->
                "Android Auto conectat • Conectează iPhone prin Bluetooth (ANCS)"
            state.carState != CarProjectionState.DISCONNECTED ->
                "Android Auto conectat • iPhone prea departe (${state.rssiDbm} dBm)"
            state.ancsStatus == AncsConnectionStatus.READY ->
                "iPhone ANCS conectat • Se așteaptă Android Auto"
            else -> "În așteptare Android Auto și iPhone"
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm?.notify(NOTIFICATION_ID, buildNotification(text))
    }
}

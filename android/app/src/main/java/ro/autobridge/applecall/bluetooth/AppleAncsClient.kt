package ro.autobridge.applecall.bluetooth

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
                detailMessage = "Apple ANCS activ pe ${_state.value.deviceName}. Monitorizează apelurile primite."
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

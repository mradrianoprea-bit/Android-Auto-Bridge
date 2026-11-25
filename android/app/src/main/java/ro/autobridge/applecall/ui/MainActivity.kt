package ro.autobridge.applecall.ui

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
import ro.autobridge.applecall.bluetooth.AncsConnectionStatus
import ro.autobridge.applecall.car.CarProjectionState
import ro.autobridge.applecall.data.BridgePreferences
import ro.autobridge.applecall.service.CallBridgeForegroundService
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

                val cleanAndroidNum = settings.androidPhoneNumber.replace(Regex("""[^\d+]"""), "")

                Surface(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Text(
                            text = "AutoBridge AA",
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
                                    text = "Android Auto: ${if (runtime.carState != CarProjectionState.DISCONNECTED) "Conectat" else "Deconectat"}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    text = "iPhone ANCS: ${runtime.ancsStatus.name} (${runtime.rssiDbm} dBm)",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    text = runtime.ancsDetail,
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    text = "Ultimul eveniment: ${runtime.lastEventMessage}",
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
                                text = "Prag proximitate BLE: ${settings.rssiThresholdDbm} dBm",
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

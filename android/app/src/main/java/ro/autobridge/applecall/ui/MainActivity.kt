package ro.autobridge.applecall.ui

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
import ro.autobridge.applecall.data.BridgePreferences
import ro.autobridge.applecall.service.CallBridgeForegroundService
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
                            text = "AutoBridge AA",
                            style = MaterialTheme.typography.headlineSmall
                        )
                        Text(
                            text = if (runtime.bridgeActive) {
                                "Activ pe Android Auto • iPhone în proximitate (${runtime.rssiDbm} dBm)"
                            } else {
                                "Stare Android Auto: ${runtime.carState.name}"
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
                                text = "Prag proximitate BLE: ${settings.rssiThresholdDbm} dBm",
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

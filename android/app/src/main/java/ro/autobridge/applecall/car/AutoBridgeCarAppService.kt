package ro.autobridge.applecall.car

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
import ro.autobridge.applecall.bluetooth.AncsConnectionStatus
import ro.autobridge.applecall.data.BridgePreferences
import ro.autobridge.applecall.service.CallBridgeForegroundService

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
                            "${runtime.ancsDeviceName} (${runtime.rssiDbm} dBm)"
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
            .setTitle("AutoBridge AA — $statusTitle")
            .setHeaderAction(Action.APP_ICON)
            .build()
    }
}

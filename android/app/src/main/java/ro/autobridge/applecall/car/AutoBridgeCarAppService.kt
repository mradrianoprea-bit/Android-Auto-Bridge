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
                            "În habitaclu (${runtime.rssiDbm} dBm)"
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
            .setTitle("AutoBridge AA — $statusTitle")
            .setHeaderAction(Action.APP_ICON)
            .build()
    }
}

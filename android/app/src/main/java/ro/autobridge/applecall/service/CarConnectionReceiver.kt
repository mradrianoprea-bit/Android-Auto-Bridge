package ro.autobridge.applecall.service

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

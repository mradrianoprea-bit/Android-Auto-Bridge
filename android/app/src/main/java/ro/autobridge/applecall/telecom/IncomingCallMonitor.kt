package ro.autobridge.applecall.telecom

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telecom.TelecomManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat

class IncomingCallMonitor(
    private val context: Context,
    private val shouldAutoAnswerProvider: () -> Pair<Boolean, Int>,
    private val onRingingDetected: () -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
    private var api31Callback: TelephonyCallback? = null

    @Suppress("DEPRECATION")
    private var legacyListener: PhoneStateListener? = null
    private var pendingAutoAnswer: Runnable? = null

    fun start() {
        val tm = telephonyManager ?: return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            startApi31(tm)
        } else {
            startLegacy(tm)
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private fun startApi31(tm: TelephonyManager) {
        val cb = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
            override fun onCallStateChanged(state: Int) {
                handleCallState(state)
            }
        }
        api31Callback = cb
        try {
            tm.registerTelephonyCallback(context.mainExecutor, cb)
        } catch (_: SecurityException) {
            // Lipsă READ_PHONE_STATE
        }
    }

    @Suppress("DEPRECATION")
    private fun startLegacy(tm: TelephonyManager) {
        val listener = object : PhoneStateListener() {
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                handleCallState(state)
            }
        }
        legacyListener = listener
        try {
            tm.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
        } catch (_: SecurityException) {
            // Lipsă READ_PHONE_STATE
        }
    }

    private fun handleCallState(state: Int) {
        pendingAutoAnswer?.let { mainHandler.removeCallbacks(it) }
        pendingAutoAnswer = null

        if (state == TelephonyManager.CALL_STATE_RINGING) {
            onRingingDetected()
            val (shouldAnswer, delaySec) = shouldAutoAnswerProvider()
            if (shouldAnswer) {
                val task = Runnable { acceptRingingCallSafely() }
                pendingAutoAnswer = task
                mainHandler.postDelayed(task, (delaySec.coerceIn(1, 8)) * 1000L)
            }
        }
    }

    @SuppressLint("MissingPermission")
    @Suppress("DEPRECATION")
    private fun acceptRingingCallSafely() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ANSWER_PHONE_CALLS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return
        try {
            telecom.acceptRingingCall()
        } catch (_: SecurityException) {
            // Permisiune revocată
        }
    }

    fun stop() {
        pendingAutoAnswer?.let { mainHandler.removeCallbacks(it) }
        pendingAutoAnswer = null
        val tm = telephonyManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            api31Callback?.let { tm.unregisterTelephonyCallback(it) }
            api31Callback = null
        } else {
            @Suppress("DEPRECATION")
            legacyListener?.let { tm.listen(it, PhoneStateListener.LISTEN_NONE) }
            legacyListener = null
        }
    }
}

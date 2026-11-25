package ro.autobridge.applecall.telecom

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.telecom.CallAudioState
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager

class BridgeConnectionService : ConnectionService() {

    companion object {
        const val ACCOUNT_ID = "autobridge_apple_call_account"
        const val EXTRA_APPLE_SOURCE_NUMBER = "extra_apple_source_number"
        const val EXTRA_ANCS_UID_BYTES = "extra_ancs_uid_bytes"
        private val NON_PHONE_CHARS = Regex("""[^\d+]""")

        @Volatile
        var onCallActionCallback: ((uidBytes: ByteArray, accept: Boolean) -> Unit)? = null

        fun phoneAccountHandle(context: Context): PhoneAccountHandle {
            return PhoneAccountHandle(
                ComponentName(context, BridgeConnectionService::class.java),
                ACCOUNT_ID
            )
        }

        fun registerPhoneAccount(context: Context) {
            val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return
            try {
                val account = PhoneAccount.builder(phoneAccountHandle(context), "AutoBridge AA (iPhone)")
                    .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                    .setShortDescription("Preluare apeluri iPhone pe Android Auto")
                    .build()
                telecom.registerPhoneAccount(account)
            } catch (_: SecurityException) {
                // Contul Telecom necesită permisiunea MANAGE_OWN_CALLS
            }
        }

        fun presentIncomingAppleCall(
            context: Context,
            appleNumber: String,
            ancsUidBytes: ByteArray?
        ) {
            val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return
            val extras = Bundle().apply {
                putString(EXTRA_APPLE_SOURCE_NUMBER, appleNumber)
                if (ancsUidBytes != null) {
                    putByteArray(EXTRA_ANCS_UID_BYTES, ancsUidBytes)
                }
                putParcelable(
                    TelecomManager.EXTRA_INCOMING_CALL_ADDRESS,
                    Uri.fromParts(PhoneAccount.SCHEME_TEL, normalizePhoneNumber(appleNumber).ifBlank { "+40722450890" }, null)
                )
            }
            try {
                telecom.addNewIncomingCall(phoneAccountHandle(context), extras)
            } catch (_: SecurityException) {
                // Necesită MANAGE_OWN_CALLS
            }
        }

        fun normalizePhoneNumber(raw: String): String = raw.replace(NON_PHONE_CHARS, "")

        fun matchesConfiguredAppleNumber(incoming: String, configured: String): Boolean {
            val a = normalizePhoneNumber(incoming)
            val b = normalizePhoneNumber(configured)
            if (a.isEmpty() || b.isEmpty()) return false
            return a == b || a.endsWith(b.takeLast(9)) || b.endsWith(a.takeLast(9))
        }
    }

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest
    ): Connection {
        val callerUri = request.address ?: Uri.fromParts(PhoneAccount.SCHEME_TEL, "+40722450890", null)
        val appleSource = request.extras?.getString(EXTRA_APPLE_SOURCE_NUMBER) ?: "+40 722 450 890"
        val uidBytes = request.extras?.getByteArray(EXTRA_ANCS_UID_BYTES)

        return BridgeCallConnection(uidBytes).apply {
            setAddress(callerUri, TelecomManager.PRESENTATION_ALLOWED)
            setCallerDisplayName("iPhone • $appleSource", TelecomManager.PRESENTATION_ALLOWED)
            connectionProperties = Connection.PROPERTY_SELF_MANAGED
            audioModeIsVoip = true
            setRinging()
        }
    }

    class BridgeCallConnection(
        private val ancsUidBytes: ByteArray?
    ) : Connection() {

        @Suppress("DEPRECATION")
        override fun onAnswer() {
            setActive()
            setAudioRoute(CallAudioState.ROUTE_BLUETOOTH)
            ancsUidBytes?.let { onCallActionCallback?.invoke(it, true) }
        }

        override fun onReject() {
            ancsUidBytes?.let { onCallActionCallback?.invoke(it, false) }
            setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
            destroy()
        }

        override fun onDisconnect() {
            ancsUidBytes?.let { onCallActionCallback?.invoke(it, false) }
            setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
            destroy()
        }

        @Suppress("DEPRECATION")
        override fun onCallAudioStateChanged(state: CallAudioState?) {
            super.onCallAudioStateChanged(state)
            if (state != null && state.route != CallAudioState.ROUTE_BLUETOOTH) {
                setAudioRoute(CallAudioState.ROUTE_BLUETOOTH)
            }
        }
    }
}

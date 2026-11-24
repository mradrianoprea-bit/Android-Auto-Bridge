package ro.autobridge.applecall.car

import android.content.Context
import androidx.car.app.connection.CarConnection
import androidx.lifecycle.Observer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class CarProjectionState {
    DISCONNECTED,
    ANDROID_AUTO_PROJECTED,
    AUTOMOTIVE_NATIVE
}

class AndroidAutoMonitor(context: Context) {
    private val carConnection = CarConnection(context.applicationContext)
    private val _state = MutableStateFlow(CarProjectionState.DISCONNECTED)
    val state: StateFlow<CarProjectionState> = _state.asStateFlow()

    private val observer = Observer<Int> { connectionType ->
        _state.value = when (connectionType) {
            CarConnection.CONNECTION_TYPE_PROJECTION -> CarProjectionState.ANDROID_AUTO_PROJECTED
            CarConnection.CONNECTION_TYPE_NATIVE -> CarProjectionState.AUTOMOTIVE_NATIVE
            else -> CarProjectionState.DISCONNECTED
        }
    }

    fun start() {
        carConnection.type.observeForever(observer)
    }

    fun stop() {
        carConnection.type.removeObserver(observer)
    }

    fun isConnected(): Boolean = _state.value != CarProjectionState.DISCONNECTED
}

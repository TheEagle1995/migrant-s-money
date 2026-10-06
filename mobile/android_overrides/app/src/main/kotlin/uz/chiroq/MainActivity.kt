package uz.chiroq

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

private const val EVENTS = "uz.chiroq/sms"
private const val CONTROL = "uz.chiroq/sms_control"
private const val REQ_SMS = 4417

class MainActivity : FlutterActivity() {

    private var pending: MethodChannel.Result? = null

    override fun configureFlutterEngine(engine: FlutterEngine) {
        super.configureFlutterEngine(engine)

        EventChannel(engine.dartExecutor.binaryMessenger, EVENTS).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(args: Any?, sink: EventChannel.EventSink?) {
                    SmsReceiver.sink = sink
                    SmsReceiver.enabled = true
                }

                override fun onCancel(args: Any?) {
                    // Rozilik qaytarib olinganda oqim butunlay to'xtaydi
                    SmsReceiver.enabled = false
                    SmsReceiver.sink = null
                }
            }
        )

        MethodChannel(engine.dartExecutor.binaryMessenger, CONTROL).setMethodCallHandler { call, result ->
            when (call.method) {
                "hasPermission" -> result.success(hasSmsPermission())
                "requestPermission" -> {
                    if (hasSmsPermission()) {
                        result.success(true)
                    } else {
                        pending = result
                        ActivityCompat.requestPermissions(
                            this, arrayOf(Manifest.permission.RECEIVE_SMS), REQ_SMS
                        )
                    }
                }
                "stop" -> {
                    SmsReceiver.enabled = false
                    SmsReceiver.sink = null
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun hasSmsPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) ==
            PackageManager.PERMISSION_GRANTED

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_SMS) {
            val granted = grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED
            pending?.success(granted)
            pending = null
        }
    }
}

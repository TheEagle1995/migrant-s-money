package uz.remit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import io.flutter.plugin.common.EventChannel

/**
 * SMS'ni ushlaydi va Dart tomoniga XOM holda uzatadi.
 *
 * Bu yerda hech qanday parsing YO'Q va hech narsa tarmoqqa yuborilmaydi.
 * Parsing Dart tomonida, serverdan yangilanadigan shablonlar bilan bajariladi —
 * shuning uchun bank format o'zgartirsa app'ni yangilash shart emas.
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        @Volatile
        var sink: EventChannel.EventSink? = null

        @Volatile
        var enabled: Boolean = false
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (!enabled) return
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return

        // Ko'p qismli SMS bitta matnga birlashtiriladi
        val bySender = messages.groupBy { it.originatingAddress ?: "" }
        for ((sender, parts) in bySender) {
            if (!isKnownBank(sender)) continue
            val body = parts.joinToString("") { it.messageBody ?: "" }
            val payload = mapOf(
                "sender" to sender,
                "body" to body,
                "receivedAt" to (parts.firstOrNull()?.timestampMillis
                    ?: System.currentTimeMillis())
            )
            sink?.success(payload)
        }
    }

    /**
     * Faqat bank jo'natuvchilari. Shaxsiy yozishmalar hech qachon o'qilmaydi —
     * bu ham privacy, ham Play Store deklaratsiyasi uchun zarur.
     */
    private fun isKnownBank(sender: String): Boolean {
        val s = sender.lowercase()
        return KNOWN.any { s.contains(it) }
    }
}

private val KNOWN = listOf(
    "kapitalbank", "ipotekabank", "uzcard", "humo", "aab", "hamkorbank"
)

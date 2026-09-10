package com.habittracker.zen

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires at the Zen session's end (armed by [ZenDnd.start]) and puts the
 * user's interruption filter back — even if the app was killed meanwhile,
 * so Do Not Disturb never outlives the session. Not exported: only our own
 * AlarmManager PendingIntent targets it.
 */
class ZenEndReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_END) {
      return
    }
    ZenDnd.restore(context)
  }

  companion object {
    const val ACTION_END = "com.habittracker.zen.END"
  }
}

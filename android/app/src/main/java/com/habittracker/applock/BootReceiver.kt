package com.habittracker.applock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * A reboot kills the foreground service but not the user's intent: if the
 * shield was up when the phone went down, bring it back so the locked apps
 * are not quietly free until Slay is next opened. BOOT_COMPLETED is one of
 * the exemptions that may start a foreground service from the background.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    AppLockService.sync(context)
  }
}

package com.habittracker.zen

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * NativeModules.ZenMode — the JS face of [ZenDnd]. Every method resolves
 * (never rejects): src/services/zenMode.ts treats "not granted" and "not
 * available" as the same neutral state, so a failure here must never turn
 * into a red box or an unhandled rejection mid-session.
 */
class ZenModeModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  /** { supported, granted, active } — self-heals an overdue session first. */
  @ReactMethod
  fun getState(promise: Promise) {
    var granted = false
    var active = false
    try {
      granted = ZenDnd.isGranted(ctx)
      active = ZenDnd.isActive(ctx)
    } catch (e: Exception) {
      // Fall through with the neutral values.
    }
    val map = Arguments.createMap()
    map.putBoolean("supported", true)
    map.putBoolean("granted", granted)
    map.putBoolean("active", active)
    promise.resolve(map)
  }

  /** The system page where the user flips Slay on under "Do Not Disturb access". */
  @ReactMethod
  fun openAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      ctx.startActivity(intent)
    } catch (e: Exception) {
      // Some OEM builds hide the page; the row's red line still tells the user.
    }
    promise.resolve(null)
  }

  /** Turn DND on until [untilMs] (epoch ms); false when access is missing. */
  @ReactMethod
  fun start(untilMs: Double, promise: Promise) {
    val ok =
      try {
        ZenDnd.start(ctx, untilMs.toLong())
      } catch (e: Exception) {
        false
      }
    promise.resolve(ok)
  }

  /** Restore the previous filter now and drop the end alarm. */
  @ReactMethod
  fun end(promise: Promise) {
    try {
      ZenDnd.end(ctx)
    } catch (e: Exception) {
      // Nothing to surface: the filter is either restored or out of our hands.
    }
    promise.resolve(null)
  }

  companion object {
    const val NAME = "ZenMode"
  }
}

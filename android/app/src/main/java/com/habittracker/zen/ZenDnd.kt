package com.habittracker.zen

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Do Not Disturb behind a Zen session — the Android counterpart of "Zen runs
 * iOS Focus". Shared by the [ZenModeModule] (JS calls) and [ZenEndReceiver]
 * (the session-end alarm) so both restore the user's filter the same way.
 *
 * Needs the "Notification policy access" special permission, which Android
 * only grants from its own Settings page (never a runtime dialog). Every
 * entry point degrades to a no-op when access is missing.
 *
 * State lives in SharedPreferences "slay_zen": the interruption filter to
 * restore plus the session end. DND survives a reboot but the alarm does
 * not, so callers run [healIfExpired] first — an overdue session is restored
 * on the next app launch instead of silencing the phone forever.
 */
object ZenDnd {
  private const val PREFS = "slay_zen"
  private const val KEY_FILTER = "filter"
  private const val KEY_UNTIL = "untilMs"
  // Stable request code so cancel() matches the PendingIntent from start().
  private const val END_REQUEST_CODE = 0x5A3E

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun notifications(ctx: Context) =
    ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun alarms(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun isGranted(ctx: Context): Boolean = notifications(ctx).isNotificationPolicyAccessGranted

  /** Session end persisted by [start], or null when no session is ours. */
  fun persistedUntil(ctx: Context): Long? {
    val p = prefs(ctx)
    return if (p.contains(KEY_UNTIL)) p.getLong(KEY_UNTIL, 0L) else null
  }

  /** Restore the filter if the persisted session already ended (the alarm never fired). */
  fun healIfExpired(ctx: Context, now: Long = System.currentTimeMillis()) {
    val until = persistedUntil(ctx) ?: return
    if (until <= now) {
      restore(ctx)
    }
  }

  /** True while a session we started is still running (after self-healing). */
  fun isActive(ctx: Context, now: Long = System.currentTimeMillis()): Boolean {
    healIfExpired(ctx, now)
    return (persistedUntil(ctx) ?: return false) > now
  }

  /**
   * Launch-time repair: "Force stop" (Settings, or `am force-stop`) cancels
   * every alarm of the package but leaves Do Not Disturb on, so a session
   * that outlives the app would never end. Restore an overdue session, and
   * re-arm the end alarm of a running one — the PendingIntent is the same
   * request code with FLAG_UPDATE_CURRENT, so this is idempotent.
   */
  fun rearmIfActive(ctx: Context, now: Long = System.currentTimeMillis()) {
    healIfExpired(ctx, now)
    val until = persistedUntil(ctx) ?: return
    if (until > now && isGranted(ctx)) {
      scheduleEnd(ctx, until)
    }
  }

  /**
   * Silence other apps until [untilMs]. PRIORITY, not NONE: alarms and the
   * user's starred contacts still get through — Zen is quiet time, not
   * airplane mode. Returns false when access is missing or the end is past.
   */
  fun start(ctx: Context, untilMs: Long): Boolean {
    if (!isGranted(ctx)) {
      return false
    }
    val now = System.currentTimeMillis()
    healIfExpired(ctx, now)
    if (untilMs <= now) {
      return false
    }
    val p = prefs(ctx)
    val editor = p.edit()
    // Restarting while a session runs keeps the ORIGINAL filter as the one
    // to restore; remembering our own PRIORITY would make it permanent.
    if (!p.contains(KEY_FILTER)) {
      editor.putInt(KEY_FILTER, notifications(ctx).currentInterruptionFilter)
    }
    editor.putLong(KEY_UNTIL, untilMs).apply()
    try {
      notifications(ctx).setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
    } catch (e: SecurityException) {
      // Access revoked between the check and the call: leave nothing behind.
      p.edit().clear().apply()
      return false
    }
    scheduleEnd(ctx, untilMs)
    return true
  }

  /** Early or natural end from JS: drop the alarm and restore now. */
  fun end(ctx: Context) {
    alarms(ctx).cancel(endIntent(ctx))
    restore(ctx)
  }

  /** Put back the filter saved by [start] and forget the session. */
  fun restore(ctx: Context) {
    val p = prefs(ctx)
    val saved =
      if (p.contains(KEY_FILTER)) {
        p.getInt(KEY_FILTER, NotificationManager.INTERRUPTION_FILTER_ALL)
      } else {
        null
      }
    p.edit().clear().apply()
    if (saved == null || !isGranted(ctx)) {
      // Nothing of ours to undo, or access was revoked mid-session — the
      // system no longer lets us touch DND, so the user owns it again.
      return
    }
    // UNKNOWN is what currentInterruptionFilter reports before the listener
    // connects; "everything through" is the only sane thing to restore to.
    val target =
      if (saved == NotificationManager.INTERRUPTION_FILTER_UNKNOWN) {
        NotificationManager.INTERRUPTION_FILTER_ALL
      } else {
        saved
      }
    try {
      notifications(ctx).setInterruptionFilter(target)
    } catch (e: SecurityException) {
      // Same race as above; prefs are already cleared.
    }
  }

  private fun endIntent(ctx: Context): PendingIntent =
    PendingIntent.getBroadcast(
      ctx,
      END_REQUEST_CODE,
      Intent(ctx, ZenEndReceiver::class.java).setAction(ZenEndReceiver.ACTION_END),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /**
   * Exact when the platform allows it without SCHEDULE_EXACT_ALARM (any
   * pre-S device, or S+ with the user-granted variant); otherwise an inexact
   * while-idle alarm — a few minutes late is fine because JS also ends the
   * session on its own timer and [healIfExpired] covers a missed alarm.
   */
  private fun scheduleEnd(ctx: Context, untilMs: Long) {
    val am = alarms(ctx)
    val pi = endIntent(ctx)
    val exactAllowed =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    try {
      if (exactAllowed) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, untilMs, pi)
      } else {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, untilMs, pi)
      }
    } catch (e: SecurityException) {
      // canScheduleExactAlarms() flipped under us; the inexact path never throws.
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, untilMs, pi)
    }
  }
}

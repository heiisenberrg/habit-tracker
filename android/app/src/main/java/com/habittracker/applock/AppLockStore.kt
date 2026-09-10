package com.habittracker.applock

import android.content.Context
import android.provider.Settings
import com.habittracker.usage.UsageAccess
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * Persistence for App Lock, shared by the React module, the foreground
 * service and the boot receiver — all three run in different lifecycles
 * (JS call, polling loop, BOOT_COMPLETED) and must agree on the same two
 * facts: which packages are locked, and whether the shield is meant to be
 * up right now. SharedPreferences is the lowest-friction store that survives
 * process death without a database.
 */
object AppLockStore {
  private const val PREFS = "slay_applock"
  private const val KEY_PACKAGES = "lockedPackages"
  private const val KEY_ACTIVE = "shieldActive"

  /** The widget bridge's file/key; App Lock only reads it. */
  private const val WIDGET_PREFS = "slay_widget"
  private const val WIDGET_STATE_KEY = "sharedState"

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun lockedPackages(context: Context): Set<String> =
    // Copy: the set returned by getStringSet must never be mutated.
    prefs(context).getStringSet(KEY_PACKAGES, emptySet())?.toSet() ?: emptySet()

  fun setLockedPackages(context: Context, packages: Collection<String>) {
    prefs(context).edit().putStringSet(KEY_PACKAGES, packages.toSet()).apply()
  }

  fun shieldActive(context: Context): Boolean = prefs(context).getBoolean(KEY_ACTIVE, false)

  fun setShieldActive(context: Context, active: Boolean) {
    prefs(context).edit().putBoolean(KEY_ACTIVE, active).apply()
  }

  /** Both special permissions the shield needs: watching the foreground app and drawing over it. */
  fun authorized(context: Context): Boolean =
    UsageAccess.hasUsageAccess(context) && Settings.canDrawOverlays(context)

  /**
   * The shield's body copy, from the JS-owned sharedState JSON the widget
   * bridge mirrors into SharedPreferences. Read defensively: the file may
   * not exist yet, the JSON may be from an older schema, and none of that
   * should keep the lock from showing.
   */
  fun shieldBody(context: Context): String {
    val fallback = context.getString(com.habittracker.R.string.applock_body_default)
    val raw =
      try {
        context.applicationContext
          .getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
          .getString(WIDGET_STATE_KEY, null)
      } catch (_: Exception) {
        null
      } ?: return fallback
    return try {
      val state = JSONObject(raw)
      val habit = state.optJSONObject("unlockHabit")
      if (habit != null && habit.optString("name").isNotBlank()) {
        val percent = (habit.optDouble("progress", 0.0) * 100).roundToInt().coerceIn(0, 100)
        context.getString(
          com.habittracker.R.string.applock_body_habit,
          habit.optString("emoji"),
          habit.optString("name"),
          percent,
        )
      } else {
        val label = state.optJSONObject("lock")?.optString("label").orEmpty()
        if (label.isNotBlank()) label else fallback
      }
    } catch (_: Exception) {
      fallback
    }
  }
}

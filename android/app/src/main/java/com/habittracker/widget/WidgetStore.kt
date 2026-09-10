package com.habittracker.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.habittracker.MainActivity

/**
 * Android stand-in for the iOS App Group: one SharedPreferences file the app
 * writes and the widgets read. The file/key names are a contract shared with
 * the App Lock module (its shield reads the same `sharedState`) — rename
 * nothing here without renaming it there.
 */
object WidgetStore {
  const val PREFS = "slay_widget"
  const val KEY_SHARED_STATE = "sharedState"
  const val KEY_UPDATED_AT = "updatedAt"
  const val KEY_DAILY_QUOTE = "dailyQuote"

  fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun writeSharedState(context: Context, json: String) {
    // commit(), not apply(): the repaint that follows reads the value straight
    // back, and we are already off the main thread (native-modules thread).
    prefs(context)
      .edit()
      .putString(KEY_SHARED_STATE, json)
      .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
      .commit()
  }

  fun readSharedState(context: Context): SharedState? =
    SharedState.parse(prefs(context).getString(KEY_SHARED_STATE, null))

  /** Wall-clock millis of the last app push; 0 when the app has never written. */
  fun updatedAt(context: Context): Long = prefs(context).getLong(KEY_UPDATED_AT, 0L)

  /** Repaints every placed instance of both widgets from the stored state. */
  fun updateAllWidgets(context: Context) {
    // Null on devices without a widget host (TV, some Automotive builds).
    val manager = AppWidgetManager.getInstance(context) ?: return
    StreakWidgetProvider.updateAll(context, manager)
    QuoteWidgetProvider.updateAll(context, manager)
  }

  fun widgetIds(context: Context, manager: AppWidgetManager, provider: Class<*>): IntArray =
    manager.getAppWidgetIds(ComponentName(context, provider))

  /**
   * Tapping a widget brings the app forward. MAIN/LAUNCHER + NEW_TASK resumes
   * the existing singleTask MainActivity instead of re-creating the RN root.
   */
  fun openAppIntent(context: Context): PendingIntent {
    val intent =
      Intent(context, MainActivity::class.java).apply {
        action = Intent.ACTION_MAIN
        addCategory(Intent.CATEGORY_LAUNCHER)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
    return PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }

  fun dp(context: Context, value: Int): Int =
    (value * context.resources.displayMetrics.density).toInt()
}

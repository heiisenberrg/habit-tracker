package com.habittracker.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.habittracker.R
import java.util.Calendar

/**
 * "Slay Streak": the perfect-day count plus this week as seven dots, the
 * Android counterpart of RoutinerWidget's small/medium families. Two RemoteViews
 * buckets picked from the host's size options — ≈2x2 gets the number and dots,
 * anything ≥ [MEDIUM_MIN_WIDTH_DP] also gets weekday letters and the App Lock
 * line — re-picked on every resize via [onAppWidgetOptionsChanged].
 */
class StreakWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { render(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    manager: AppWidgetManager,
    id: Int,
    newOptions: Bundle,
  ) {
    render(context, manager, id)
  }

  companion object {
    /** Seven dots + letters need ~24dp each; below this a 2-column cell shows the compact face. */
    private const val MEDIUM_MIN_WIDTH_DP = 200

    private val DOT_IDS =
      intArrayOf(
        R.id.widget_dot_1, R.id.widget_dot_2, R.id.widget_dot_3, R.id.widget_dot_4,
        R.id.widget_dot_5, R.id.widget_dot_6, R.id.widget_dot_7,
      )
    private val LABEL_IDS =
      intArrayOf(
        R.id.widget_day_1, R.id.widget_day_2, R.id.widget_day_3, R.id.widget_day_4,
        R.id.widget_day_5, R.id.widget_day_6, R.id.widget_day_7,
      )

    fun updateAll(context: Context, manager: AppWidgetManager) {
      WidgetStore.widgetIds(context, manager, StreakWidgetProvider::class.java).forEach {
        render(context, manager, it)
      }
    }

    fun render(context: Context, manager: AppWidgetManager, id: Int) {
      val minWidth =
        manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
      val medium = minWidth >= MEDIUM_MIN_WIDTH_DP
      val views =
        RemoteViews(
          context.packageName,
          if (medium) R.layout.widget_streak_medium else R.layout.widget_streak_small,
        )
      bind(context, views, WidgetStore.readSharedState(context), medium)
      views.setOnClickPendingIntent(R.id.widget_root, WidgetStore.openAppIntent(context))
      manager.updateAppWidget(id, views)
    }

    private fun bind(context: Context, views: RemoteViews, state: SharedState?, medium: Boolean) {
      val streak = state?.streak ?: 0
      views.setTextViewText(R.id.widget_streak_number, streak.toString())
      views.setTextViewText(
        R.id.widget_streak_caption,
        context.getString(
          if (state == null) R.string.widget_streak_empty else R.string.widget_streak_caption,
        ),
      )
      views.setContentDescription(
        R.id.widget_streak_number,
        context.getString(R.string.widget_streak_a11y, streak),
      )

      // The JS strip is computed for the week it was written in; after a
      // Sunday→Monday rollover without an app launch it would show last week's
      // dots as this week's, so a stale strip renders blank instead.
      val now = Calendar.getInstance()
      val days =
        when {
          state == null -> SharedState.DEFAULT_LABELS.map { DayMark(it, false) }
          weekStart(WidgetStore.updatedAt(context)) < weekStart(now.timeInMillis) ->
            state.days.map { it.copy(done = false) }
          else -> state.days
        }
      val today = mondayIndex(now)
      days.forEachIndexed { i, day ->
        views.setImageViewResource(
          DOT_IDS[i],
          when {
            day.done -> R.drawable.widget_dot_done
            i == today -> R.drawable.widget_dot_today
            else -> R.drawable.widget_dot_dim
          },
        )
        if (medium) views.setTextViewText(LABEL_IDS[i], day.label)
      }
      views.setContentDescription(
        R.id.widget_week_row,
        context.getString(R.string.widget_week_a11y, days.count { it.done }),
      )
      // The compact face only has room for the two-line "open Slay" caption
      // OR the dots; the empty state has nothing to plot anyway.
      if (!medium) {
        views.setViewVisibility(R.id.widget_week_row, if (state == null) View.GONE else View.VISIBLE)
      }

      if (medium) {
        val lock = state?.lock
        if (lock?.enabled == true) {
          views.setTextViewText(
            R.id.widget_lock_line,
            if (lock.satisfied) context.getString(R.string.widget_lock_unlocked)
            else context.getString(R.string.widget_lock_locked, lock.label),
          )
          views.setViewVisibility(R.id.widget_lock_line, View.VISIBLE)
        } else {
          views.setViewVisibility(R.id.widget_lock_line, View.GONE)
        }
      }
    }

    /** 0 = Monday … 6 = Sunday, the strip's order (JS: `(getDay() + 6) % 7`). */
    private fun mondayIndex(cal: Calendar): Int = (cal.get(Calendar.DAY_OF_WEEK) + 5) % 7

    /** Local midnight of the Monday starting the week that contains [millis]. */
    private fun weekStart(millis: Long): Long {
      val c = Calendar.getInstance().apply { timeInMillis = millis }
      c.add(Calendar.DAY_OF_YEAR, -mondayIndex(c))
      c.set(Calendar.HOUR_OF_DAY, 0)
      c.set(Calendar.MINUTE, 0)
      c.set(Calendar.SECOND, 0)
      c.set(Calendar.MILLISECOND, 0)
      return c.timeInMillis
    }
  }
}

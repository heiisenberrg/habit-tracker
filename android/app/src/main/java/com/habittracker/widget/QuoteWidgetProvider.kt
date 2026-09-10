package com.habittracker.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.habittracker.R

/**
 * "Quote of the day", the home-screen face of RoutinerQuoteWidget. One layout
 * for both 4x1 and 4x2: the quote auto-sizes into whatever height the host
 * gives it, and the eyebrow header only appears once there is a second row.
 */
class QuoteWidgetProvider : AppWidgetProvider() {

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
    /** Launcher rows are ~70–110dp; a single row has no room for the eyebrow. */
    private const val TALL_MIN_HEIGHT_DP = 100

    fun updateAll(context: Context, manager: AppWidgetManager) {
      WidgetStore.widgetIds(context, manager, QuoteWidgetProvider::class.java).forEach {
        render(context, manager, it)
      }
    }

    fun render(context: Context, manager: AppWidgetManager, id: Int) {
      val quote = QuoteOfTheDay.resolve(WidgetStore.readSharedState(context))
      val minHeight =
        manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
      val tall = minHeight >= TALL_MIN_HEIGHT_DP

      val views = RemoteViews(context.packageName, R.layout.widget_quote)
      views.setViewVisibility(R.id.widget_quote_header, if (tall) View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.widget_quote_text, "“${quote.text}”")
      if (quote.author.isBlank()) {
        views.setViewVisibility(R.id.widget_quote_author, View.GONE)
      } else {
        views.setTextViewText(R.id.widget_quote_author, "— ${quote.author}")
        views.setViewVisibility(R.id.widget_quote_author, View.VISIBLE)
      }
      val pad = WidgetStore.dp(context, if (tall) 16 else 12)
      views.setViewPadding(R.id.widget_root, pad, pad, pad, pad)
      views.setOnClickPendingIntent(R.id.widget_root, WidgetStore.openAppIntent(context))
      manager.updateAppWidget(id, views)
    }
  }
}

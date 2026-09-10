package com.habittracker.widget

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Android twin of the iOS `WidgetBridge` (ios/habittracker/AppDelegate.swift):
 * the app hands the consolidated sharedState JSON over, we persist it and
 * repaint every placed widget. Legacy-style module on purpose — the JS side
 * calls `NativeModules.WidgetBridge?.setSharedState?.()` and stays untouched.
 */
class WidgetBridgeModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = NAME

  /**
   * `forceReload` is an iOS concern: WidgetKit budgets timeline reloads, so
   * only a lock-state flip may skip the 60s debounce there. A RemoteViews
   * update is a cheap local IPC, so Android repaints on every push.
   */
  @ReactMethod
  fun setSharedState(json: String, @Suppress("UNUSED_PARAMETER") forceReload: Boolean) {
    val context = reactApplicationContext
    WidgetStore.writeSharedState(context, json)
    WidgetStore.updateAllWidgets(context)
  }

  /**
   * On iOS the quote widget's midnight timeline may fetch today's quote before
   * the app opens and leaves it under `dailyQuote`. The Android widget never
   * fetches (it shows the app's quote or the bundled line), so this resolves
   * null unless something else wrote the key — and the JS falls through.
   */
  @ReactMethod
  fun getDailyQuote(promise: Promise) {
    promise.resolve(
      WidgetStore.prefs(reactApplicationContext).getString(WidgetStore.KEY_DAILY_QUOTE, null),
    )
  }

  companion object {
    const val NAME = "WidgetBridge"
  }
}

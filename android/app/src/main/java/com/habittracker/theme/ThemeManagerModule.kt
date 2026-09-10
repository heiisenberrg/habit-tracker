package com.habittracker.theme

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Android twin of the iOS ThemeManager: persists the in-app dark/light
 * choice so the NEXT cold start inflates night resources before JS has
 * hydrated the store. Without it every launch renders the system scheme
 * for a moment and then flips (the theme tokens are PlatformColor
 * resources, so the flip is a full remount). The app's own default is
 * light, which is what a fresh install applies.
 */
object ThemeStore {
  private const val PREFS = "slay_theme"
  private const val KEY = "interfaceStyle"

  fun save(context: Context, style: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit().putString(KEY, style).apply()
  }

  fun load(context: Context): String? =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)

  fun nightMode(style: String?): Int = when (style) {
    "dark" -> AppCompatDelegate.MODE_NIGHT_YES
    else -> AppCompatDelegate.MODE_NIGHT_NO
  }

  /** Call from Application.onCreate, before React Native loads. */
  fun applyPersisted(context: Context) {
    AppCompatDelegate.setDefaultNightMode(nightMode(load(context) ?: "light"))
  }
}

class ThemeManagerModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "ThemeManager"

  @ReactMethod
  fun setStyle(style: String) {
    ThemeStore.save(reactApplicationContext, style)
    // Same call RN's Appearance.setColorScheme makes; repeating it is a
    // no-op when the mode already matches, so no double config change.
    UiThreadUtil.runOnUiThread {
      AppCompatDelegate.setDefaultNightMode(ThemeStore.nightMode(style))
    }
  }
}

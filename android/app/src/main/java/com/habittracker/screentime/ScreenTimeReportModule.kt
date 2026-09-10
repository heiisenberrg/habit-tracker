package com.habittracker.screentime

import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.habittracker.usage.UsageAccess
import java.util.Calendar
import java.util.concurrent.Executors

/**
 * Android counterpart of the iOS `ScreenTimeReport` module. Apple renders
 * its report inside a sandboxed extension and never lets the numbers out;
 * Android's UsageStatsManager hands them to us directly, so `getTodayReport`
 * returns real values that JS can display. (They are display-only — the
 * Wellbeing score is deliberately not fed by them; see ActivityScreen.)
 *
 * Every method resolves — a rejected promise from a permission or OEM quirk
 * would surface as a red box on a screen that should just show zeros.
 */
class ScreenTimeReportModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  /** A day of events can be tens of thousands of rows: never on the UI thread. */
  private val executor = Executors.newSingleThreadExecutor()

  override fun getName() = NAME

  /** `{ supported, authorized }` — the same shape the iOS module returns. */
  @ReactMethod
  fun getState(promise: Promise) {
    val map = Arguments.createMap()
    map.putBoolean("supported", true)
    map.putBoolean("authorized", safeHasAccess())
    promise.resolve(map)
  }

  /**
   * iOS presents Apple's sheet here; Android has nothing to present — the
   * numbers live in the app — so this only routes an unauthorized user to
   * the Usage access page. Kept under the iOS name so JS has one call.
   */
  @ReactMethod
  fun present(promise: Promise) {
    if (!safeHasAccess()) {
      openSettings()
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun requestAccess(promise: Promise) {
    openSettings()
    promise.resolve(true)
  }

  /**
   * Local midnight → now: pickups, total and social foreground minutes and
   * the five apps used longest. Unauthorized (or any failure) resolves zeros
   * with `authorized: false` so the row can offer the permission instead.
   */
  @ReactMethod
  fun getTodayReport(promise: Promise) {
    executor.execute {
      val report = try {
        if (safeHasAccess()) buildReport() else emptyReport(false)
      } catch (e: Exception) {
        emptyReport(safeHasAccess())
      }
      promise.resolve(report)
    }
  }

  private fun buildReport(): WritableMap {
    val usage =
      reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val start = Calendar.getInstance().run {
      timeInMillis = now
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      timeInMillis
    }
    // Our own screen, the home screen and the status bar are "the phone",
    // not apps the user picked up the phone for.
    val excluded = HashSet<String>().apply {
      add(reactContext.packageName)
      add(SYSTEM_UI)
      launcherPackage()?.let { add(it) }
    }
    val result = TodayUsage.aggregate(usage.queryEvents(start, now), start, now, excluded)

    var totalMs = 0L
    var socialMs = 0L
    for ((pkg, ms) in result.foregroundMs) {
      totalMs += ms
      if (pkg in TodayUsage.SOCIAL_PACKAGES) {
        socialMs += ms
      }
    }
    val topApps = Arguments.createArray()
    result.foregroundMs.entries
      .filter { it.value >= MIN_TOP_APP_MS }
      .sortedByDescending { it.value }
      .take(TOP_APPS)
      .forEach { (pkg, ms) ->
        val app = Arguments.createMap()
        app.putString("packageName", pkg)
        app.putString("label", labelFor(pkg))
        app.putInt("minutes", minutes(ms))
        topApps.pushMap(app)
      }

    val map = Arguments.createMap()
    map.putBoolean("authorized", true)
    map.putInt("pickups", result.pickups)
    map.putInt("totalMinutes", minutes(totalMs))
    map.putInt("socialMinutes", minutes(socialMs))
    map.putArray("topApps", topApps)
    return map
  }

  private fun emptyReport(authorized: Boolean): WritableMap {
    val map = Arguments.createMap()
    map.putBoolean("authorized", authorized)
    map.putInt("pickups", 0)
    map.putInt("totalMinutes", 0)
    map.putInt("socialMinutes", 0)
    map.putArray("topApps", Arguments.createArray())
    return map
  }

  private fun minutes(ms: Long): Int = (ms / 60_000L).toInt()

  private fun safeHasAccess(): Boolean =
    try {
      UsageAccess.hasUsageAccess(reactContext)
    } catch (e: Exception) {
      false
    }

  private fun openSettings() {
    try {
      UsageAccess.openUsageAccessSettings(reactContext)
    } catch (e: Exception) {
      // Some OEM builds ship no Usage access page; the row keeps offering it.
    }
  }

  /** The current HOME app — differs per OEM and per user choice. */
  private fun launcherPackage(): String? {
    val pm = reactContext.packageManager
    val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    val info =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.resolveActivity(
          home,
          PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()),
        )
      } else {
        @Suppress("DEPRECATION")
        pm.resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY)
      }
    // "android" is the resolver stub returned when no default is set.
    return info?.activityInfo?.packageName?.takeIf { it != "android" }
  }

  /**
   * Human label; the package name when the app is invisible to us (package
   * visibility on Android 11+ hides apps without a launcher activity) or gone.
   */
  private fun labelFor(pkg: String): String {
    val pm = reactContext.packageManager
    return try {
      val info =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          pm.getApplicationInfo(pkg, PackageManager.ApplicationInfoFlags.of(0L))
        } else {
          @Suppress("DEPRECATION")
          pm.getApplicationInfo(pkg, 0)
        }
      pm.getApplicationLabel(info).toString().ifBlank { pkg }
    } catch (e: PackageManager.NameNotFoundException) {
      pkg
    }
  }

  companion object {
    const val NAME = "ScreenTimeReport"
    private const val SYSTEM_UI = "com.android.systemui"
    private const val TOP_APPS = 5
    /** Below a minute an app rounds to "0 min" — not worth a row. */
    private const val MIN_TOP_APP_MS = 60_000L
  }
}

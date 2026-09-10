package com.habittracker.applock

import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.habittracker.usage.UsageAccess
import java.io.ByteArrayOutputStream

/**
 * Android App Lock, mirroring ios/habittracker/AppLock.swift's surface so
 * src/services/appLock.ts drives both platforms with one code path. Where
 * iOS holds opaque Screen Time tokens and lets the OS shield, Android has no
 * such API: we keep plain package names and the foreground service draws
 * the shield ourselves. Every method resolves a promise; none throws to JS.
 */
class AppLockModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  @ReactMethod
  fun getState(promise: Promise) {
    val state =
      Arguments.createMap().apply {
        putBoolean("supported", true)
        putBoolean("authorized", AppLockStore.authorized(ctx))
        putInt("apps", AppLockStore.lockedPackages(ctx).size)
        putInt("categories", 0)
        putBoolean("active", AppLockStore.shieldActive(ctx))
      }
    promise.resolve(state)
  }

  /**
   * Both permissions are "special": Android only grants them from a system
   * Settings page, never through a dialog. Open whichever is missing (Usage
   * access first — without it there is nothing to shield) and resolve false;
   * the JS side re-checks on AppState 'active'. Resolves true only when both
   * are already granted, so the caller can continue straight away.
   */
  @ReactMethod
  fun requestAuthorization(promise: Promise) {
    if (!UsageAccess.hasUsageAccess(ctx)) {
      try {
        UsageAccess.openUsageAccessSettings(ctx)
      } catch (_: Exception) {
        // No Settings activity on this OEM build — nothing more we can do.
      }
      promise.resolve(false)
      return
    }
    if (!Settings.canDrawOverlays(ctx)) {
      try {
        ctx.startActivity(
          Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${ctx.packageName}"),
          ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      } catch (_: Exception) {
        // Same as above; leave the user on the Settings row copy.
      }
      promise.resolve(false)
      return
    }
    promise.resolve(true)
  }

  /** The picker is a JS screen on Android; keep the iOS shape and just report the counts. */
  @ReactMethod
  fun presentPicker(promise: Promise) {
    promise.resolve(
      Arguments.createMap().apply {
        putInt("apps", AppLockStore.lockedPackages(ctx).size)
        putInt("categories", 0)
      },
    )
  }

  /**
   * Launchable apps (MAIN/LAUNCHER) minus ourselves, sorted by label, each
   * with a small PNG icon. Resolving a hundred icons takes a few hundred
   * milliseconds, so it runs off the main thread.
   */
  @ReactMethod
  fun listApps(promise: Promise) {
    Thread {
      try {
        val pm = ctx.packageManager
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolved =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.queryIntentActivities(launcher, PackageManager.ResolveInfoFlags.of(0L))
          } else {
            @Suppress("DEPRECATION")
            pm.queryIntentActivities(launcher, 0)
          }
        val seen = HashSet<String>()
        val apps =
          resolved
            .mapNotNull { info ->
              val pkg = info.activityInfo?.packageName ?: return@mapNotNull null
              // One row per package even when an app exposes several launcher activities.
              if (pkg == ctx.packageName || !seen.add(pkg)) return@mapNotNull null
              val label = info.loadLabel(pm)?.toString()?.takeIf { it.isNotBlank() } ?: pkg
              val icon =
                try {
                  encodeIcon(info.loadIcon(pm))
                } catch (_: Exception) {
                  null
                }
              Triple(pkg, label, icon)
            }
            .sortedBy { it.second.lowercase() }
        val array = Arguments.createArray()
        for ((pkg, label, icon) in apps) {
          array.pushMap(
            Arguments.createMap().apply {
              putString("packageName", pkg)
              putString("label", label)
              if (icon != null) putString("icon", icon) else putNull("icon")
            },
          )
        }
        promise.resolve(array)
      } catch (e: Exception) {
        promise.reject("list-failed", e.message, e)
      }
    }
      .start()
  }

  @ReactMethod
  fun setLockedApps(packages: ReadableArray, promise: Promise) {
    val next = LinkedHashSet<String>()
    for (i in 0 until packages.size()) {
      packages.getString(i)?.takeIf { it.isNotBlank() }?.let(next::add)
    }
    AppLockStore.setLockedPackages(ctx, next)
    AppLockService.sync(ctx)
    promise.resolve(next.size)
  }

  @ReactMethod
  fun getLockedApps(promise: Promise) {
    val array = Arguments.createArray()
    AppLockStore.lockedPackages(ctx).sorted().forEach(array::pushString)
    promise.resolve(array)
  }

  /**
   * Persist the verdict first: the service reads it on every tick, so a
   * shield turned off from a background wake-up still clears even if
   * stopService is refused for some reason.
   */
  @ReactMethod
  fun setShield(active: Boolean, promise: Promise) {
    AppLockStore.setShieldActive(ctx, active)
    AppLockService.sync(ctx)
    promise.resolve(active)
  }

  private fun encodeIcon(drawable: Drawable): String {
    val bitmap = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, ICON_PX, ICON_PX)
    drawable.draw(canvas)
    val bytes = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes)
    bitmap.recycle()
    return Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
  }

  companion object {
    const val NAME = "AppLock"

    /** 72px: crisp at the picker's 40dp on 1x–2x screens without bloating the bridge payload. */
    private const val ICON_PX = 72
  }
}

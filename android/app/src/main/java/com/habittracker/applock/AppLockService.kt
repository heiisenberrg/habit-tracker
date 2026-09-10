package com.habittracker.applock

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.habittracker.MainActivity
import com.habittracker.R

/**
 * Foreground service that keeps the shield honest. Android has no "block
 * this package" API, so we watch UsageStatsManager for the app that just
 * came to the front and draw the overlay when it is one of ours. Polling
 * every 600 ms over a 3 s window is the usual compromise: fast enough that
 * the locked app never gets a usable frame, cheap enough that the service
 * is invisible in the battery report.
 */
class AppLockService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var usage: UsageStatsManager
  private lateinit var overlay: LockOverlay

  /** Last package seen resumed; null after it paused with nothing else resumed. */
  private var foregroundPackage: String? = null
  private var lastEventTime = 0L

  private val tick =
    object : Runnable {
      override fun run() {
        poll()
        handler.postDelayed(this, POLL_MS)
      }
    }

  override fun onCreate() {
    super.onCreate()
    usage = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    overlay = LockOverlay(this)
    ensureChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Promote first: Android 12+ kills a started-as-foreground service that
    // has not called startForeground within a few seconds, whatever we then
    // decide to do.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        buildNotification(),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
      )
    } else {
      startForeground(NOTIFICATION_ID, buildNotification())
    }
    inForeground = true
    if (!shouldRun(this)) {
      stopSelf()
      return START_NOT_STICKY
    }
    handler.removeCallbacks(tick)
    handler.post(tick)
    return START_STICKY
  }

  override fun onDestroy() {
    inForeground = false
    handler.removeCallbacks(tick)
    overlay.hide()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun poll() {
    if (!shouldRun(this)) {
      // Shield turned off, set emptied, or a permission revoked: retire
      // instead of polling for nothing.
      stopSelf()
      return
    }
    val now = System.currentTimeMillis()
    val events = usage.queryEvents(now - WINDOW_MS, now)
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      // Windows overlap between ticks; skip what the previous tick handled.
      if (event.timeStamp <= lastEventTime) continue
      when (event.eventType) {
        RESUMED -> {
          foregroundPackage = event.packageName
          lastEventTime = event.timeStamp
        }
        PAUSED -> {
          // Recents / a permission dialog pauses the locked app without
          // resuming another one; drop the shield so it does not sit over
          // system UI.
          if (event.packageName == foregroundPackage) foregroundPackage = null
          lastEventTime = event.timeStamp
        }
      }
    }
    val locked = foregroundPackage?.let { it in AppLockStore.lockedPackages(this) } ?: false
    if (locked) {
      overlay.show(AppLockStore.shieldBody(this))
    } else if (overlay.isShowing) {
      overlay.hide()
    }
  }

  private fun ensureChannel() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        getString(R.string.applock_channel_name),
        NotificationManager.IMPORTANCE_LOW,
      ).apply { setShowBadge(false) },
    )
  }

  private fun buildNotification(): Notification {
    val open =
      PendingIntent.getActivity(
        this,
        0,
        Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    return Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setContentTitle(getString(R.string.app_name))
      .setContentText(getString(R.string.applock_notification_text))
      .setContentIntent(open)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .build()
  }

  companion object {
    const val CHANNEL_ID = "applock"
    private const val NOTIFICATION_ID = 0x51A7
    private const val POLL_MS = 600L
    private const val WINDOW_MS = 3_000L

    // ACTIVITY_RESUMED/PAUSED (API 29) share values with the deprecated
    // MOVE_TO_FOREGROUND/BACKGROUND they replaced, so one pair covers minSdk 26.
    @Suppress("DEPRECATION")
    private const val RESUMED = UsageEvents.Event.MOVE_TO_FOREGROUND

    @Suppress("DEPRECATION")
    private const val PAUSED = UsageEvents.Event.MOVE_TO_BACKGROUND

    /**
     * True from startForeground() until onDestroy(). [sync] only stops a
     * service that has reached the foreground: Android 12+ crashes the app
     * ("Bringing down service while still waiting for start foreground")
     * when stopService() lands between startForegroundService() and the
     * service's startForeground() — exactly what a cold start with the
     * shield due does (the background App Lock check starts it from the
     * persisted store while the first, un-hydrated render asks for it off).
     * A service still starting checks shouldRun() itself and retires.
     */
    @Volatile private var inForeground = false

    /** Run only when there is something to shield and we are able to. */
    fun shouldRun(context: Context): Boolean =
      AppLockStore.shieldActive(context) &&
        AppLockStore.lockedPackages(context).isNotEmpty() &&
        AppLockStore.authorized(context)

    /** Start or stop to match the persisted state; safe to call from any thread or lifecycle. */
    fun sync(context: Context) {
      val app = context.applicationContext
      val intent = Intent(app, AppLockService::class.java)
      if (shouldRun(app)) {
        try {
          app.startForegroundService(intent)
        } catch (_: Exception) {
          // Android 12+ refuses foreground starts from the background
          // (e.g. a background-fetch wake-up). The flag is persisted, so
          // the next app open or boot brings the service up.
        }
      } else if (inForeground) {
        app.stopService(intent)
      }
      // Not yet in the foreground (or not running): leave it — see
      // [inForeground]. onStartCommand and every poll tick stopSelf() as
      // soon as shouldRun() is false, so the shield still drops within
      // one 600 ms tick.
    }
  }
}

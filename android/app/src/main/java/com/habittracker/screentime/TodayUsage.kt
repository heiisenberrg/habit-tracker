package com.habittracker.screentime

import android.app.usage.UsageEvents
import android.os.Build

/**
 * Pure aggregation over one day of [UsageEvents]: foreground minutes per
 * package, pickups and social-app minutes. Kept free of Android services so
 * the pairing rules can be read (and reasoned about) in one place.
 */
object TodayUsage {
  /** Foreground time per package, in milliseconds. */
  class Result(
    val foregroundMs: Map<String, Long>,
    val pickups: Int,
  )

  /**
   * Packages that count as "social". Package names are the stable identity
   * here — labels are looked up separately and change per locale.
   */
  val SOCIAL_PACKAGES: Set<String> = setOf(
    "com.instagram.android", // Instagram
    "com.facebook.katana", // Facebook
    "com.facebook.orca", // Messenger
    "com.twitter.android", // X
    "com.zhiliaoapp.musically", // TikTok
    "com.snapchat.android", // Snapchat
    "com.reddit.frontpage", // Reddit
    "com.whatsapp", // WhatsApp
    "org.telegram.messenger", // Telegram
    "com.instagram.barcelona", // Threads
    "com.google.android.youtube", // YouTube
    "com.pinterest", // Pinterest
    "com.linkedin.android", // LinkedIn
    "com.discord", // Discord
  )

  /**
   * Two unlocks (or screen-ons) closer together than this are one pickup:
   * Android fires KEYGUARD_HIDDEN once per unlock attempt and again when the
   * lock screen is dismissed, and a wake-then-sleep flicker is not a pickup.
   */
  private const val PICKUP_DEBOUNCE_MS = 5_000L

  // API 28 constants (compile-time inlined). Older OS versions never emit
  // them, so pickups read 0 there rather than crashing.
  private const val KEYGUARD_HIDDEN = UsageEvents.Event.KEYGUARD_HIDDEN
  private const val SCREEN_INTERACTIVE = UsageEvents.Event.SCREEN_INTERACTIVE

  /**
   * Walks [events] for the window `start → now`, pairing each package's
   * resume/pause events into foreground intervals.
   *
   * One package can have several activities resumed at once (A opens B
   * before A pauses), so a package is "in the foreground" while its set of
   * resumed activities is non-empty — closing on the first pause would
   * under-count every in-app navigation. An interval still open at the end
   * is clamped at [now]; a pause with no resume today (the app was already
   * up at midnight) is credited from [start].
   */
  fun aggregate(
    events: UsageEvents,
    start: Long,
    now: Long,
    excluded: Set<String>,
  ): Result {
    val foreground = HashMap<String, Long>()
    val openSince = HashMap<String, Long>()
    val resumed = HashMap<String, MutableSet<String>>()
    val seen = HashSet<String>()
    val keyguardHidden = ArrayList<Long>()
    val screenOn = ArrayList<Long>()

    val resumeType: Int
    val pauseType: Int
    val stopType: Int?
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      resumeType = UsageEvents.Event.ACTIVITY_RESUMED
      pauseType = UsageEvents.Event.ACTIVITY_PAUSED
      stopType = UsageEvents.Event.ACTIVITY_STOPPED
    } else {
      @Suppress("DEPRECATION")
      resumeType = UsageEvents.Event.MOVE_TO_FOREGROUND
      @Suppress("DEPRECATION")
      pauseType = UsageEvents.Event.MOVE_TO_BACKGROUND
      stopType = null
    }

    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val ts = event.timeStamp.coerceIn(start, now)
      when (event.eventType) {
        KEYGUARD_HIDDEN -> keyguardHidden.add(ts)
        SCREEN_INTERACTIVE -> screenOn.add(ts)
      }
      val pkg = event.packageName ?: continue
      if (pkg in excluded) {
        continue
      }
      val activity = event.className ?: ""
      val type = event.eventType
      if (type == resumeType) {
        val set = resumed.getOrPut(pkg) { HashSet() }
        if (set.isEmpty() && pkg !in openSince) {
          openSince[pkg] = ts
        }
        set.add(activity)
        seen.add(pkg)
      } else if (type == pauseType || (stopType != null && type == stopType)) {
        val set = resumed[pkg]
        set?.remove(activity)
        if (set == null || set.isEmpty()) {
          val since = openSince.remove(pkg)
            ?: if (pkg !in seen) start else null
          if (since != null) {
            foreground[pkg] = (foreground[pkg] ?: 0L) + (ts - since)
          }
        }
        seen.add(pkg)
      }
    }
    // Whatever is still up (including the app the user is reading this in,
    // had it not been excluded) counts until right now.
    for ((pkg, since) in openSince) {
      foreground[pkg] = (foreground[pkg] ?: 0L) + (now - since)
    }

    // Unlocks are the truer "pickup"; a device with no lock screen never
    // emits them, so fall back to the screen waking up.
    val stamps = if (keyguardHidden.isNotEmpty()) keyguardHidden else screenOn
    return Result(foreground, debouncedCount(stamps))
  }

  private fun debouncedCount(stamps: List<Long>): Int {
    var count = 0
    var last = Long.MIN_VALUE
    for (ts in stamps.sorted()) {
      if (ts - last >= PICKUP_DEBOUNCE_MS) {
        count++
        last = ts
      }
    }
    return count
  }
}

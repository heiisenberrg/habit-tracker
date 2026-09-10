package com.habittracker.widget

import java.util.Calendar
import java.util.Locale
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * The consolidated `sharedState` payload the app pushes (src/services/widget.ts),
 * parsed leniently: the widgets must keep rendering across app updates that
 * add fields, and after a corrupt write. Anything unreadable becomes `null`
 * and the widgets fall back to their "open Slay" copy.
 */
data class DayMark(val label: String, val done: Boolean)

data class LockState(val enabled: Boolean, val satisfied: Boolean, val label: String)

data class Quote(val text: String, val author: String, val date: String?)

class SharedState(
  val streak: Int,
  /** Monday..Sunday, always exactly seven entries. */
  val days: List<DayMark>,
  val lock: LockState?,
  val quote: Quote?,
  val fallbackQuotes: List<Quote>,
) {
  companion object {
    val DEFAULT_LABELS = listOf("M", "T", "W", "T", "F", "S", "S")

    fun parse(raw: String?): SharedState? {
      if (raw.isNullOrBlank()) return null
      return try {
        val o = JSONObject(raw)
        SharedState(
          streak = o.optInt("streak", 0).coerceAtLeast(0),
          days = parseDays(o.optJSONArray("days")),
          lock = o.optJSONObject("lock")?.let { parseLock(it) },
          quote = o.optJSONObject("quote")?.let { parseQuote(it) },
          fallbackQuotes = parseQuotes(o.optJSONArray("fallbackQuotes")),
        )
      } catch (e: JSONException) {
        null
      }
    }

    /** Pads/truncates to seven so a malformed strip can never misalign the row. */
    private fun parseDays(arr: JSONArray?): List<DayMark> =
      DEFAULT_LABELS.mapIndexed { i, fallbackLabel ->
        val day = arr?.optJSONObject(i)
        DayMark(
          label = day?.optString("l")?.takeIf { it.isNotBlank() } ?: fallbackLabel,
          done = day?.optBoolean("d", false) ?: false,
        )
      }

    private fun parseLock(o: JSONObject) =
      LockState(
        enabled = o.optBoolean("enabled", false),
        satisfied = o.optBoolean("satisfied", false),
        label = o.optString("label", ""),
      )

    private fun parseQuote(o: JSONObject): Quote? {
      val text = o.optString("text", "").trim()
      if (text.isEmpty()) return null
      return Quote(
        text = text,
        author = o.optString("author", "").trim(),
        date = o.optString("date", "").takeIf { it.isNotBlank() },
      )
    }

    private fun parseQuotes(arr: JSONArray?): List<Quote> {
      if (arr == null) return emptyList()
      return (0 until arr.length()).mapNotNull { i -> arr.optJSONObject(i)?.let { parseQuote(it) } }
    }
  }
}

/**
 * Same day → same line, on every surface: today's app-supplied quote when the
 * payload has it, else the bundled list by day-of-year (the exact index
 * `fallbackQuote()` in src/services/quotes.ts and the iOS widget use), else
 * the built-in trio for a device that has never run the app.
 */
object QuoteOfTheDay {
  private val BUILT_IN = listOf(
    Quote("Well begun is half done.", "Aristotle", null),
    Quote("The journey of a thousand miles begins with a single step.", "Lao Tzu", null),
    Quote("Little strokes fell great oaks.", "Benjamin Franklin", null),
  )

  fun resolve(state: SharedState?, now: Calendar = Calendar.getInstance()): Quote {
    val today = localDateKey(now)
    state?.quote?.takeIf { it.date == today }?.let { return it }
    val list = state?.fallbackQuotes?.takeIf { it.isNotEmpty() } ?: BUILT_IN
    // 0-based day of year, matching the JS `day % n` and iOS `(ordinality - 1) % count`.
    val dayOfYear = now.get(Calendar.DAY_OF_YEAR) - 1
    return list[dayOfYear % list.size]
  }

  /** `YYYY-MM-DD` in local time — the app's `toDateKey()` shape. */
  fun localDateKey(cal: Calendar): String =
    String.format(
      Locale.US,
      "%04d-%02d-%02d",
      cal.get(Calendar.YEAR),
      cal.get(Calendar.MONTH) + 1,
      cal.get(Calendar.DAY_OF_MONTH),
    )
}

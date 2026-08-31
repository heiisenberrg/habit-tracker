import SwiftUI
import UIKit
import WidgetKit

private let appGroup = "group.com.lucidbots.lucidbots"

// MARK: - Model

struct DayMark: Decodable, Hashable {
  let l: String
  let d: Bool
}

/// Consolidated `sharedState` payload (1A). Extra fields (lock, unlockHabit,
/// updatedAt) are for the shield extension; Decodable ignores them here.
struct StreakPayload: Decodable {
  let streak: Int
  let days: [DayMark]
}

struct StreakEntry: TimelineEntry {
  let date: Date
  let streak: Int
  let days: [DayMark]
}

private func decodePayload(forKey key: String) -> StreakPayload? {
  guard
    let raw = UserDefaults(suiteName: appGroup)?.string(forKey: key),
    let data = raw.data(using: .utf8)
  else {
    return nil
  }
  return try? JSONDecoder().decode(StreakPayload.self, from: data)
}

private func loadPayload() -> StreakEntry {
  let fallbackDays = ["M", "T", "W", "T", "F", "S", "S"].map {
    DayMark(l: $0, d: false)
  }
  // Legacy "streakData" covers the window between the app update and the
  // first launch that writes the consolidated key.
  guard
    let payload = decodePayload(forKey: "sharedState")
      ?? decodePayload(forKey: "streakData")
  else {
    return StreakEntry(date: Date(), streak: 0, days: fallbackDays)
  }
  return StreakEntry(date: Date(), streak: payload.streak, days: payload.days)
}

// MARK: - Provider

struct StreakProvider: TimelineProvider {
  func placeholder(in context: Context) -> StreakEntry {
    StreakEntry(
      date: Date(),
      streak: 15,
      days: [
        DayMark(l: "M", d: true), DayMark(l: "T", d: true),
        DayMark(l: "W", d: true), DayMark(l: "T", d: true),
        DayMark(l: "F", d: true), DayMark(l: "S", d: false),
        DayMark(l: "S", d: false),
      ]
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : loadPayload())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
    let entry = loadPayload()
    let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
    completion(Timeline(entries: [entry], policy: .after(refresh)))
  }
}

// MARK: - Views

/// Loose bundle PNG — SwiftUI's Image(name) only checks asset catalogs in
/// widget rendering, so load through UIKit with a path fallback.
private func avatarImage() -> UIImage? {
  if let ui = UIImage(named: "avatar") {
    return ui
  }
  if let path = Bundle.main.path(forResource: "avatar", ofType: "png") {
    return UIImage(contentsOfFile: path)
  }
  return nil
}

private let gradient = LinearGradient(
  colors: [Color(red: 0.44, green: 0.42, blue: 1.0), Color(red: 0.02, green: 0.09, blue: 1.0)],
  startPoint: .topLeading,
  endPoint: .bottomTrailing
)

struct WeekRow: View {
  let days: [DayMark]

  var body: some View {
    HStack(spacing: 0) {
      ForEach(Array(days.enumerated()), id: \.offset) { _, day in
        VStack(spacing: 3) {
          Text(day.l)
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.white.opacity(0.85))
          Image(systemName: day.d ? "checkmark" : "circle.dotted")
            .font(.system(size: 10, weight: .heavy))
            .foregroundColor(day.d ? Color(red: 1.0, green: 0.72, blue: 0.0) : .white.opacity(0.45))
        }
        .frame(maxWidth: .infinity)
      }
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 7)
    .background(Capsule().fill(.white.opacity(0.16)))
  }
}

struct MediumStreakView: View {
  let entry: StreakEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top, spacing: 8) {
        VStack(alignment: .leading, spacing: 5) {
          HStack(spacing: 6) {
            Text("🔥")
              .font(.system(size: 28))
            Text("\(entry.streak) day\(entry.streak == 1 ? "" : "s")")
              .font(.system(size: 30, weight: .heavy, design: .rounded))
              .foregroundColor(Color(red: 1.0, green: 0.78, blue: 0.25))
              .minimumScaleFactor(0.6)
              .lineLimit(1)
          }
          Text(entry.streak > 0 ? "Keep the streak alive!" : "Start your streak today")
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(.white.opacity(0.85))
        }
        Spacer(minLength: 4)
        if let avatar = avatarImage() {
          Image(uiImage: avatar)
            .resizable()
            .scaledToFit()
            .frame(height: 74)
            .shadow(color: .black.opacity(0.35), radius: 6, y: 3)
        } else {
          Text("🔥")
            .font(.system(size: 44))
        }
      }
      Spacer(minLength: 0)
      WeekRow(days: entry.days)
        .frame(maxWidth: .infinity)
    }
  }
}

struct SmallStreakView: View {
  let entry: StreakEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("🔥")
        .font(.system(size: 30))
      Spacer(minLength: 0)
      Text("\(entry.streak)")
        .font(.system(size: 40, weight: .heavy, design: .rounded))
        .foregroundColor(Color(red: 1.0, green: 0.78, blue: 0.25))
        .minimumScaleFactor(0.5)
        .lineLimit(1)
      Text("day streak")
        .font(.system(size: 12, weight: .semibold))
        .foregroundColor(.white.opacity(0.85))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct RoutinerWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  let entry: StreakEntry

  var body: some View {
    Group {
      if family == .systemSmall {
        SmallStreakView(entry: entry)
      } else {
        MediumStreakView(entry: entry)
      }
    }
    .containerBackground(for: .widget) { gradient }
  }
}

// MARK: - Quote of the day (lock screen + home screen)

/// One quote per calendar day, one network request per day for the whole
/// device: the App Group is checked first (`dailyQuote` written by this
/// widget, or `sharedState.quote` written by the app), ZenQuotes only when
/// neither has today's quote, and the app-supplied bundled list offline.
struct QuoteEntry: TimelineEntry {
  let date: Date
  let text: String
  let author: String
  let isFallback: Bool
}

private struct StoredQuote: Codable {
  let text: String
  let author: String
  let date: String
  let source: String
}

private struct FallbackQuote: Decodable {
  let text: String
  let author: String
}

private struct SharedQuoteState: Decodable {
  let quote: StoredQuote?
  let fallbackQuotes: [FallbackQuote]?
}

private struct ZenQuote: Decodable {
  let q: String
  let a: String
}

private let zenQuotesTodayURL = URL(string: "https://zenquotes.io/api/today")!
private let builtInFallback: [FallbackQuote] = [
  FallbackQuote(text: "Well begun is half done.", author: "Aristotle"),
  FallbackQuote(text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu"),
  FallbackQuote(text: "Little strokes fell great oaks.", author: "Benjamin Franklin"),
]

private func localDateKey(_ date: Date = Date()) -> String {
  let f = DateFormatter()
  f.calendar = Calendar.current
  f.timeZone = TimeZone.current
  f.dateFormat = "yyyy-MM-dd"
  return f.string(from: date)
}

private func nextMidnight(after date: Date = Date()) -> Date {
  let start = Calendar.current.startOfDay(for: date)
  return Calendar.current.date(byAdding: .day, value: 1, to: start)!
}

private func readStoredQuote() -> StoredQuote? {
  guard
    let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "dailyQuote"),
    let data = raw.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(StoredQuote.self, from: data)
}

private func readSharedQuoteState() -> SharedQuoteState? {
  guard
    let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "sharedState"),
    let data = raw.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(SharedQuoteState.self, from: data)
}

private func storeQuote(_ q: StoredQuote) {
  if let data = try? JSONEncoder().encode(q), let json = String(data: data, encoding: .utf8) {
    UserDefaults(suiteName: appGroup)?.set(json, forKey: "dailyQuote")
  }
}

private func fallbackEntry(for date: Date) -> QuoteEntry {
  let list = readSharedQuoteState()?.fallbackQuotes.flatMap { $0.isEmpty ? nil : $0 } ?? builtInFallback
  let day = Calendar.current.ordinality(of: .day, in: .year, for: date) ?? 1
  let q = list[(day - 1) % list.count]
  return QuoteEntry(date: date, text: q.text, author: q.author, isFallback: true)
}

struct QuoteProvider: TimelineProvider {
  func placeholder(in context: Context) -> QuoteEntry {
    QuoteEntry(date: Date(), text: "Well begun is half done.", author: "Aristotle", isFallback: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (QuoteEntry) -> Void) {
    if context.isPreview {
      completion(placeholder(in: context))
      return
    }
    completion(cachedEntry(for: Date()) ?? fallbackEntry(for: Date()))
  }

  /// Today's quote from either App Group key, without touching the network.
  private func cachedEntry(for date: Date) -> QuoteEntry? {
    let today = localDateKey(date)
    if let mine = readStoredQuote(), mine.date == today {
      return QuoteEntry(date: date, text: mine.text, author: mine.author, isFallback: mine.source == "bundled")
    }
    if let shared = readSharedQuoteState()?.quote, shared.date == today {
      storeQuote(shared)
      return QuoteEntry(date: date, text: shared.text, author: shared.author, isFallback: shared.source == "bundled")
    }
    return nil
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<QuoteEntry>) -> Void) {
    let now = Date()
    if let cached = cachedEntry(for: now), !cached.isFallback {
      completion(Timeline(entries: [cached], policy: .after(nextMidnight(after: now))))
      return
    }
    var request = URLRequest(url: zenQuotesTodayURL)
    request.timeoutInterval = 6
    URLSession.shared.dataTask(with: request) { data, _, _ in
      let today = localDateKey(now)
      if
        let data = data,
        let decoded = try? JSONDecoder().decode([ZenQuote].self, from: data),
        let first = decoded.first,
        !first.q.trimmingCharacters(in: .whitespaces).isEmpty
      {
        let quote = StoredQuote(text: first.q, author: first.a, date: today, source: "zenquotes")
        storeQuote(quote)
        let entry = QuoteEntry(date: now, text: quote.text, author: quote.author, isFallback: false)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight(after: now))))
      } else {
        // Offline: show the bundled line and try again in an hour.
        let retry = Calendar.current.date(byAdding: .hour, value: 1, to: now)!
        completion(Timeline(entries: [fallbackEntry(for: now)], policy: .after(min(retry, nextMidnight(after: now)))))
      }
    }.resume()
  }
}

struct QuoteWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  let entry: QuoteEntry

  var body: some View {
    switch family {
    case .accessoryInline:
      Text("\u{201C}\(entry.text)\u{201D} — \(entry.author)")
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 2) {
        Text(entry.text)
          .font(.system(size: 12, weight: .semibold))
          .lineLimit(3)
          .minimumScaleFactor(0.85)
        Text("— \(entry.author)")
          .font(.system(size: 10, weight: .regular))
          .opacity(0.8)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(for: .widget) { Color.clear }
    default:
      VStack(alignment: .leading, spacing: 8) {
        Text("Quote of the day")
          .font(.system(size: 11, weight: .bold))
          .textCase(.uppercase)
          .foregroundColor(.white.opacity(0.7))
        Text("\u{201C}\(entry.text)\u{201D}")
          .font(.system(size: 17, weight: .semibold, design: .rounded))
          .foregroundColor(.white)
          .lineLimit(4)
          .minimumScaleFactor(0.7)
        Spacer(minLength: 0)
        Text("— \(entry.author)")
          .font(.system(size: 13, weight: .medium))
          .foregroundColor(.white.opacity(0.85))
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(for: .widget) { gradient }
    }
  }
}

struct RoutinerQuoteWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "RoutinerQuoteWidget", provider: QuoteProvider()) { entry in
      QuoteWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Quote of the Day")
    .description("One motivational line a day, on your lock screen.")
    .supportedFamilies([.accessoryRectangular, .accessoryInline, .systemMedium])
  }
}

// MARK: - Widgets

@main
struct RoutinerWidgets: WidgetBundle {
  var body: some Widget {
    RoutinerWidget()
    RoutinerQuoteWidget()
  }
}

struct RoutinerWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "RoutinerStreakWidget", provider: StreakProvider()) { entry in
      RoutinerWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Routiner Streak")
    .description("Your perfect-day streak and this week at a glance.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

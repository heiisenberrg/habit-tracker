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

// MARK: - Widget

@main
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

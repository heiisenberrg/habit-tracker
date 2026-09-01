/**
 * Screen Time report extension.
 *
 * Apple hands this extension the user's device-activity data and takes the
 * SwiftUI view it renders. The data never leaves here: the extension runs in
 * a sandbox that "prevents your extension from making network requests or
 * moving sensitive content outside the extension's address space" (Apple's
 * DeviceActivityReport docs). So pickups and social-app minutes are computed
 * and DRAWN here — the host app can never read the numbers back, which is why
 * Routiner's productivity score does not use them.
 */
import DeviceActivity
import ManagedSettings
import SwiftUI

extension DeviceActivityReport.Context {
  /// Must match the context the app passes to DeviceActivityReport.
  static let wellbeing = Self("Wellbeing")
}

struct WellbeingTotals {
  var pickups = 0
  var socialMinutes = 0
  var screenMinutes = 0
  var topSocialApp: String?
  var hasData = false
}

struct WellbeingScene: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .wellbeing
  let content: (WellbeingTotals) -> WellbeingCard

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> WellbeingTotals {
    var totals = WellbeingTotals()
    var socialByApp: [String: Double] = [:]

    for await result in data {
      for await segment in result.activitySegments {
        totals.hasData = true
        totals.screenMinutes += Int(segment.totalActivityDuration / 60)
        // Pickups that never opened an app still count as picking up the phone.
        totals.pickups += segment.totalPickupsWithoutApplicationActivity

        for await category in segment.categories {
          let name = category.category.localizedDisplayName ?? ""
          let isSocial = name.localizedCaseInsensitiveContains("social")
          for await app in category.applications {
            totals.pickups += app.numberOfPickups
            if isSocial {
              totals.socialMinutes += Int(app.totalActivityDuration / 60)
              let label = app.application.localizedDisplayName ?? "App"
              socialByApp[label, default: 0] += app.totalActivityDuration
            }
          }
        }
      }
    }
    totals.topSocialApp = socialByApp.max { $0.value < $1.value }?.key
    return totals
  }
}

struct WellbeingCard: View {
  let totals: WellbeingTotals

  private func hhmm(_ minutes: Int) -> String {
    minutes < 60 ? "\(minutes)m" : "\(minutes / 60)h \(minutes % 60)m"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      if totals.hasData {
        row(
          value: "\(totals.pickups)",
          label: "pickups today",
          detail: totals.pickups <= 50 ? "Calm" : totals.pickups <= 80 ? "Busy" : "Restless"
        )
        Divider()
        row(
          value: hhmm(totals.socialMinutes),
          label: "on social apps",
          detail: totals.topSocialApp.map { "Most: \($0)" }
        )
        Divider()
        row(value: hhmm(totals.screenMinutes), label: "screen time", detail: nil)
      } else {
        VStack(alignment: .leading, spacing: 6) {
          Text("No Screen Time data yet")
            .font(.system(size: 15, weight: .semibold))
          Text("Give iOS a few hours of activity, then check back.")
            .font(.system(size: 13))
            .foregroundStyle(.secondary)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
  }

  private func row(value: String, label: String, detail: String?) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      Text(value).font(.system(size: 24, weight: .bold, design: .rounded))
      VStack(alignment: .leading, spacing: 2) {
        Text(label).font(.system(size: 14))
        if let detail {
          Text(detail).font(.system(size: 12)).foregroundStyle(.secondary)
        }
      }
      Spacer(minLength: 0)
    }
  }
}

@main
struct RoutinerReport: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    WellbeingScene { totals in WellbeingCard(totals: totals) }
  }
}

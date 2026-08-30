import ManagedSettings
import ManagedSettingsUI
import UIKit

/// Shield customization (D8 v1): title/subtitle/icon ONLY. Custom button
/// behavior would need a separate ShieldAction extension and still could not
/// open Routiner, so v1 promises no buttons — the system defaults stand.
/// Copy comes from the consolidated App Group `sharedState` payload (1A);
/// the shield refreshes when re-presented, not live. A missing or corrupt
/// payload falls back to generic copy, never a crash.

private let appGroup = "group.com.lucidbots.lucidbots"

private struct UnlockHabit: Decodable {
  let name: String
  let emoji: String
  let progress: Double
}

private struct LockInfo: Decodable {
  let enabled: Bool
  let satisfied: Bool
  let label: String
}

private struct SharedState: Decodable {
  let streak: Int
  let lock: LockInfo?
  let unlockHabit: UnlockHabit?
}

private func loadSharedState() -> SharedState? {
  guard
    let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "sharedState"),
    let data = raw.data(using: .utf8)
  else {
    return nil
  }
  return try? JSONDecoder().decode(SharedState.self, from: data)
}

private let routinerBlue = UIColor(red: 0.02, green: 0.09, blue: 1.0, alpha: 1)

class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  private func makeConfiguration() -> ShieldConfiguration {
    let state = loadSharedState()
    let title: String
    let subtitle: String

    if let habit = state?.unlockHabit {
      let pct = max(0, min(100, Int((habit.progress * 100).rounded())))
      title = "\(habit.emoji) Finish “\(habit.name)” first"
      subtitle =
        "\(pct)% done — complete it in Routiner to unlock your apps."
    } else if let lock = state?.lock, lock.enabled, !lock.satisfied {
      title = "🔒 Apps locked"
      subtitle = "Locked \(lock.label). Make progress in Routiner."
    } else {
      // Zen session, or no readable payload — generic fallback copy.
      title = "🔒 Locked by Routiner"
      subtitle = "Finish your habits in Routiner to unlock."
    }

    return ShieldConfiguration(
      backgroundBlurStyle: .systemUltraThinMaterialDark,
      backgroundColor: routinerBlue.withAlphaComponent(0.6),
      icon: nil,
      title: ShieldConfiguration.Label(text: title, color: .white),
      subtitle: ShieldConfiguration.Label(
        text: subtitle,
        color: UIColor.white.withAlphaComponent(0.85)
      )
    )
  }

  override func configuration(
    shielding application: Application
  ) -> ShieldConfiguration {
    makeConfiguration()
  }

  override func configuration(
    shielding application: Application,
    in category: ActivityCategory
  ) -> ShieldConfiguration {
    makeConfiguration()
  }

  override func configuration(
    shielding webDomain: WebDomain
  ) -> ShieldConfiguration {
    makeConfiguration()
  }

  override func configuration(
    shielding webDomain: WebDomain,
    in category: ActivityCategory
  ) -> ShieldConfiguration {
    makeConfiguration()
  }
}

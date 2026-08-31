import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import WidgetKit
import TSBackgroundFetch

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "habittracker",
      in: window,
      launchOptions: launchOptions
    )

    // Restore the user's dark/light choice before first paint.
    ThemeManager.applyPersistedStyle()

    // [react-native-background-fetch] register BGTaskScheduler tasks.
    TSBackgroundFetch.sharedInstance().didFinishLaunching()

    return true
  }
}

/// Native side of the Settings dark-mode toggle. RN's Appearance module only
/// overrides windows attached to a UIWindowScene; the classic window created
/// above isn't, so we override every window (delegate's included) ourselves.
@objc(ThemeManager)
class ThemeManager: NSObject {
  private static let key = "routinerInterfaceStyle"

  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc func setStyle(_ style: NSString) {
    UserDefaults.standard.set(style as String, forKey: ThemeManager.key)
    DispatchQueue.main.async {
      ThemeManager.apply(style as String)
    }
  }

  static func applyPersistedStyle() {
    if let saved = UserDefaults.standard.string(forKey: key) {
      apply(saved)
    }
  }

  private static func apply(_ style: String) {
    let uiStyle: UIUserInterfaceStyle =
      style == "dark" ? .dark : style == "light" ? .light : .unspecified
    var windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
    if let delegate = UIApplication.shared.delegate as? AppDelegate,
       let w = delegate.window {
      windows.append(w)
    }
    windows.forEach { $0.overrideUserInterfaceStyle = uiStyle }
  }
}

/// Consolidated `sharedState` hand-off to the RoutinerWidget (and, later,
/// shield) extensions via the shared App Group. The defaults write always
/// happens; timeline reloads are debounced to respect WidgetKit's daily
/// reload budget, except when the lock state flipped (forceReload).
@objc(WidgetBridge)
class WidgetBridge: NSObject {
  private static let appGroup = "group.com.lucidbots.lucidbots"
  private static let minReloadInterval: TimeInterval = 60
  private static var lastReload: Date?

  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// The quote widget's timeline may fetch today's quote before the app is
  /// opened; it stores it under `dailyQuote` so the app never fetches twice.
  @objc func getDailyQuote(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(UserDefaults(suiteName: WidgetBridge.appGroup)?.string(forKey: "dailyQuote"))
  }

  @objc func setSharedState(_ json: NSString, forceReload force: Bool) {
    UserDefaults(suiteName: WidgetBridge.appGroup)?
      .set(json as String, forKey: "sharedState")
    let now = Date()
    let due = WidgetBridge.lastReload.map {
      now.timeIntervalSince($0) >= WidgetBridge.minReloadInterval
    } ?? true
    if force || due {
      WidgetBridge.lastReload = now
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

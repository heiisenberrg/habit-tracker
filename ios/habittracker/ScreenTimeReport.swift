/**
 * Screen Time report host.
 *
 * `DeviceActivityReport` is a SwiftUI view whose content is rendered by the
 * RoutinerReport extension; the numbers exist only inside that extension's
 * sandbox, so this module PRESENTS the report rather than returning values to
 * JS. Presenting SwiftUI from a sheet is the same path AppLock already uses
 * for the FamilyActivityPicker, which keeps this off the Fabric legacy
 * view-manager interop path entirely.
 */
import DeviceActivity
import FamilyControls
import React
import SwiftUI
import UIKit

// The app deploys to iOS 15.1; everything Screen Time is 16+.
@available(iOS 16.0, *)
extension DeviceActivityReport.Context {
  /// Must match the context declared in the RoutinerReport extension.
  static let wellbeing = Self("Wellbeing")
}

@available(iOS 16.0, *)
private struct ReportSheet: View {
  let done: () -> Void

  /// Today, in local wall-clock terms — a Screen Time day, not 24h back.
  private var today: DateInterval {
    Calendar.current.dateInterval(of: .day, for: Date())
      ?? DateInterval(start: Date(), duration: 86400)
  }

  var body: some View {
    NavigationView {
      ScrollView {
        DeviceActivityReport(
          .wellbeing,
          filter: DeviceActivityFilter(
            segment: .daily(during: today),
            users: .all,
            devices: .init([.iPhone])
          )
        )
        .frame(minHeight: 260)
        .padding(.horizontal, 8)
      }
      .navigationTitle("Screen Time")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done", action: done)
        }
      }
    }
  }
}

@objc(ScreenTimeReport)
class ScreenTimeReport: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { true }

  private static func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }
    var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }

  /// `{ supported, authorized }` — the screen decides what to offer from this.
  @objc func getState(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(["supported": false, "authorized": false])
      return
    }
    resolve([
      "supported": true,
      "authorized": AuthorizationCenter.shared.authorizationStatus == .approved,
    ])
  }

  /// Presents Apple's report. Resolves once the sheet is on screen.
  @objc func present(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "Screen Time reports need iOS 16 or later.", nil)
      return
    }
    DispatchQueue.main.async {
      guard let top = Self.topViewController() else {
        reject("no_window", "No view controller to present from.", nil)
        return
      }
      var host: UIViewController?
      let sheet = ReportSheet { host?.dismiss(animated: true) }
      let controller = UIHostingController(rootView: sheet)
      host = controller
      top.present(controller, animated: true) { resolve(true) }
    }
  }
}

import FamilyControls
import ManagedSettings
import React
import SwiftUI
import UIKit

/// Screen Time-based app locking: the user picks apps with the system
/// FamilyActivityPicker (tokens are opaque — we never learn which apps),
/// and `setShield` blocks/unblocks them via ManagedSettingsStore until the
/// JS side decides the unlock condition (habit done / time reached) is met.
@objc(AppLock)
class AppLock: NSObject {
  private static let selectionKey = "appLockSelection"
  private static let activeKey = "appLockShieldActive"

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: - Selection persistence

  @available(iOS 16.0, *)
  private static func loadSelection() -> FamilyActivitySelection? {
    guard let data = UserDefaults.standard.data(forKey: selectionKey) else {
      return nil
    }
    return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
  }

  @available(iOS 16.0, *)
  private static func saveSelection(_ selection: FamilyActivitySelection) {
    if let data = try? JSONEncoder().encode(selection) {
      UserDefaults.standard.set(data, forKey: selectionKey)
    }
  }

  private static func topViewController() -> UIViewController? {
    let root =
      UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }?.rootViewController
      ?? (UIApplication.shared.delegate as? AppDelegate)?.window?
        .rootViewController
    var top = root
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }

  // MARK: - Exposed methods

  @objc func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "App Lock needs iOS 16 or newer.", nil)
      return
    }
    Task {
      do {
        try await AuthorizationCenter.shared
          .requestAuthorization(for: .individual)
        resolve(true)
      } catch {
        reject(
          "denied",
          "Screen Time access was not granted (\(error.localizedDescription)).",
          error
        )
      }
    }
  }

  @objc func presentPicker(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "App Lock needs iOS 16 or newer.", nil)
      return
    }
    DispatchQueue.main.async {
      guard let presenter = Self.topViewController() else {
        reject("no-ui", "No window available to present the picker.", nil)
        return
      }
      let initial = Self.loadSelection() ?? FamilyActivitySelection()
      let picker = AppLockPickerView(selection: initial) { result in
        if let result = result {
          Self.saveSelection(result)
        }
        presenter.dismiss(animated: true)
        let saved = Self.loadSelection()
        resolve([
          "apps": saved?.applicationTokens.count ?? 0,
          "categories": saved?.categoryTokens.count ?? 0,
        ])
      }
      let host = UIHostingController(rootView: picker)
      presenter.present(host, animated: true)
    }
  }

  @objc func setShield(
    _ active: Bool,
    resolve: @escaping RCTPromiseResolveBlock,
    reject _: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(false)
      return
    }
    let store = ManagedSettingsStore()
    let selection = Self.loadSelection()
    if active, let selection = selection {
      store.shield.applications =
        selection.applicationTokens.isEmpty
        ? nil : selection.applicationTokens
      store.shield.applicationCategories =
        selection.categoryTokens.isEmpty
        ? nil : .specific(selection.categoryTokens)
    } else {
      store.shield.applications = nil
      store.shield.applicationCategories = nil
    }
    UserDefaults.standard.set(active, forKey: AppLock.activeKey)
    resolve(active)
  }

  @objc func getState(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject _: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve([
        "supported": false, "authorized": false,
        "apps": 0, "categories": 0, "active": false,
      ])
      return
    }
    let selection = Self.loadSelection()
    resolve([
      "supported": true,
      "authorized":
        AuthorizationCenter.shared.authorizationStatus == .approved,
      "apps": selection?.applicationTokens.count ?? 0,
      "categories": selection?.categoryTokens.count ?? 0,
      "active": UserDefaults.standard.bool(forKey: AppLock.activeKey),
    ])
  }
}

/// System app picker in a sheet with Cancel/Done.
@available(iOS 16.0, *)
private struct AppLockPickerView: View {
  @State var selection: FamilyActivitySelection
  let done: (FamilyActivitySelection?) -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Lock these apps")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { done(nil) }
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Done") { done(selection) }
          }
        }
    }
  }
}

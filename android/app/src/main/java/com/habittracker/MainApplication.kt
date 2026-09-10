package com.habittracker

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Hand-written native modules (one package per feature; each
          // feature owns its own line below).
          add(com.habittracker.widget.WidgetBridgePackage())
          // @native-packages
          add(com.habittracker.theme.ThemeManagerPackage())
          add(com.habittracker.applock.AppLockPackage())
          add(com.habittracker.zen.ZenModePackage())
          add(com.habittracker.screentime.ScreenTimeReportPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Persisted dark/light choice first, so the first frame already uses
    // the right night resources (see theme/ThemeManagerModule.kt).
    com.habittracker.theme.ThemeStore.applyPersisted(this)
    loadReactNative(this)
  }
}

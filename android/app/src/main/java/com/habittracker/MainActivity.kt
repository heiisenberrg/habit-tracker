package com.habittracker

import android.os.Bundle
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "habittracker"

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Health Connect's permission request launches through the host
    // Activity; without this delegate requestPermission() rejects and the
    // Settings "Health Connect" toggle can never turn on.
    HealthConnectPermissionDelegate.setPermissionDelegate(this)
    applyImeInsetsAsPadding()
    // A force-stopped app loses its alarms but not the Do Not Disturb it
    // turned on; put the Zen end alarm back (or restore an overdue session).
    com.habittracker.zen.ZenDnd.rearmIfActive(this)
  }

  /**
   * Edge-to-edge (targetSdk 35+) stops the window shrinking for the keyboard,
   * so the manifest's `adjustResize` is a no-op and every bottom control
   * (Continue, Add Habit, the reminder time field) ends up under the IME —
   * React Native only reports the keyboard height, it never pads for it.
   * Padding the content view by the IME inset gives back the layout
   * `adjustResize` produced, the same one KeyboardAvoidingView gives iOS.
   * The inset already spans the navigation bar, and it is 0 while the
   * keyboard is down, so the app keeps drawing behind the bar then.
   */
  private fun applyImeInsetsAsPadding() {
    val content = findViewById<View>(android.R.id.content) ?: return
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      view.setPadding(0, 0, 0, ime)
      insets
    }
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

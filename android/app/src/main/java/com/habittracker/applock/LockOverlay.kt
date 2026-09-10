package com.habittracker.applock

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.view.ContextThemeWrapper
import android.view.Gravity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import com.habittracker.MainActivity
import com.habittracker.R

/**
 * The shield itself: a full-screen TYPE_APPLICATION_OVERLAY window drawn
 * above the locked app. It is touch-modal (no FLAG_NOT_TOUCH_MODAL), so
 * every tap lands on us rather than the app underneath; there is no
 * FLAG_NOT_FOCUSABLE either, so the back key reaches us and sends the user
 * home instead of being swallowed by the locked app.
 */
class LockOverlay(private val context: Context) {
  private val windowManager =
    context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: View? = null

  val isShowing: Boolean
    get() = root != null

  fun show(body: String) {
    root?.let {
      it.findViewById<TextView>(R.id.applock_body).text = body
      return
    }
    // A Service context carries no activity theme; give the framework
    // Buttons a Material theme so they render with proper ripples/tints.
    val themed = ContextThemeWrapper(context, android.R.style.Theme_Material_NoActionBar)
    val container = BackInterceptingLayout(themed, ::goHome)
    LayoutInflater.from(themed).inflate(R.layout.lock_overlay, container, true)
    container.findViewById<TextView>(R.id.applock_body).text = body
    container.findViewById<View>(R.id.applock_open).setOnClickListener { openSlay() }
    container.findViewById<View>(R.id.applock_home).setOnClickListener { goHome() }

    val params =
      WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.OPAQUE,
      ).apply {
        gravity = Gravity.CENTER
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          layoutInDisplayCutoutMode =
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
      }
    try {
      windowManager.addView(container, params)
      root = container
      container.requestFocus()
    } catch (_: Exception) {
      // Overlay permission revoked mid-flight (or a bad token): the poll
      // re-tries on the next tick, and Settings shows the red state line.
      root = null
    }
  }

  fun hide() {
    val view = root ?: return
    root = null
    try {
      windowManager.removeViewImmediate(view)
    } catch (_: Exception) {
      // Already detached.
    }
  }

  private fun openSlay() {
    context.startActivity(
      Intent(context, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      },
    )
  }

  private fun goHome() {
    context.startActivity(
      Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_HOME)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      },
    )
  }

  /** Root view that turns the back key into "Home" (unhandled BACK on a non-activity window is a no-op). */
  private class BackInterceptingLayout(context: Context, private val onBack: () -> Unit) :
    FrameLayout(context) {
    init {
      isFocusable = true
      isFocusableInTouchMode = true
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
      if (event.keyCode == KeyEvent.KEYCODE_BACK) {
        if (event.action == KeyEvent.ACTION_UP) onBack()
        return true
      }
      return super.dispatchKeyEvent(event)
    }
  }
}

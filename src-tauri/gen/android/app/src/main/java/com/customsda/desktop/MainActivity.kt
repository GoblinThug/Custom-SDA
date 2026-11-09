package com.customsda.desktop

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var webView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    Companion.instance = this
  }

  override fun onDestroy() {
    if (Companion.instance === this) {
      Companion.instance = null
    }
    super.onDestroy()
  }

  override fun onResume() {
    super.onResume()
    webView?.post {
      webView?.evaluateJavascript(
        "document.dispatchEvent(new Event('csda-app-resume'))",
        null,
      )
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    this.webView = webView
  }

  companion object {
    @JvmField
    var instance: MainActivity? = null
  }
}

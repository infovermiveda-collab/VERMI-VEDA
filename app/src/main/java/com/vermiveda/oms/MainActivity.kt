package com.vermiveda.oms

import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

class MainActivity : Activity() {
 private lateinit var webView: WebView
 private val homeUrl = "https://order.vermiveda.com/"

 @SuppressLint("SetJavaScriptEnabled")
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  webView = WebView(this)
  setContentView(webView)
  webView.settings.apply {
   javaScriptEnabled = true
   domStorageEnabled = true
   databaseEnabled = true
   loadsImagesAutomatically = true
   javaScriptCanOpenWindowsAutomatically = true
   setSupportMultipleWindows(false)
   allowFileAccess = false
   allowContentAccess = false
   userAgentString = "$userAgentString VermiVedaOMS/1.0"
  }
  CookieManager.getInstance().setAcceptCookie(true)
  CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
  webView.webChromeClient = WebChromeClient()
  webView.webViewClient = object : WebViewClient() {
   override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
    val uri = request.url
    val scheme = uri.scheme ?: return false
    if (scheme == "tel" || scheme == "mailto" || uri.host == "wa.me" || uri.host == "api.whatsapp.com" || uri.host == "whatsapp.com") return openExternal(uri)
    return scheme != "https" && scheme != "http"
   }
   override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
    if (request.isForMainFrame) Toast.makeText(this@MainActivity, "Unable to load OMS. Check your internet connection.", Toast.LENGTH_LONG).show()
   }
  }
  webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
   try {
    val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
    val request = DownloadManager.Request(Uri.parse(url))
    request.setMimeType(mimeType)
    request.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
    request.addRequestHeader("User-Agent", userAgent)
    request.setTitle(filename)
    request.setDescription("Downloading Vermi Veda OMS report")
    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
    (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
    Toast.makeText(this, "Download started", Toast.LENGTH_SHORT).show()
   } catch (_: Exception) { Toast.makeText(this, "Download could not be started", Toast.LENGTH_LONG).show() }
  })
  if (savedInstanceState == null) webView.loadUrl(homeUrl) else webView.restoreState(savedInstanceState)
 }

 private fun openExternal(uri: Uri): Boolean {
  return try { startActivity(Intent(Intent.ACTION_VIEW, uri)); true }
  catch (_: ActivityNotFoundException) { Toast.makeText(this, "No app available to open this link", Toast.LENGTH_SHORT).show(); true }
 }
 override fun onSaveInstanceState(outState: Bundle) { webView.saveState(outState); super.onSaveInstanceState(outState) }
 @Deprecated("Deprecated in Android")
 override fun onBackPressed() { if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed() }
 override fun onDestroy() { if (::webView.isInitialized) webView.destroy(); super.onDestroy() }
}

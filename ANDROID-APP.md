# Vermi Veda OMS — Android

This Android application is a lightweight Android WebView shell for the live OMS at https://order.vermiveda.com/.

## Features
- Uses the existing OMS login, roles, orders and Supabase backend.
- Keeps the live website as the single source of truth; no second database is created.
- Supports JavaScript and browser storage required by the OMS.
- Opens phone, email and WhatsApp links in their Android apps.
- Supports standard file downloads initiated by the OMS.

## Build an installable APK
1. Open the repository Actions tab.
2. Select the workflow named Build Vermi Veda OMS Android APK.
3. Select Run workflow on branch android-app.
4. After the workflow succeeds, open the run and download the artifact named vermi-veda-oms-android-debug.
5. Extract the ZIP and install app-debug.apk on an Android phone. Allow installation from the browser or file manager if Android asks.

The debug APK is for testing and direct installation. A separately signed release build is required before publishing on Google Play.

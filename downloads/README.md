# Download Personal OS for Android

[![Download APK — Personal OS for Android](../site/assets/download-apk.svg)](https://bibacau.github.io/tools/personal-os.apk)

**[Open the download website](https://bibacau.github.io/tools/)**, then tap **Download for Android** on your phone. You can also tap the big Download APK button above. The download starts directly; you do not need GitHub Pages or a GitHub account.

1. Wait for **personal-os.apk** to finish downloading.
2. Tap the downloaded file (or find it in your phone's **Downloads** folder).
3. If Android asks, allow installation from your browser, then tap **Install**.

Download [personal-os.apk](https://github.com/bibacau/tools/raw/refs/heads/main/downloads/personal-os.apk) on your Android phone. Open the file and allow installation from your browser/file manager if Android asks.

- Android 7.0/API 24 or newer, with an updated Android System WebView.
- Version 1.1.0, package `com.bibacau.personalos`.
- Standalone edition: locally bundled tools and local IndexedDB records; no server required and no server sync. Create a device-local password (8+ letters/numbers). Lock/unlock preserves data. Uninstalling or clearing Android app data deletes records, so export backups first.
- Password verification uses salted PBKDF2-SHA256 (250,000 iterations). This app lock is not encryption of IndexedDB records; use Android device security.
- Native downloads open Android's share sheet; choose Files or another save destination. Share/export files are stored temporarily in the app's private cache. Ordinary notes/images/URLs are not uploaded.
- Background removal still requires an initial optional model/runtime download and a compatible WebView; actual Android model execution is unverified. The standalone edition does not bundle the optional speech server, so microphone transcription is unavailable; transcript editing/export/Notes remain available.
- The APK is release-signed (not a debug build). Signature and APK SHA-256 are in [release.json](release.json). It has not been installed/tested on a physical Android device or emulator. Mobile web behavior, packaged assets, signature, manifest and build have been checked.
- Source and corresponding build instructions: [repository](https://github.com/bibacau/tools), [Android project](../android), [README](../README.md). Distributed under AGPL-3.0; see [LICENSE](../LICENSE) and [third-party notices](../licenses/README.md).

Download page source is in `site/`. The self-hosted app serves it at `/download/` on port 8002, including the APK. The live website is https://bibacau.github.io/tools/; its button downloads the APK directly from that same website. GitHub Pages publishes the gh-pages branch.

## Version 1.0.1

Android Back returns to the previous tool/page, or the dashboard if no previous app page exists. At the dashboard it stays in the app instead of closing it. Back dismisses an open menu/search first. A visible Back arrow also works on the website; opening a tool URL directly provides a dashboard return path. Install this APK over the previous version to update without uninstalling. The application ID and signing certificate are unchanged, preserving device data.

## Version 1.1.0

Adds offline whiteboards, an isolated HTML/CSS/JS playground, and solo/friends typing races within Typing Test. VersionCode 3 uses the existing signing identity; install over the previous APK to preserve local data. Multiplayer requires access to a self-hosted server; this standalone edition does not synchronize documents with that server.

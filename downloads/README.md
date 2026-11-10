# Personal OS for Android

Download [personal-os.apk](https://github.com/bibacau/tools/raw/refs/heads/main/downloads/personal-os.apk) on your Android phone. Open the file and allow installation from your browser/file manager if Android asks.

- Android 7.0/API 24 or newer, with an updated Android System WebView.
- Version 1.0.0, package `com.bibacau.personalos`.
- Standalone edition: locally bundled tools and local IndexedDB records; no server required and no server sync. Create a device-local password (8+ letters/numbers). Lock/unlock preserves data. Uninstalling or clearing Android app data deletes records, so export backups first.
- Password verification uses salted PBKDF2-SHA256 (250,000 iterations). This app lock is not encryption of IndexedDB records; use Android device security.
- Native downloads open Android's share sheet; choose Files or another save destination. Share/export files are stored temporarily in the app's private cache. Ordinary notes/images/URLs are not uploaded.
- Background removal still requires an initial optional model/runtime download and a compatible WebView; actual Android model execution is unverified. The standalone edition does not bundle the optional speech server, so microphone transcription is unavailable; transcript editing/export/Notes remain available.
- The APK is release-signed (not a debug build). Signature and APK SHA-256 are in [release.json](release.json). It has not been installed/tested on a physical Android device or emulator. Mobile web behavior, packaged assets, signature, manifest and build have been checked.
- Source and corresponding build instructions: [repository](https://github.com/bibacau/tools), [Android project](../android), [README](../README.md). Distributed under AGPL-3.0; see [LICENSE](../LICENSE) and [third-party notices](../licenses/README.md).

Download page source is in `site/`. The self-hosted app serves it at `/download/` on port 8002, including the APK. The GitHub Pages workflow publishes a separate static download site when Pages deployment is available for the repository.

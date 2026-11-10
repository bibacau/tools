# Personal OS

A private, offline-first workspace with twelve everyday tools. React + TypeScript + Vite; an Express server; Prisma's JavaScript query engine over SQLite; IndexedDB for device-local records; a versioned Workbox PWA. No CDN assets or hosted fonts for the application shell; background removal optionally downloads its model/runtime. Runs on **port 8002**.

## Docker

```sh
cp .env.example .env
docker compose up -d --build
```

Open **http://localhost:8002** and create your single-user account (new passwords require at least 8 ASCII letters/numbers only). The first person to access an uninitialized server becomes the owner: initialize on a trusted network before remote exposure. No default account or password is shipped. Set `PORT` in `.env` to change the host port. The container still listens on 8002.

The `personal-os-data` named volume retains SQLite across container replacement. Transactional, checksummed SQL migrations run automatically before startup; applied migrations are never edited or reset. An embedded migration runner avoids requiring Prisma engine downloads at runtime. Prisma handles application queries. Container runs as a non-root user with dropped capabilities and a database health check.

Initial builds need npm, Debian and container registries. Subsequent `docker compose up -d --no-build` works without internet when images and volumes are present. Do not run `docker compose down -v` unless you intend to delete server data.

## Local development

Node 22.12+ (22 LTS recommended), npm, and a working native build toolchain if `better-sqlite3` has no prebuilt binary for your platform.

```sh
cp .env.example .env
npm ci
npm run dev
```

Vite serves 8002 and proxies `/api` to Express on 8003. `npm run build && npm start` serves the production PWA on 8002. Development mode does not install the service worker; test offline functionality using the production build. No additional service is required for the browser-only tools.

```sh
npm run lint
npm test
npm run build
npm run test:e2e
```

Browser tests use system Chromium at `/usr/bin/chromium`; override with `CHROMIUM_PATH`. They run a separate server on 8004 and test database at `/tmp/personal-os-e2e-<pid>.db`, with a test-only password. These credentials never initialize your production database. Delete that test database between clean test runs if desired. Tests cover utility constants and safety, account setup/login, API privacy, IndexedDB notes, cached PWA reload, disconnected editing, reconnection, revision conflict rejection, mobile navigation, multiple wheels, QR generation, offline graphs and provider failures. This is representative coverage, not certification across all devices or exhaustive coverage of every feature.

## Offline and synchronization

Visit once over localhost or HTTPS and allow the service worker to finish installing. All bundled tool chunks, icons, conversion constants and typing passages are precached, including lazy-loaded graph code. The first install needs the server; a fresh browser cannot bootstrap without it. Service workers and microphone APIs require a secure context. Plain HTTP LAN addresses generally cannot install the offline worker; use trusted HTTPS for phone/LAN use.

Records live in IndexedDB before synchronization. Each has a UUID, server revision, local version and dirty flag. Offline writes queue automatically. Sync runs after changes, on focus/reconnection and once a minute while visible (to detect a server returning when the browser's online hint did not change). Each server write compares its base revision transactionally. A conflict preserves a separate local conflict copy rather than overwriting the server record. Conflict copies are identified in their titles; review and merge the copies manually. Deletions are tombstones so offline clients cannot resurrect deleted records silently. Settings shows the last successful sync and storage status; the footer can retry sync.

Cached data remains accessible on an already authorized device while offline, until local logout/clearing. Offline authorization is a device-local policy marker, not a server credential. Passwords are bcrypt hashes on the server. Sessions use random opaque HttpOnly SameSite cookies; set `COOKIE_SECURE=true` behind HTTPS. No raw password or session token is stored in IndexedDB/localStorage. Cached records are **not encrypted at rest**; anyone with access to your unlocked browser profile can read them. Device encryption and a trusted OS account are recommended. Logout clears this device's records; **sync/export pending work first**. If the server cannot be reached, its cookie/session cannot be remotely revoked until reconnection. Browser storage may be evicted: request persistence in Settings and keep backups.

Browser `navigator.onLine` is only a connection hint, not proof of internet access. Sync status reports the actual local-server request outcome. IP Information and Currency Converter have been removed. Saved historical data remains in backups. Optional external requests now apply to background-removal model/runtime downloads only, explicitly triggered by processing. With the setting disabled, model access is cache-only.

## Tools and internet dependencies

All rows assume the app was installed/cached first. “No server” means completely disconnected operation on that previously authorized device.

| Tool           | Without internet                                                                 | Without local server                                      | Optional internet data      | Setup downloads                                   | Browser limitations                                                                                                      |
| -------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Notes          | Yes; local CRUD, rich text, folders, tags, pin, search, sort, TXT/Markdown       | Yes; sync queued                                          | None                        | App assets                                        | IndexedDB; storage eviction; imports treat Markdown as editable plain text, exports preserve common rich-text formatting |
| QR Generator   | Yes; text, URL, Wi-Fi, vCard; SVG/PNG                                            | Yes                                                       | None                        | Bundled QR library                                | Image clipboard needs browser support/HTTPS; maintain sufficient contrast                                                |
| Unit Converter | Yes; 17 categories, precision, density, favorites                                | Yes                                                       | None                        | Bundled constants                                 | Density presets approximate at ~20°C; standard IEEE-754 arithmetic                                                       |
| Graph Plotter  | Yes; safe expressions, multiple curves, pan/zoom, points/table, PNG, saved views | Yes                                                       | None                        | Bundled math engine                               | Sampling may miss fine/asymptotic features; finite range only                                                            |
| Lucky Wheel    | Yes; weighted choices, independent/multiple wheels, spin all, history            | Yes                                                       | None                        | App assets                                        | Sound requires browser audio permission; labels truncated visually, full labels remain editable                          |
| Reaction Time  | Yes                                                                              | Yes                                                       | None                        | App assets                                        | Device/browser/display latency affects measurements                                                                      |
| CPS Test       | Yes                                                                              | Yes                                                       | None                        | App assets                                        | Pointer input timing depends on device/browser                                                                           |
| Typing Test    | Yes; local passages, WPM/raw/accuracy/history                                    | Yes                                                       | None                        | Local passages                                    | Paste disabled; keyboard/autocorrect behavior varies                                                                     |
| Speech to Text | Yes **with local speech server and model installed**                             | Editable cached transcripts only; recognition unavailable | **None; no cloud fallback** | Optional Vosk model, Python service image, FFmpeg | Microphone needs HTTPS/localhost, permission, MediaRecorder; 25 MB / 10 minute limits                                    |

Density-based volume-to-mass conversion explicitly requires density. Graph expressions accept only an allowlist of mathematical nodes/functions and are never executed as JavaScript.

## Optional speech recognition

Speech recognition is CPU-only Vosk on your local server. It is not a browser-local recognition engine and will not transcribe when disconnected from the server. The service runs only if you enable its Compose profile. It never downloads a model during website usage, and audio is sent only to your own server when you explicitly stop recording.

1. Run `./scripts/install-speech-model.sh` to explicitly install the English model (requires curl and unzip), or download a model from the official [Vosk model catalog](https://alphacephei.com/vosk/models), e.g. `vosk-model-small-en-us-0.15` (about 40 MB download). Follow its licensing and publisher verification guidance.
2. Extract so `models/model/` contains `am`, `conf`, `graph`, etc. Use a matching installed model for additional languages; the app's language selector does not magically install or switch models.
3. Run `docker compose --profile speech up -d --build`.
4. Open Speech to Text and grant microphone access. Pause/resume records locally; Stop sends audio to the local recognizer. Edit, copy, export or save results as Notes.

Small models typically need a few hundred MB of RAM plus service overhead; accuracy depends on model, microphone and environment. No dedicated GPU, Ollama or third-party speech service is required. The optional service/model installation and real microphone transcription have **not** been validated in this cloud task. Speech stays clearly unavailable until the service health check succeeds. Limitations and setup are exposed in the interface.

## Backup, restore and upgrades

Settings → Export data saves every locally available record as JSON. Export after a successful sync to include all server records. Import validates the backup structure and creates copies, preserving existing records. Keep these exports private; they contain unencrypted notes and cached QR contents.

For a complete server backup (including account and sessions), stop the app briefly to take a consistent copy:

```sh
docker compose stop personal-os
mkdir -p backups
docker compose cp personal-os:/app/data/. ./backups/
docker compose start personal-os
```

Restore into a stopped container with `docker compose cp ./backups/. personal-os:/app/data/`, ensure files are writable by UID 1000, then start. Protect backups and test restoration. For upgrades, take a backup first, then `docker compose up -d --build`. Never delete the volume or alter already-applied migration SQL. The startup runner verifies checksums and fails rather than applying destructive resets.

## Remote access

The app is not published automatically. Put it behind a trusted TLS reverse proxy for remote/LAN use; set `COOKIE_SECURE=true` and preserve the original Host/Origin headers. Optionally configure Cloudflare Tunnel yourself to point to `http://personal-os:8002` with a valid HTTPS hostname. This requires a Cloudflare account/token and external connectivity; do not place tokens in source control. HTTPS is required for secure cookies, microphone and PWA functionality on non-localhost hosts. Initial account setup must happen before exposing the service.

## Expansion and current scope

Tool routes are defined in `src/catalog.ts`, routed through `src/tools.tsx` and loaded separately from the dashboard. Pure algorithms belong in separate modules with unit tests. Use `store.create/put/remove` for local-first records and add a new checksummed SQL migration for server schema changes. Server endpoints belong under authenticated `/api`; never cache private API responses in the service worker. Sanitize imported rich text before displaying it.

This implementation uses Vite/React rather than Next.js, custom CSS rather than Tailwind/shadcn, and a locally rendered SVG graph rather than Plotly. It includes twelve tool interfaces, but speech recognition requires the optional service/model above. Floating desktop windows are not included. Conflict resolution is manual via preserved copies. Background model-loading failures are tested; successful inference remains unverified because this cloud blocks staticimgly.com. Cross-browser/device coverage, real speech-model accuracy, and HTTPS/Cloudflare deployment require separate validation.

## Validation in this cloud workspace

- TypeScript check and production PWA build: passed.
- ESLint: passed.
- Vitest: 12 tests passed.
- Playwright/Chromium: 7 end-to-end scenarios passed, including actual offline reload/editing, reconnect synchronization, preservation of conflicting offline edits, all tool routes, URL restoration, image transparency/compositing/ZIP downloads, model-loading failures, wheel persistence and mobile navigation.
- Docker Compose configuration validated. The original main application image built and ran successfully as a non-root user. Authenticated writes, the health endpoint, automatic migration and account/SQLite persistence across a container restart passed.
- Optional Vosk model download was denied by the cloud's outbound policy (`alphacephei.com`, HTTP proxy 403). The required domain is saved in the environment draft. Review/save and publish that configuration to enable future setup downloads, or install the model on your Docker host following the instructions above. No TLS/checksum verification was disabled. Real speech transcription remains unverified.

After an application upgrade, close all open Personal OS tabs and reopen to activate the waiting service worker. IndexedDB remains separate from versioned asset caches. Export a backup before upgrades.

## Image and URL tools

- **Image Format Converter** (`/image-converter`): browser Canvas/createImageBitmap converts JPG/PNG/WebP. Multi-file upload/drag-drop, previews/dimensions/input-output sizes, JPG/WebP quality, alpha preservation for PNG/WebP, JPG background color, individual downloads and fflate ZIP. Settings changes invalidate outputs until reconverted. Browser color/quality handling varies; most metadata is stripped. Limits: 20 files, 25 MB/file, 40 MP. Decoding can still require substantial RAM. Files/outputs are memory-only; object URLs are revoked on removal/navigation. PNG/JPG work in modern Chromium/Firefox/Safari; unsupported WebP encoding produces a clear error.
- **URL Cleaner** (`/url-cleaner`): no visits, fetches, redirects, previews or persistence. Removes `utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `mc_cid`, `mc_eid` case-insensitively. Functional parameters, duplicate values, original encoding, paths and fragments remain. Restore individual tracking fields in original order. Batch copy skips invalid URLs; errors are shown per line. Only HTTP/HTTPS inputs are accepted. Modifying signed URLs may invalidate them even when a field looks like tracking. Clipboard requires a secure context/permission; selectable output is the fallback.
- **Background Remover** (`/background-remover`): real IMG.LY 1.7.0 quantized IS-Net segmentation runs in a disposable CPU Web Worker. No color-key mask, fake result or server image upload. Heavy worker/ONNX code loads only on request. First use explicitly downloads ~40 MB model plus runtime from **staticimgly.com**; enable optional internet features in Settings. Successful model GETs are cached in Cache Storage, and the PWA caches worker JS after first use. Offline inference requires every required asset already cached, HTTPS/localhost, WebAssembly and sufficient RAM. Storage eviction or partial downloads require another download. Only model assets are cached, never images. Cancel terminates the worker. Inference may need several hundred MB or more; sources are resized to a 2048 px longest edge. Before/after checkerboard previews; transparent PNG or optional solid-color PNG export. Fine hair, glass, edges and unusual scenes may show artifacts. **Successful inference and its transparent output could not be verified here: the cloud proxy denies staticimgly.com (403).** Model-loading failure handling is browser-tested; no fake success is substituted. The host addition is saved in the environment draft for review/save/publication.

| Added tool             | Without internet                     | Without server              | Browser/setup limits                                                      |
| ---------------------- | ------------------------------------ | --------------------------- | ------------------------------------------------------------------------- |
| Image Format Converter | After PWA caching                    | Yes                         | Canvas/createImageBitmap; WebP encoding varies; RAM limits                |
| URL Cleaner            | After PWA caching                    | Yes                         | Clipboard permission/HTTPS; no URL fetching                               |
| Background Remover     | After complete model/runtime caching | After worker/assets caching | Initial model download, HTTPS/localhost, WASM, RAM; output quality varies |

Choose **Cozy forest** in Settings → Theme: moss navigation, parchment backgrounds, terracotta accents, serif headings and original local fox/owl/woodland artwork inspired by the supplied reference. Dark/light/system remain; preference is saved and synced.

New account/password-change policy: **8–200 ASCII letters/numbers**, not forced truncation to eight. Existing hashes/passwords are never reset, including legacy passwords with punctuation. Use Settings → Account password with the current password to change it. Changes revoke other server sessions; they cannot revoke authorized offline caches on a disconnected device.

### Licensing

This version adds IMG.LY Background Removal under **AGPL-3.0**; the combined application is distributed under AGPL-3.0. See `LICENSE`, `licenses/README.md`, upstream notices and [corresponding source](https://github.com/bibacau/tools). ONNX Runtime and fflate are MIT licensed. No paid API is used. Preserve source availability and notices when distributing or serving modified versions. Proprietary embedding requires appropriate alternative rights or replacing the AGPL dependency.

## Android APK and download website

The signed standalone APK is committed at [`downloads/personal-os.apk`](downloads/personal-os.apk), with hashes/version information in [`downloads/release.json`](downloads/release.json). Download directly from [GitHub](https://github.com/bibacau/tools/raw/refs/heads/main/downloads/personal-os.apk), open on Android 7.0+ and allow installation from that browser/file manager when prompted. It is a direct APK, not a Google Play release.

The APK bundles the application shell and all ordinary tool code locally via Capacitor 8. It uses its own device-local password verifier and IndexedDB data. There is **no server connection or sync** in this standalone edition. The app asks for its local password on a fresh launch/reload; Lock preserves records. Its salted PBKDF2-SHA256 verifier is not a plaintext password, but the app lock does not encrypt the record database. Android cloud backup is disabled. Uninstallation/clear-storage deletes data; use Settings export/restore. Native exports invoke Android's share sheet (Files/other destinations) using private cache files; images and URLs are never automatically uploaded.

Background removal requires the initial optional model/runtime download, WebAssembly support and substantial memory; it has not been exercised on a physical Android device. The optional speech-recognition server is not bundled/configured in the APK, so microphone transcription is unavailable. The transcript editor remains usable. Native browser verification covers account creation, lock/unlock, persistence across reload, zero server API requests and mobile layout; release signing and manifest checks verify the actual APK. No Android emulator or physical-device installation test was performed.

### Rebuild a signed APK

Prerequisites: Node 22.12+, JDK 21 with compiler, Android SDK platform 36, build-tools 36.0.0 and platform-tools. `android/gradle/wrapper/gradle-wrapper.properties` pins Gradle and its official SHA-256. First-time builds need npm/Google Maven/Maven Central/Gradle repositories and SDK downloads. Keep package-signature/TLS/checksum verification enabled.

```sh
npm ci
export ANDROID_HOME=/path/to/android-sdk
export JAVA_HOME=/path/to/jdk-21
npm run android:sync
# Set these from your private signing key/secure environment, never commit them:
export APP_RELEASE_STORE_FILE=/absolute/path/to/release.keystore
export APP_RELEASE_STORE_PASSWORD='your-private-keystore-password'
npm run android:apk
node scripts/package-apk.mjs
```

The alias is `personal-os`. The first release was signed with a generated private key held in the ignored `.android-signing/` directory of the build workspace. **Back up that directory securely** if you own/manage this build environment. It is never uploaded to GitHub, included in the APK, or exposed on the download website. Future updates must retain that key, application ID and an increased versionCode to update existing installations without uninstalling. Losing the private key requires a separately signed installation and a manual data backup/restore. Do not publish private signing keys or passwords.

APK source: `capacitor.config.ts`, `android/`, `src/platform.ts`; builds use `VITE_NATIVE=true` and `dist-native/`. Web builds remain server-backed and use `dist/`; they are not switched into standalone mode. `npm run build:android:web` prepares bundled assets, `npm run android:sync` syncs plugins/assets, and `npm run android:apk` assembles the signed release when signing variables are set. `node tests/native-browser.mjs` validates the built native web assets in a mobile Chromium viewport.

### Download website

The static website in `site/` uses local artwork/fonts, responsive layouts, installation instructions, limitations, source/license links and the release checksum. The existing Express app serves it publicly at `/download/` on port **8002**, with the actual APK at `/download/personal-os.apk`; Docker copies both `site/` and `downloads/`.

`.github/workflows/download-site.yml` copies the APK/metadata into the static deployment and publishes to GitHub Pages on changes to the website/APK. It attempts to enable Pages using the repository's workflow token. The intended public address is `https://bibacau.github.io/tools/`. If repository settings prevent that workflow from enabling Pages, the owner must select **Settings → Pages → Source: GitHub Actions**, then re-run “Publish Android download website” under Actions. A configured workflow or pushed source alone does not establish that the site is publicly live; use the deployment result.

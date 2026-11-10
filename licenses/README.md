# Third-party licenses

Personal OS includes IMG.LY Background Removal 1.7.0, licensed under GNU AGPL-3.0 (see root LICENSE). This application's combined distribution is provided under AGPL-3.0. Source, including modifications and build instructions, must remain available to recipients and network users as required by the AGPL. Source repository: https://github.com/bibacau/tools. No paid API or commercial license is required for AGPL-compliant use. If you need a proprietary distribution, obtain appropriate rights from IMG.LY or replace this dependency.

IMG.LY's IS-Net model data is governed by the background-removal project's published license; the upstream project and model assets must retain their notices when self-hosted. The bundled third-party notices are in imgly-third-party.json. Model reference: https://github.com/imgly/background-removal-js (the quantized isnet_quint8 model).

ONNX Runtime Web 1.21.0 is MIT licensed (Microsoft); fflate is MIT licensed. React, Vite, Lucide, mathjs, Prisma and other existing libraries retain their respective licenses in their npm packages. Versions/integrity hashes are pinned in package-lock.json. Original woodland.svg is project artwork under the application's license; it contains no third-party illustration assets.

The Android edition uses Capacitor core/Android/CLI and Filesystem/Share plugins under the MIT license. The Gradle wrapper is Apache-2.0. Android SDK/JDK/Gradle are build prerequisites and retain their upstream licenses; they are not bundled in the APK. The APK includes the corresponding web/native application code built from this repository; signing secrets are not part of corresponding source.

Whiteboard, Playground and Typing Race add Fabric.js, CodeMirror/react-codemirror, jsPDF, ws and Prettier, all MIT licensed. Their copyright and permission notices are retained in [new-tools.txt](new-tools.txt).

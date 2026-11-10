import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
const apkPath =
  process.argv[2] || "android/app/build/outputs/apk/release/app-release.apk";
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) throw Error("Set ANDROID_HOME to the installed SDK");
const signer = path.join(sdk, "build-tools", "36.0.0", "apksigner");
const output = execFileSync(signer, ["verify", "--print-certs", apkPath], {
  encoding: "utf8",
});
const certificate = output.match(
  /certificate SHA-256 digest: ([a-f0-9]+)/,
)?.[1];
if (!certificate) throw Error("APK signature verification failed");
const apk = await readFile(apkPath);
await mkdir("downloads", { recursive: true });
await writeFile("downloads/personal-os.apk", apk);
await writeFile(
  "downloads/release.json",
  JSON.stringify(
    {
      name: "Personal OS",
      version: "1.1.0",
      versionCode: 3,
      packageId: "com.bibacau.personalos",
      minAndroid: "7.0",
      minSdk: 24,
      targetSdk: 36,
      file: "personal-os.apk",
      sizeBytes: apk.length,
      sha256: createHash("sha256").update(apk).digest("hex"),
      signingCertificateSha256: certificate,
      edition: "Standalone local storage; no server sync",
      source: "https://github.com/bibacau/tools",
      license: "AGPL-3.0",
      realDeviceTested: false,
    },
    null,
    2,
  ) + "\n",
);
console.log("Verified signed APK copied to downloads/ with checksum metadata.");

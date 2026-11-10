import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.bibacau.personalos",
  appName: "Personal OS",
  webDir: "dist-native",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false },
  plugins: { SplashScreen: { launchAutoHide: true } },
};
export default config;

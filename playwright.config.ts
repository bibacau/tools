import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8004",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: `DATABASE_URL=file:/tmp/personal-os-e2e-${process.pid}.db PORT=8004 sh -c "node server/migrate.js && node server/index.js"`,
    port: 8004,
    reuseExistingServer: !process.env.CI,
  },
});

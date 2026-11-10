import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
test("public download page serves a real signed APK with matching metadata and mobile layout", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.goto("/download/");
  await expect(
    page.getByRole("heading", { name: /A little more useful/ }),
  ).toBeVisible();
  const metadata = await (await request.get("/download/release.json")).json();
  expect(metadata.packageId).toBe("com.bibacau.personalos");
  expect(metadata.sizeBytes).toBeGreaterThan(1_000_000);
  const event = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download for Android", exact: false })
    .click();
  const d = await event;
  expect(d.suggestedFilename()).toBe("personal-os.apk");
  const data = await readFile((await d.path())!);
  expect(createHash("sha256").update(data).digest("hex")).toBe(metadata.sha256);
  expect(data[0]).toBe(0x50);
  expect(data[1]).toBe(0x4b);
  await page.screenshot({
    path: "/tmp/personal-os-android/download-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: "Download for Android", exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/personal-os-android/download-mobile.png",
    fullPage: true,
  });
});

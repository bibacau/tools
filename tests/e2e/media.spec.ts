import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
async function login(page: any) {
  await page.goto("/");
  await page.getByLabel("Password", { exact: true }).fill("Forest88");
  await page
    .getByRole("button", { name: /Create my workspace|Unlock workspace/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your everyday, simplified." }),
  ).toBeVisible();
}
async function fixture(page: any) {
  return Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 4;
      c.height = 2;
      const x = c.getContext("2d")!;
      x.fillStyle = "#ff0000";
      x.fillRect(0, 0, 2, 2);
      return c.toDataURL().split(",")[1];
    }),
    "base64",
  );
}
async function resultPixel(page: any) {
  return page
    .getByAltText("Result transparent.png")
    .evaluate(async (img: HTMLImageElement) => {
      const c = document.createElement("canvas");
      c.width = 4;
      c.height = 2;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      return [...x.getImageData(3, 1, 1, 1).data];
    });
}
test("PNG/WebP alpha, JPG compositing, ZIP and corrupt images", async ({
  page,
}) => {
  await login(page);
  await page.goto("/image-converter");
  const buffer = await fixture(page);
  await page.getByLabel("Choose images").setInputFiles([
    { name: "transparent.png", mimeType: "image/png", buffer },
    { name: "second.png", mimeType: "image/png", buffer },
  ]);
  await page
    .getByRole("button", { name: "Convert images", exact: true })
    .click();
  await expect(page.getByAltText("Result transparent.png")).toBeVisible();
  expect((await resultPixel(page))[3]).toBe(0);
  const zipEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all as ZIP" }).click();
  const zip = await zipEvent;
  expect(
    Object.keys(unzipSync(await readFile((await zip.path())!))),
  ).toHaveLength(2);
  await page
    .getByLabel("Output format", { exact: true })
    .selectOption("image/webp");
  await page
    .getByRole("button", { name: "Convert images", exact: true })
    .click();
  await expect(
    page.getByText("Settings changed.", { exact: false }),
  ).toHaveCount(0);
  expect((await resultPixel(page))[3]).toBe(0);
  await page
    .getByLabel("Output format", { exact: true })
    .selectOption("image/jpeg");
  await page.getByLabel("Background color").fill("#00ff00");
  await page
    .getByRole("button", { name: "Convert images", exact: true })
    .click();
  await expect(
    page.getByText("Settings changed.", { exact: false }),
  ).toHaveCount(0);
  const jpg = await resultPixel(page);
  expect(jpg[3]).toBe(255);
  expect(jpg[1]).toBeGreaterThan(150);
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download JPG", exact: true })
    .first()
    .click();
  expect((await event).suggestedFilename()).toBe("transparent.jpg");
  await page.getByLabel("Choose images").setInputFiles({
    name: "corrupt.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByRole("alert")).toContainText("corrupt");
  await page.getByLabel("Choose images").setInputFiles({
    name: "unsupported.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  });
  await expect(
    page.getByText("Unsupported file.", { exact: false }),
  ).toBeVisible();
  await page.evaluate(
    (data) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(data)], "dropped.png", { type: "image/png" }),
      );
      document
        .querySelector(".drop-zone")!
        .dispatchEvent(
          new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
        );
    },
    [...buffer],
  );
  await expect(page.getByAltText("Original dropped.png")).toBeVisible();
});
test("URL restore, invalid input, cozy forest and mobile layout", async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto("/url-cleaner");
  await page
    .getByLabel("URLs · one per line")
    .fill(
      "https://example.com/a?id=7&utm_source=mail&fbclid=abc#here\nftp://example.com/file\nhttps://example.com/?sig=abc&gclid=xyz",
    );
  const outputs = page.getByLabel("Cleaned URL", { exact: true });
  await expect(outputs.first()).toHaveValue("https://example.com/a?id=7#here");
  await page.getByLabel("Restore utm_source", { exact: false }).check();
  await expect(outputs.first()).toHaveValue(
    "https://example.com/a?id=7&utm_source=mail#here",
  );
  await expect(page.getByRole("alert")).toContainText("Only valid HTTP");
  await expect(
    page.getByText("This looks like a signed link.", { exact: false }),
  ).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy all cleaned URLs" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(
      "https://example.com/a?id=7&utm_source=mail#here\nhttps://example.com/?sig=abc",
    );
  await page.goto("/settings");
  await page.getByLabel("Theme", { exact: false }).selectOption("cozy-forest");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    "cozy-forest",
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    "cozy-forest",
  );
  await page.screenshot({
    path: "test-results/cozy-forest-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/image-converter");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/image-mobile.png",
    fullPage: true,
  });
  await page.goto("/url-cleaner");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("background remover handles real model loading failure without uploading the image", async ({
  page,
}) => {
  await login(page);
  await page.goto("/settings");
  await page.getByLabel("Allow optional internet features").check();
  await page.goto("/background-remover");
  const buffer = await fixture(page);
  await page
    .getByLabel("Choose images")
    .setInputFiles({ name: "subject.png", mimeType: "image/png", buffer });
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://staticimgly.com"))
      requests.push(r.method());
  });
  await page.route("https://staticimgly.com/**", (r) =>
    r.fulfill({ status: 503, body: "Model unavailable" }),
  );
  await page
    .getByRole("button", { name: "Remove background", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Model download failed (HTTP 503)",
    { timeout: 20000 },
  );
  expect(requests.length).toBeGreaterThan(0);
  await expect(page.getByAltText("Result subject.png")).toHaveCount(0);
  expect(requests.every((m) => m === "GET")).toBe(true);
  await expect(page.getByAltText("Original subject.png")).toBeVisible();
});
test("password changes enforce eight alphanumeric characters and require the current password", async ({
  page,
  context,
}) => {
  await login(page);
  expect(
    (
      await context.request.post("/api/password", {
        data: { currentPassword: "Forest88", newPassword: "short7" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await context.request.post("/api/password", {
        data: { currentPassword: "wrong", newPassword: "Forest99" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await context.request.post("/api/password", {
        data: { currentPassword: "Forest88", newPassword: "Forest99" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await context.request.post("/api/auth", {
        data: { password: "Forest88" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await context.request.post("/api/auth", {
        data: { password: "Forest99" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await context.request.post("/api/password", {
        data: { currentPassword: "Forest99", newPassword: "Forest88" },
      })
    ).status(),
  ).toBe(200);
});

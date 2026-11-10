import express from "express";
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";
const app = express();
app.use(express.static("dist-native"));
app.get("/{*path}", (req, res) =>
  res.sendFile(process.cwd() + "/dist-native/index.html"),
);
const server = app.listen(8006, "127.0.0.1");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const api = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url());
  });
  await page.goto("http://127.0.0.1:8006");
  await page.getByLabel("Password", { exact: true }).fill("Forest88");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await page
    .getByRole("heading", { name: "Your everyday, simplified." })
    .waitFor();
  await page
    .getByRole("button", { name: /Notes A little space/ })
    .first()
    .click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Note title", exact: true })
    .fill("Mobile note");
  await page
    .getByRole("textbox", { name: "Note body" })
    .fill("Saved without a server");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Lock app" }).click();
  await page.getByLabel("Password", { exact: true }).fill("Forest88");
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await page
    .getByRole("textbox", { name: "Note title", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Note title", exact: true })
      .inputValue(),
    "Mobile note",
  );
  assert.equal(
    await page.getByRole("textbox", { name: "Note body" }).textContent(),
    "Saved without a server",
  );
  await page.reload();
  await page.getByRole("button", { name: "Unlock workspace" }).waitFor();
  await page.getByLabel("Password", { exact: true }).fill("Forest88");
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await page.getByRole("textbox", { name: "Note body" }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Note body" }).textContent(),
    "Saved without a server",
  );
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your everyday, simplified." })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Go back", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: /QR Generator Turn anything/ })
    .click();
  await page
    .getByRole("heading", { name: "QR Generator", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your everyday, simplified." })
    .waitFor();
  await page.goto("http://127.0.0.1:8006/whiteboard");
  await page.getByLabel("Password", { exact: true }).fill("Forest88");
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await page
    .getByRole("button", { name: "New whiteboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add rectangle", exact: true })
    .click();
  await page.getByText(/1 objects ·/).waitFor();
  await page.getByRole("status").filter({ hasText: "Saved" }).waitFor();
  await page.goto("http://127.0.0.1:8006/playground");
  await page.getByLabel("Password", { exact: true }).fill("Forest88");
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .frameLocator("iframe")
    .getByRole("heading", { name: "Hello, little world." })
    .waitFor();
  await page
    .frameLocator("iframe")
    .getByRole("button", { name: "Say hello" })
    .click();
  await page
    .getByRole("log")
    .filter({ hasText: "Hello from your sandbox!" })
    .waitFor();
  assert.equal(api.length, 0, "Native edition made an API request");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "/tmp/personal-os-android/native-mobile.png",
    fullPage: true,
  });
  console.log(
    "Standalone mobile browser: account, lock/unlock, reload persistence, zero API requests, Back navigation, whiteboard editing, Playground execution and mobile layout passed.",
  );
} finally {
  await browser.close();
  server.close();
}

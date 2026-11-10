import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
test("whiteboard edits, transformations, grouping, undo, exports and offline reload", async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto("/whiteboard");
  await page
    .getByRole("button", { name: "New whiteboard", exact: true })
    .click();
  await page
    .getByLabel("Whiteboard name", { exact: true })
    .fill("Offline ideas");
  await page
    .getByRole("button", { name: "Add rectangle", exact: true })
    .click();
  await expect(page.getByText(/1 objects ·/)).toBeVisible();
  await page.getByRole("button", { name: "Add circle", exact: true }).click();
  await expect(page.getByText(/2 objects ·/)).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText(/1 objects ·/)).toBeVisible();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByText(/2 objects ·/)).toBeVisible();
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.getByRole("button", { name: "Group", exact: true }).click();
  await expect(page.getByText(/1 objects ·/)).toBeVisible();
  await page.getByLabel("Selected angle").fill("35");
  await page.getByRole("button", { name: "Ungroup", exact: true }).click();
  await expect(page.getByText(/2 objects ·/)).toBeVisible();
  for (const format of ["SVG", "PNG", "PDF"]) {
    const event = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export " + format, exact: true })
      .click();
    const d = await event;
    const data = await readFile((await d.path())!);
    if (format === "SVG") expect(data.toString()).toContain("<svg");
    if (format === "PNG") {
      expect([...data.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
      const hasPixels = await page.evaluate(async (encoded: string) => {
        const img = new Image();
        img.src = "data:image/png;base64," + encoded;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx
          .getImageData(0, 0, c.width, c.height)
          .data.some((v, i) => i % 4 === 3 && v > 0);
      }, data.toString("base64"));
      expect(hasPixels).toBe(true);
    }
    if (format === "PDF") expect(data.subarray(0, 4).toString()).toBe("%PDF");
  }
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Editable project", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await event).path())!, "utf8"),
  );
  expect(backup.content.canvas.objects).toHaveLength(2);
  await page
    .getByLabel("Import project", { exact: true })
    .setInputFiles({
      name: "roundtrip.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await expect(page.getByText(/2 objects ·/)).toBeVisible();
  await page.screenshot({
    path: "/tmp/personal-os-whiteboard.png",
    fullPage: true,
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Add text", exact: true }).click();
  await expect(page.getByText(/3 objects ·/)).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(page.getByLabel("Whiteboard name", { exact: true })).toHaveValue(
    "Offline ideas",
  );
  await expect(page.getByText(/3 objects ·/)).toBeVisible();
  await context.setOffline(false);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("playground executes isolated JavaScript, reports errors, saves offline and exports", async ({
  page,
  context,
}) => {
  await login(page);
  const previewResponse = await page.request.get("/playground-preview.html");
  expect(previewResponse.headers()["content-security-policy"]).toContain(
    "sandbox allow-scripts",
  );
  await page.goto("/playground");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Isolated demo");
  await page
    .getByRole("textbox", { name: "HTML editor", exact: true })
    .fill('<h1>Sandbox demo</h1><button id="counter">Click</button>');
  await page.getByRole("button", { name: "JS", exact: true }).click();
  await page
    .getByRole("textbox", { name: "JS editor", exact: true })
    .fill(
      'console.log("sandbox ready"); try { console.log(parent.document.cookie); } catch(e) { console.log("parent blocked"); } try { localStorage.setItem("escape", "bad"); } catch(e) { console.log("storage blocked"); } throw new Error("test error");',
    );
  await page.getByRole("button", { name: "Run preview", exact: true }).click();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Sandbox demo" }),
  ).toBeVisible();
  await expect(page.getByRole("log")).toContainText("sandbox ready");
  await expect(page.getByRole("log")).toContainText("parent blocked");
  await expect(page.getByRole("log")).toContainText("storage blocked");
  await expect(page.getByRole("log")).toContainText("test error");
  await page.screenshot({
    path: "/tmp/personal-os-playground.png",
    fullPage: true,
  });
  expect(await page.evaluate(() => localStorage.getItem("escape"))).toBe(null);
  expect(await page.locator("iframe").getAttribute("sandbox")).toBe(
    "allow-scripts",
  );
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.getByRole("button", { name: "HTML", exact: true }).click();
  await page
    .getByRole("textbox", { name: "HTML editor", exact: true })
    .fill("<h1>Written offline</h1>");
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Isolated demo",
  );
  await expect(
    page.getByRole("textbox", { name: "HTML editor", exact: true }),
  ).toContainText("Written offline");
  await expect(
    page
      .frameLocator("iframe")
      .getByRole("heading", { name: "Written offline" }),
  ).toBeVisible();
  await expect(page.getByRole("log")).toContainText("parent blocked");
  await expect(page.getByRole("log")).toContainText("storage blocked");
  await context.setOffline(false);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export standalone HTML" }).click();
  expect(await readFile((await (await event).path())!, "utf8")).toContain(
    "Written offline",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("solo race runs offline, counts down, highlights mistakes and saves rankings", async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto("/wpm");
  await page.getByRole("button", { name: "Typing race", exact: true }).click();
  await page.getByLabel(/Custom passage/).fill("hello race");
  await page.getByLabel(/Computer pace/).fill("180");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Start race", exact: true }).click();
  await expect(page.getByText(/Starting in/)).toBeVisible();
  const input = page.getByRole("textbox", { name: "Race typing input" });
  await expect(input).toBeEnabled({ timeout: 6000 });
  await input.fill("hxllo");
  await expect(page.locator(".race-passage .incorrect")).toHaveCount(1);
  await input.fill("hello race");
  await expect(page.getByText("Race results", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(
    page.getByRole("columnheader", { name: "Rank", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rematch", exact: true }),
  ).toBeEnabled();
  await context.setOffline(false);
});
test("two browsers race over the self-hosted WebSocket server without sharing private account access", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/wpm");
  await page.getByRole("button", { name: "Typing race", exact: true }).click();
  await page
    .getByRole("button", { name: "Race with friends", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Host");
  await page.getByLabel(/Custom passage/).fill("hello race");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  const code = page.getByRole("textbox", { name: "Room code", exact: true });
  await expect(code).toHaveValue(/^[A-F0-9]{12}$/);
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  try {
    await guest.goto("/race?room=" + (await code.inputValue()));
    await guest.getByLabel("Your name", { exact: true }).fill("Friend");
    await guest.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(guest.getByText(/2\/8 players/)).toBeVisible();
    expect((await guestContext.request.get("/api/records")).status()).toBe(401);
    await page.getByRole("button", { name: "Start race", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Race typing input" }),
    ).toBeEnabled({ timeout: 6000 });
    await expect(
      guest.getByRole("textbox", { name: "Race typing input" }),
    ).toBeEnabled({ timeout: 6000 });
    await page
      .getByRole("textbox", { name: "Race typing input" })
      .fill("hello race");
    await guest
      .getByRole("textbox", { name: "Race typing input" })
      .fill("hello race");
    await expect(page.getByText("Race results", { exact: true })).toBeVisible();
    await expect(
      guest.getByText("Race results", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Rematch", exact: true }).click();
    await expect(
      guest.getByText("Waiting for host", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start race", exact: true }).click();
    await expect(guest.getByText(/Starting in/)).toBeVisible();
  } finally {
    await guestContext.close();
  }
});

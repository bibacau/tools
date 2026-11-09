import { test, expect } from "@playwright/test";
test("account, tools, notes, offline reload, reconnect and revision conflicts", async ({
  page,
  context,
}) => {
  for (const password of ["1234567", "1234567!"])
    expect(
      (
        await context.request.post("/api/auth", { data: { password } })
      ).status(),
    ).toBe(400);
  await page.goto("/");
  await page.getByLabel("Password", { exact: true }).fill("Forest88");
  await page
    .getByRole("button", { name: /Create my workspace|Unlock workspace/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your everyday, simplified." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Notes A little space/ })
    .first()
    .click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Note title", exact: true })
    .fill("Offline test note");
  await page
    .getByRole("textbox", { name: "Note body" })
    .fill("Persistent local thought");
  await expect(page.getByRole("textbox", { name: "Note body" })).toHaveText(
    "Persistent local thought",
  );
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Note title", exact: true }),
  ).toHaveValue("Offline test note");
  await page
    .getByRole("textbox", { name: "Note body" })
    .fill("Edited without server");
  await context.setOffline(false);
  await page
    .getByRole("button", {
      name: /Server unavailable|All changes synced|local changes saved|Saved on this device/,
    })
    .last()
    .click();
  await expect
    .poll(async () => {
      const r = await context.request.get("/api/records");
      return (await r.json()).some(
        (x: any) => x.data.body === "Edited without server",
      );
    })
    .toBeTruthy();
  const rows = await (await context.request.get("/api/records")).json(),
    note = rows.find((x: any) => x.data.title === "Offline test note");
  const conflict = await context.request.put("/api/records/" + note.id, {
    data: { baseRev: 0, data: { type: "note", title: "stale" } },
  });
  expect(conflict.status()).toBe(409);
  const newer = await context.request.put("/api/records/" + note.id, {
    data: {
      baseRev: note.rev,
      data: { ...note.data, body: "Server-side newer edit" },
    },
  });
  expect(newer.ok()).toBeTruthy();
  await context.setOffline(true);
  await page
    .getByRole("textbox", { name: "Note body" })
    .fill("Independent offline conflict");
  await context.setOffline(false);
  await expect
    .poll(async () => {
      await page.locator("footer button").click();
      const rows = await (await context.request.get("/api/records")).json();
      return rows.some(
        (r: any) =>
          r.data.conflictOf === note.id &&
          r.data.body === "Independent offline conflict",
      );
    })
    .toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "All Tools", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "A tool for every little thing." }),
  ).toBeVisible();
});
test("unauthenticated API is private", async ({ request }) => {
  expect((await request.get("/api/records")).status()).toBe(401);
});
test("existing tools, wheel persistence and offline graph", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Password", { exact: true }).fill("Forest88");
  await page
    .getByRole("button", { name: /Create my workspace|Unlock workspace/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your everyday, simplified." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  await page.goto("/units");
  await expect(page.locator("output")).toHaveText("3.28084");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("Volume → mass");
  await page
    .getByLabel("Material", { exact: true })
    .selectOption("Cooking oil");
  await expect(page.locator("output")).toHaveText("0.92");
  await page.goto("/qr");
  await expect(
    page.getByRole("img", { name: "Generated QR code" }),
  ).toHaveAttribute("src", /^data:image\/png/);
  await page.goto("/wheel");
  await page.getByRole("button", { name: "New wheel", exact: true }).click();
  await page.getByRole("button", { name: "New wheel", exact: true }).click();
  await expect(page.getByLabel("Wheel name")).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel("Wheel name")).toHaveCount(2);
  await context.setOffline(true);
  await page.goto("/graph");
  await expect(page.getByLabel("Equation 1")).toHaveValue("sin(x)");
  await page.getByLabel("Equation 1").fill('import("bad")');
  await expect(page.getByText("Unsupported function")).toBeVisible();
  await page.goto("/reaction");
  await expect(
    page.getByRole("heading", { name: "Ready when you are." }),
  ).toBeVisible();
  await page.goto("/cps");
  await expect(
    page.getByRole("heading", { name: "Every click counts." }),
  ).toBeVisible();
  await page.goto("/wpm");
  await expect(
    page.getByRole("textbox", { name: "Typing test input" }),
  ).toBeVisible();
  await page.goto("/speech");
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeDisabled();
  await context.setOffline(false);
});

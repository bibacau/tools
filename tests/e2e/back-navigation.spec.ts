import { test, expect } from "@playwright/test";
test("Back returns through tool pages and a directly opened tool has a home fallback", async ({
  page,
}) => {
  await page.goto("/units");
  await page.getByLabel("Password", { exact: true }).fill("Forest88");
  await page
    .getByRole("button", { name: /Create my workspace|Unlock workspace/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Unit Converter", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your everyday, simplified." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go back", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: /Notes A little space/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Notes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Unit Converter", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Unit Converter", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Notes", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Unit Converter", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Notes", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Notes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your everyday, simplified." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: /QR Generator Turn anything/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Go back", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your everyday, simplified." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

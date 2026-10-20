import { expect, test } from "@playwright/test";

test("browse, replay and fork a trace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Traces" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(25);

  await page.getByRole("row", { name: /marathons laid end to end would reach the Moon\?/ }).click();
  await expect(page.getByRole("heading", { name: "research-assistant" })).toBeVisible();

  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(page.getByText("6/7")).toBeVisible();

  await page.getByRole("button", { name: /^Step #00/ }).click();
  await page.getByRole("button", { name: /Fork from here/ }).click();
  await page.getByRole("textbox", { name: "Edited input" }).fill("How tall is Mount Everest?");
  await page.getByRole("button", { name: "Run fork" }).click();

  await expect(page.getByText(/forked from/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/8,849 m/)).toBeVisible();
});

test("unknown traces 404", async ({ page }) => {
  const res = await page.goto("/traces/nope");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Nothing here.")).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("loads the login page", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

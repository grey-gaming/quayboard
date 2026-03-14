import { expect, test } from "@playwright/test";

test("loads the foundation page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Repository and Toolchain Foundations" }),
  ).toBeVisible();
});

import { test, expect } from "@playwright/test";
import { createAccountAndSignIn } from "./utils";

test.describe("Security", () => {
  test("should block sign in after repeated failed attempts (rate limit)", async ({ page }) => {
    const { email, password } = await createAccountAndSignIn(page);

    await page.goto("/logout");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

    for (let attempt = 0; attempt < 5; attempt++) {
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(`${password}-invalid`);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText("Invalid email or password")).toBeVisible();
    }

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Too many attempts. Try again in a few minutes.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

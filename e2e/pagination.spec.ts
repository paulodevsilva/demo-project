import { test, expect, type Page } from "@playwright/test";
import { createAccountAndSignIn } from "./utils";

async function saveBodyWeightWithRetry(page: Page, value: string) {
  const input = page.getByTestId("bodyweight-input");
  const submitButton = page.getByTestId("bodyweight-submit");
  await expect(submitButton).toHaveText("Save weight", { timeout: 20000 });

  let ready = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    await input.fill(value);
    if (await submitButton.isEnabled()) {
      ready = true;
      break;
    }
    await page.waitForTimeout(250);
  }
  expect(ready).toBeTruthy();

  await submitButton.click();
  await expect(submitButton).toHaveText("Save weight", { timeout: 20000 });
  await expect(input).toHaveValue("");
  await expect(page.getByText("Latest entry:")).toBeVisible({ timeout: 15000 });
}

test.describe("Pagination", () => {
  test("should paginate body weight history after more than 10 entries", async ({ page }) => {
    test.setTimeout(120000);
    await createAccountAndSignIn(page);
    await page.goto("/body-weight", { waitUntil: "networkidle" });

    for (let index = 0; index < 11; index++) {
      await saveBodyWeightWithRetry(page, `${170 + index}`);
    }

    const pageLabel = page.getByTestId("body-weight-page-label");
    await expect(pageLabel).toContainText("Page 1 of");

    await page.getByTestId("body-weight-next-page").click();
    await expect(pageLabel).toContainText("Page 2 of");
    await expect(page.getByTestId("body-weight-prev-page")).toBeEnabled();
  });

  test("should paginate nutrition history after more than 10 entries", async ({ page }) => {
    test.setTimeout(120000);
    await createAccountAndSignIn(page);
    await page.goto("/nutrition", { waitUntil: "networkidle" });

    for (let index = 0; index < 11; index++) {
      await page.getByTestId("nutrition-calories-input").fill(`${1800 + index}`);
      await page.getByTestId("nutrition-protein-input").fill("150");
      await page.getByTestId("nutrition-carbs-input").fill("200");
      await page.getByTestId("nutrition-fat-input").fill("60");
      await expect(page.getByTestId("nutrition-submit")).toBeEnabled({ timeout: 5000 });
      await page.getByTestId("nutrition-submit").click();
      await expect(page.getByTestId("nutrition-calories-input")).toHaveValue("", { timeout: 15000 });
    }

    const pageLabel = page.getByTestId("nutrition-page-label");
    await expect(pageLabel).toHaveText("Page 1 of 2 · 11 entries");
    await page.getByTestId("nutrition-next-page").click();
    await expect(pageLabel).toHaveText("Page 2 of 2 · 11 entries");
    await expect(page.getByTestId("nutrition-prev-page")).toBeEnabled();
  });
});

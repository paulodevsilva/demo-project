import { test, expect, type Page } from "@playwright/test";
import { createAccountAndSignIn } from "./utils";

async function goToNutrition(page: Page) {
  await page.goto("/nutrition", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Nutrition" })).toBeVisible();
}

async function addNutritionEntry(
  page: Page,
  values: { calories: number; protein: number; carbs: number; fat: number },
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByTestId("nutrition-calories-input").fill(String(values.calories));
    await page.getByTestId("nutrition-protein-input").fill(String(values.protein));
    await page.getByTestId("nutrition-carbs-input").fill(String(values.carbs));
    await page.getByTestId("nutrition-fat-input").fill(String(values.fat));

    const submitButton = page.getByTestId("nutrition-submit");
    try {
      await expect(submitButton).toBeEnabled({ timeout: 5000 });
      await submitButton.click({ force: true });
      await expect(
        page.getByText(`${values.calories} kcal · P ${values.protein} g · C ${values.carbs} g · F ${values.fat} g`),
      ).toBeVisible({ timeout: 15000 });
      return;
    } catch {
      if (attempt === 2) {
        throw new Error("Could not submit nutrition entry.");
      }
      await goToNutrition(page);
    }
  }
}

test.describe("Nutrition", () => {
  test.beforeEach(async ({ page }) => {
    await createAccountAndSignIn(page);
    await goToNutrition(page);
  });

  test("should require all fields before enabling save", async ({ page }) => {
    const submitButton = page.getByTestId("nutrition-submit");
    await expect(submitButton).toBeDisabled();

    await page.getByTestId("nutrition-calories-input").fill("2200");
    await expect(submitButton).toBeDisabled();

    await page.getByTestId("nutrition-protein-input").fill("180");
    await expect(submitButton).toBeDisabled();

    await page.getByTestId("nutrition-carbs-input").fill("250");
    await expect(submitButton).toBeDisabled();

    await page.getByTestId("nutrition-fat-input").fill("70");
    await expect(submitButton).toBeEnabled();
  });

  test("should create a nutrition entry and show it in history", async ({ page }) => {
    await addNutritionEntry(page, { calories: 2100, protein: 160, carbs: 220, fat: 70 });

    await expect(page.getByText("Page 1 of 1 · 1 entries")).toBeVisible();
    await expect(page.getByText("2100 kcal · P 160 g · C 220 g · F 70 g")).toBeVisible();
  });

  test("should accumulate today's summary across multiple entries", async ({ page }) => {
    await addNutritionEntry(page, { calories: 1000, protein: 80, carbs: 90, fat: 30 });
    await addNutritionEntry(page, { calories: 900, protein: 70, carbs: 110, fat: 25 });

    await expect(page.getByText("Page 1 of 1 · 2 entries")).toBeVisible();
    await expect(page.getByText("1900 kcal")).toBeVisible();
    await expect(page.getByText("150 g")).toBeVisible();
    await expect(page.getByText("200 g")).toBeVisible();
    await expect(page.getByText("55 g")).toBeVisible();
  });
});

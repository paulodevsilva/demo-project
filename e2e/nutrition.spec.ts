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
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await createAccountAndSignIn(page);
    await goToNutrition(page);
  });

  test("should show empty nutrition states for a new account", async ({ page }) => {
    const progressCard = page.getByTestId("nutrition-progress-card");
    await expect(page.getByText("No nutrition entries yet.")).toBeVisible();
    await expect(page.getByText("Not enough data to render chart.")).toBeVisible();
    await expect(progressCard).toContainText("Entries");
    await expect(progressCard).toContainText("0 kcal");
    await expect(progressCard).toContainText("0 g");
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

    await expect(page.getByTestId("nutrition-page-label")).toHaveText("Page 1 of 1 · 1 entries");
    await expect(page.getByTestId("nutrition-history-list").getByText("2100 kcal · P 160 g · C 220 g · F 70 g")).toBeVisible();
  });

  test("should accumulate today's summary across multiple entries", async ({ page }) => {
    await addNutritionEntry(page, { calories: 1000, protein: 80, carbs: 90, fat: 30 });
    await addNutritionEntry(page, { calories: 900, protein: 70, carbs: 110, fat: 25 });
    const progressCard = page.getByTestId("nutrition-progress-card");

    await expect(page.getByTestId("nutrition-page-label")).toHaveText("Page 1 of 1 · 2 entries");
    await expect(progressCard).toContainText("1900 kcal");
    await expect(progressCard).toContainText("150 g");
    await expect(progressCard).toContainText("200 g");
    await expect(progressCard).toContainText("55 g");
  });

  test("should update calories progress range when selecting period", async ({ page }) => {
    await addNutritionEntry(page, { calories: 2200, protein: 180, carbs: 250, fat: 70 });
    const rangeSelect = page.getByTestId("nutrition-progress-range-select");

    await expect(page.getByRole("img", { name: "Daily calories (1 week)" })).toBeVisible();
    await rangeSelect.selectOption("14d");
    await expect(page.getByRole("img", { name: "Daily calories (2 weeks)" })).toBeVisible();
    await rangeSelect.selectOption("30d");
    await expect(page.getByRole("img", { name: "Daily calories (1 month)" })).toBeVisible();
  });

  test("should show warning toast for invalid calories input", async ({ page }) => {
    await page.getByTestId("nutrition-calories-input").fill("-1");
    await page.getByTestId("nutrition-protein-input").fill("100");
    await page.getByTestId("nutrition-carbs-input").fill("120");
    await page.getByTestId("nutrition-fat-input").fill("40");

    await page.getByTestId("nutrition-submit").click();
    await expect(page.getByText("Invalid calories")).toBeVisible();
    await expect(page.getByText("Calories must be zero or greater.")).toBeVisible();
  });

  test("should keep history ordered by latest entry first", async ({ page }) => {
    await addNutritionEntry(page, { calories: 1000, protein: 80, carbs: 90, fat: 30 });
    await addNutritionEntry(page, { calories: 1500, protein: 100, carbs: 150, fat: 50 });

    const rows = page.getByTestId("nutrition-history-list").locator("li");
    await expect(rows.first()).toContainText("1500 kcal · P 100 g · C 150 g · F 50 g");
    await expect(rows.nth(1)).toContainText("1000 kcal · P 80 g · C 90 g · F 30 g");
  });

  test("should update tracked days denominator when changing range", async ({ page }) => {
    await addNutritionEntry(page, { calories: 1800, protein: 140, carbs: 200, fat: 60 });
    const rangeSelect = page.getByTestId("nutrition-progress-range-select");

    await expect(page.getByText("1/7")).toBeVisible();
    await rangeSelect.selectOption("14d");
    await expect(page.getByText("1/14")).toBeVisible();
    await rangeSelect.selectOption("30d");
    await expect(page.getByText("1/30")).toBeVisible();
  });
});

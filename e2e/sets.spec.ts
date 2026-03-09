import { test, expect } from "@playwright/test";
import { createAccountAndSignIn, createMovement, startWorkout } from "./utils";

async function saveBodyWeight(page: import("@playwright/test").Page, value: string) {
  await page.goto("/body-weight", { waitUntil: "networkidle" });
  await page.getByTestId("bodyweight-input").fill(value);
  await page.getByTestId("bodyweight-submit").click();
  await expect(page.getByText("Latest entry:")).toBeVisible();
}

test.describe("Sets", () => {
  test.beforeEach(async ({ page }) => {
    await createAccountAndSignIn(page);
    await createMovement(page, "Bench Press");
    await startWorkout(page);
  });

  test.describe("create", () => {
    test("should add a set to the current workout", async ({ page }) => {
      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await page.getByTestId("set-weight-input").fill("225");
      await page.getByTestId("set-reps-input").fill("5");
      await page.getByTestId("add-set-button").click();

      await expect(page.getByTestId("sets-list").getByText("5 reps × 225 lbs")).toBeVisible();
    });

    test("should require movement, weight, and reps to add a set", async ({ page }) => {
      await expect(page.getByTestId("add-set-button")).toBeDisabled();

      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await expect(page.getByTestId("add-set-button")).toBeDisabled();

      await page.getByTestId("set-weight-input").fill("135");
      await expect(page.getByTestId("add-set-button")).toBeDisabled();

      await page.getByTestId("set-reps-input").fill("10");
      await expect(page.getByTestId("add-set-button")).toBeEnabled();
    });

    test("should display the new set in the workout", async ({ page }) => {
      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await page.getByTestId("set-weight-input").fill("185");
      await page.getByTestId("set-reps-input").fill("8");
      await page.getByTestId("add-set-button").click();

      await expect(page.getByTestId("sets-list").getByText("Bench Press")).toBeVisible();
      await expect(page.getByTestId("sets-list").getByText("8 reps × 185 lbs")).toBeVisible();
    });

    test("should keep add button disabled for bodyweight movement without bodyweight entry", async ({ page }) => {
      await createMovement(page, "Pull Up", true);
      await page.goto("/current-workout", { waitUntil: "networkidle" });
      await page.getByTestId("set-movement-select").selectOption({ label: "Pull Up" });
      await page.getByTestId("set-reps-input").fill("8");

      await expect(page.getByTestId("set-weight-input")).toBeDisabled();
      await expect(page.getByTestId("add-set-button")).toBeDisabled();
    });

    test("should auto-fill bodyweight set weight from latest bodyweight entry", async ({ page }) => {
      await createMovement(page, "Dips", true);
      await saveBodyWeight(page, "182");
      await page.goto("/current-workout", { waitUntil: "networkidle" });
      await page.getByTestId("set-movement-select").selectOption({ label: "Dips" });

      await expect(page.getByTestId("set-weight-input")).toBeDisabled();
      await expect(page.getByTestId("set-weight-input")).toHaveValue("182");
    });
  });

  test.describe("read", () => {
    test("should display sets with movement name, weight, and reps", async ({ page }) => {
      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await page.getByTestId("set-weight-input").fill("205");
      await page.getByTestId("set-reps-input").fill("6");
      await page.getByTestId("add-set-button").click();

      await expect(page.getByTestId("sets-list").getByText("Bench Press")).toBeVisible();
      await expect(page.getByTestId("sets-list").getByText("6 reps × 205 lbs")).toBeVisible();
    });

    test("should show sets in the order they were added", async ({ page }) => {
      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await page.getByTestId("set-weight-input").fill("135");
      await page.getByTestId("set-reps-input").fill("12");
      await page.getByTestId("add-set-button").click({ force: true });
      await expect(page.getByTestId("sets-list").getByText("12 reps × 135 lbs")).toBeVisible();

      await page.getByTestId("set-weight-input").fill("155");
      await page.getByTestId("set-reps-input").fill("10");
      await page.getByTestId("add-set-button").click({ force: true });
      await expect(page.getByTestId("sets-list").getByText("10 reps × 155 lbs")).toBeVisible();

      const rows = await page.locator('[data-testid="sets-list"] li').allTextContents();
      expect(rows[0]).toContain("12 reps × 135 lbs");
      expect(rows[1]).toContain("10 reps × 155 lbs");
    });
  });

  test.describe("delete", () => {
    test("should remove a set from the current workout", async ({ page }) => {
      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await page.getByTestId("set-weight-input").fill("175");
      await page.getByTestId("set-reps-input").fill("8");
      await page.getByTestId("add-set-button").click();

      await page.locator('[data-testid^="delete-set-"]').first().click();
      await expect(page.getByTestId("sets-list").getByText("8 reps × 175 lbs")).not.toBeVisible();
    });

    test("should update the sets list after deletion", async ({ page }) => {
      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await page.getByTestId("set-weight-input").fill("95");
      await page.getByTestId("set-reps-input").fill("15");
      await page.getByTestId("add-set-button").click();
      await expect(page.locator('[data-testid="sets-list"] li')).toHaveCount(1);

      await page.getByTestId("set-weight-input").fill("115");
      await page.getByTestId("set-reps-input").fill("12");
      await page.getByTestId("add-set-button").click();

      await expect(page.locator('[data-testid="sets-list"] li')).toHaveCount(2);
      await page.locator('[data-testid^="delete-set-"]').first().click();
      await expect(page.locator('[data-testid="sets-list"] li')).toHaveCount(1);
    });
  });
});

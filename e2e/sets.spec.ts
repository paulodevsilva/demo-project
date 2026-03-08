import { test, expect } from "@playwright/test";
import { createAccountAndSignIn, createMovement, startWorkout } from "./utils";

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

      await expect(page.getByText("5 reps × 225 lbs")).toBeVisible();
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
      await expect(page.getByText("8 reps × 185 lbs")).toBeVisible();
    });
  });

  test.describe("read", () => {
    test("should display sets with movement name, weight, and reps", async ({ page }) => {
      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await page.getByTestId("set-weight-input").fill("205");
      await page.getByTestId("set-reps-input").fill("6");
      await page.getByTestId("add-set-button").click();

      await expect(page.getByTestId("sets-list").getByText("Bench Press")).toBeVisible();
      await expect(page.getByText("6 reps × 205 lbs")).toBeVisible();
    });

    test("should show sets in the order they were added", async ({ page }) => {
      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await page.getByTestId("set-weight-input").fill("135");
      await page.getByTestId("set-reps-input").fill("12");
      await page.getByTestId("add-set-button").click({ force: true });
      await expect(page.getByText("12 reps × 135 lbs")).toBeVisible();

      await page.getByTestId("set-weight-input").fill("155");
      await page.getByTestId("set-reps-input").fill("10");
      await page.getByTestId("add-set-button").click({ force: true });
      await expect(page.getByText("10 reps × 155 lbs")).toBeVisible();

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
      await expect(page.getByText("8 reps × 175 lbs")).not.toBeVisible();
    });

    test("should update the sets list after deletion", async ({ page }) => {
      await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
      await page.getByTestId("set-weight-input").fill("95");
      await page.getByTestId("set-reps-input").fill("15");
      await page.getByTestId("add-set-button").click();

      await page.getByTestId("set-weight-input").fill("115");
      await page.getByTestId("set-reps-input").fill("12");
      await page.getByTestId("set-reps-input").press("Enter");

      await expect(page.locator('[data-testid="sets-list"] li')).toHaveCount(2);
      await page.locator('[data-testid^="delete-set-"]').first().click();
      await expect(page.locator('[data-testid="sets-list"] li')).toHaveCount(1);
    });
  });
});

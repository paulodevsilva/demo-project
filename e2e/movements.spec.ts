import { test, expect } from "@playwright/test";
import { createAccountAndSignIn, createMovement, startWorkout } from "./utils";

test.describe("Movements", () => {
  test.beforeEach(async ({ page }) => {
    await createAccountAndSignIn(page);
  });

  test.describe("create", () => {
    test("should create a new movement with a valid name", async ({ page }) => {
      await createMovement(page, "Bench Press");
      await expect(page.getByTestId("movements-list").getByText("Bench Press")).toBeVisible();
    });

    test("should show the new movement in the movements list", async ({ page }) => {
      await createMovement(page, "Barbell Row");
      await expect(page.getByTestId("movements-list").getByText("Barbell Row")).toBeVisible();
    });

    test("should clear the input after creating a movement", async ({ page }) => {
      await page.goto("/movements", { waitUntil: "networkidle" });
      await page.getByTestId("movement-name-input").fill("Deadlift");
      await page.getByTestId("movement-create-submit").click();
      await expect(page.getByTestId("movements-list").getByText("Deadlift")).toBeVisible();
      await expect(page.getByTestId("movement-name-input")).toHaveValue("");
    });

    test("should disable and clear default weight for bodyweight movement", async ({ page }) => {
      await page.goto("/movements", { waitUntil: "networkidle" });
      const defaultWeightInput = page.getByTestId("movement-default-weight-input");
      await defaultWeightInput.fill("100");
      await expect(defaultWeightInput).toHaveValue("100");

      await page.getByTestId("movement-bodyweight-toggle").check();
      await expect(defaultWeightInput).toBeDisabled();
      await expect(defaultWeightInput).toHaveValue("");
    });

    test("should show warning when default reps is invalid", async ({ page }) => {
      await page.goto("/movements", { waitUntil: "networkidle" });
      await page.getByTestId("movement-name-input").fill("Invalid Reps Test");
      await page.getByTestId("movement-default-reps-input").fill("0");
      await page.getByTestId("movement-create-submit").click();

      await expect(page.getByText("Invalid default reps")).toBeVisible();
      await expect(page.getByText("Default reps must be at least 1.")).toBeVisible();
    });
  });

  test.describe("read", () => {
    test("should display all movements on the movements page", async ({ page }) => {
      await createMovement(page, "Squat");
      await createMovement(page, "Incline Bench");
      await expect(page.getByTestId("movements-list").getByText("Squat")).toBeVisible();
      await expect(page.getByTestId("movements-list").getByText("Incline Bench")).toBeVisible();
    });

    test("should show movements sorted alphabetically", async ({ page }) => {
      await createMovement(page, "Z Press");
      await createMovement(page, "Arnold Press");

      const names = await page
        .locator('[data-testid^="movement-item-"] span:first-child')
        .allTextContents();
      const normalized = names.map((name) => name.trim());
      const sorted = [...normalized].sort((a, b) => a.localeCompare(b));
      expect(normalized).toEqual(sorted);
    });
  });

  test.describe("delete", () => {
    test("should delete an existing movement", async ({ page }) => {
      await createMovement(page, "Cable Fly");

      const item = page
        .locator('[data-testid^="movement-item-"]')
        .filter({ has: page.getByText("Cable Fly") })
        .first();
      await item.getByRole("button", { name: "Delete" }).click();

      await expect(page.getByTestId("movements-list").getByText("Cable Fly")).not.toBeVisible();
    });

    test("should remove the movement from the list after deletion", async ({ page }) => {
      await createMovement(page, "Face Pull");

      const before = await page.locator('[data-testid^="movement-item-"]').count();
      const item = page
        .locator('[data-testid^="movement-item-"]')
        .filter({ has: page.getByText("Face Pull") })
        .first();
      await item.getByRole("button", { name: "Delete" }).click();

      await expect(page.getByTestId("movements-list").getByText("Face Pull")).not.toBeVisible();
      const after = await page.locator('[data-testid^="movement-item-"]').count();
      expect(after).toBe(before - 1);
    });

    test("should prevent deleting movement that already has sets", async ({ page }) => {
      await createMovement(page, "Protected Movement");
      await startWorkout(page);
      await page.getByTestId("set-movement-select").selectOption({ label: "Protected Movement" });
      await page.getByTestId("set-weight-input").fill("95");
      await page.getByTestId("set-reps-input").fill("10");
      await page.getByTestId("add-set-button").click();

      await page.goto("/movements", { waitUntil: "networkidle" });
      const item = page
        .locator('[data-testid^="movement-item-"]')
        .filter({ has: page.getByText("Protected Movement") })
        .first();
      await item.getByRole("button", { name: "Delete" }).click();

      await expect(page.getByText("Could not delete movement")).toBeVisible();
      await expect(page.getByText("Cannot delete movement that already has sets.")).toBeVisible();
      await expect(page.getByTestId("movements-list").getByText("Protected Movement")).toBeVisible();
    });
  });
});

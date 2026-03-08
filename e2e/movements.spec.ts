import { test, expect } from "@playwright/test";
import { createAccountAndSignIn, createMovement } from "./utils";

test.describe("Movements", () => {
  test.beforeEach(async ({ page }) => {
    await createAccountAndSignIn(page);
  });

  test.describe("create", () => {
    test("should create a new movement with a valid name", async ({ page }) => {
      await createMovement(page, "Bench Press");
      await expect(page.getByText("Bench Press")).toBeVisible();
    });

    test("should show the new movement in the movements list", async ({ page }) => {
      await createMovement(page, "Barbell Row");
      await expect(page.getByTestId("movements-list").getByText("Barbell Row")).toBeVisible();
    });

    test("should clear the input after creating a movement", async ({ page }) => {
      await createMovement(page, "Deadlift");
      await expect(page.getByTestId("movement-name-input")).toHaveValue("");
    });
  });

  test.describe("read", () => {
    test("should display all movements on the movements page", async ({ page }) => {
      await createMovement(page, "Squat");
      await createMovement(page, "Incline Bench");
      await expect(page.getByText("Squat")).toBeVisible();
      await expect(page.getByText("Incline Bench")).toBeVisible();
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

      await expect(page.getByText("Cable Fly")).not.toBeVisible();
    });

    test("should remove the movement from the list after deletion", async ({ page }) => {
      await createMovement(page, "Face Pull");

      const before = await page.locator('[data-testid^="movement-item-"]').count();
      const item = page
        .locator('[data-testid^="movement-item-"]')
        .filter({ has: page.getByText("Face Pull") })
        .first();
      await item.getByRole("button", { name: "Delete" }).click();

      await expect(page.getByText("Face Pull")).not.toBeVisible();
      const after = await page.locator('[data-testid^="movement-item-"]').count();
      expect(after).toBe(before - 1);
    });
  });
});

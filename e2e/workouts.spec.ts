import { test, expect, type Page } from "@playwright/test";
import { createAccountAndSignIn, createMovement, startWorkout } from "./utils";

async function saveBodyWeight(page: Page, value: string) {
  await page.goto("/body-weight", { waitUntil: "networkidle" });

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByTestId("bodyweight-input").fill(value);
    const submitButton = page.getByTestId("bodyweight-submit");
    try {
      await expect(submitButton).toBeEnabled({ timeout: 7000 });
      await submitButton.click();
      await expect(page.getByText("Latest entry:")).toBeVisible({ timeout: 10000 });
      return;
    } catch {
      if (attempt === 2) throw new Error("Could not save body weight entry.");
      await page.goto("/body-weight", { waitUntil: "networkidle" });
    }
  }
}

test.describe("Workouts", () => {
  test.beforeEach(async ({ page }) => {
    await createAccountAndSignIn(page);
  });

  test.describe("create", () => {
    test("should start a new workout from the current workout page", async ({ page }) => {
      await page.goto("/current-workout");
      await page.getByTestId("start-workout-button").click();
      await expect(page.getByTestId("add-set-button")).toBeVisible();
    });

    test("should show the workout date after starting", async ({ page }) => {
      await page.goto("/current-workout");
      await page.getByTestId("start-workout-button").click();
      const currentYear = new Date().getFullYear().toString();
      await expect(page.getByText(currentYear)).toBeVisible();
    });
  });

  test.describe("read", () => {
    test("should display the current active workout", async ({ page }) => {
      await startWorkout(page);
      await expect(page.getByRole("heading", { name: "Current Workout" })).toBeVisible();
      await expect(page.getByTestId("add-set-button")).toBeVisible();
    });

    test("should show 'No active workout' when none exists", async ({ page }) => {
      await page.goto("/current-workout");
      await expect(page.getByText("No active workout. Ready to start?")).toBeVisible();
    });

    test("should display completed workouts in workout history", async ({ page }) => {
      await createMovement(page, "Pull Up", true);
      await saveBodyWeight(page, "180");

      await startWorkout(page);
      await page.getByTestId("set-movement-select").selectOption({ label: "Pull Up" });
      await page.getByTestId("set-reps-input").fill("8");
      await page.getByTestId("add-set-button").click();
      await page.getByTestId("complete-workout-button").click();

      await page.goto("/workout-history");
      await expect(page.getByTestId("workout-history-table")).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Pull Up" })).toBeVisible();
    });

    test("should paginate workout history after more than 10 completed workouts", async ({ page }) => {
      await createMovement(page, "Bench Press");

      for (let index = 0; index < 11; index++) {
        await startWorkout(page);
        await page.getByTestId("set-movement-select").selectOption({ label: "Bench Press" });
        await page.getByTestId("set-weight-input").fill(`${100 + index}`);
        await page.getByTestId("set-reps-input").fill("5");
        await page.getByTestId("add-set-button").click();
        await page.getByTestId("complete-workout-button").click();
      }

      await page.goto("/workout-history");
      const pageLabel = page.getByTestId("workout-history-page-label");
      await expect(pageLabel).toContainText("Page 1 of");
      const nextButton = page.getByTestId("workout-history-next-page");
      await expect(nextButton).toBeEnabled();
      await nextButton.click();
      await expect(pageLabel).toContainText("Page 2 of");
      await expect(page.getByTestId("workout-history-prev-page")).toBeEnabled();
    });
  });

  test.describe("complete", () => {
    test("should mark the current workout as completed", async ({ page }) => {
      await createMovement(page, "Squat");
      await startWorkout(page);
      await page.getByTestId("set-movement-select").selectOption({ label: "Squat" });
      await page.getByTestId("set-weight-input").fill("225");
      await page.getByTestId("set-reps-input").fill("5");
      await page.getByTestId("add-set-button").click();
      await page.getByTestId("complete-workout-button").click();

      await expect(page.getByTestId("start-workout-button")).toBeVisible();
    });

    test("should move completed workout to history", async ({ page }) => {
      await createMovement(page, "Deadlift");
      await startWorkout(page);
      await page.getByTestId("set-movement-select").selectOption({ label: "Deadlift" });
      await page.getByTestId("set-weight-input").fill("315");
      await page.getByTestId("set-reps-input").fill("3");
      await page.getByTestId("add-set-button").click();
      await page.getByTestId("complete-workout-button").click();

      await page.goto("/workout-history");
      await expect(page.getByTestId("workout-history-table")).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Deadlift" })).toBeVisible();
    });
  });

  test.describe("delete", () => {
    test("should delete selected workouts from history", async ({ page }) => {
      await createMovement(page, "Overhead Press");
      await startWorkout(page);
      await page.getByTestId("set-movement-select").selectOption({ label: "Overhead Press" });
      await page.getByTestId("set-weight-input").fill("135");
      await page.getByTestId("set-reps-input").fill("5");
      await page.getByTestId("add-set-button").click();
      await page.getByTestId("complete-workout-button").click();

      await page.goto("/workout-history");
      await page.getByTestId("workout-history-table").locator('[data-testid^="select-workout-"]').first().check();
      await page.getByTestId("delete-selected-workouts").click();

      await expect(page.getByText("No completed workouts yet.")).toBeVisible();
    });

    test("should allow selecting multiple workouts for deletion", async ({ page }) => {
      await createMovement(page, "Dips", true);
      await saveBodyWeight(page, "170");

      for (let index = 0; index < 2; index++) {
        await startWorkout(page);
        await page.getByTestId("set-movement-select").selectOption({ label: "Dips" });
        await page.getByTestId("set-reps-input").fill(`${10 - index}`);
        await page.getByTestId("add-set-button").click();
        await page.getByTestId("complete-workout-button").click();
      }

      await page.goto("/workout-history");
      await page.getByTestId("select-all-workouts").check();
      await expect(page.getByTestId("delete-selected-workouts")).toContainText("(2)");
    });
  });
});

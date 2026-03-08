import { expect, type Page } from "@playwright/test";

export async function createAccountAndSignIn(page: Page) {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = `athlete-${unique}@example.com`;
  const password = `StrongPass!${unique}`;

  await page.goto("/create-account", { waitUntil: "networkidle" });

  let signedIn = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel("Name").fill("Assessment User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    try {
      await page.waitForURL("**/current-workout**", { timeout: 15000 });
      await expect(page.getByRole("heading", { name: "Current Workout" })).toBeVisible({ timeout: 15000 });
      signedIn = true;
      break;
    } catch {
      if (attempt === 2) {
        throw new Error("Could not sign in through create-account flow.");
      }
      await page.goto("/create-account", { waitUntil: "networkidle" });
    }
  }

  expect(signedIn).toBeTruthy();

  return { email, password };
}

export async function createMovement(page: Page, name: string, isBodyweight = false) {
  let created = false;

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/movements", { waitUntil: "networkidle" });
    await page.getByTestId("movement-name-input").fill(name);
    if (isBodyweight) {
      await page.getByTestId("movement-bodyweight-toggle").check();
    }

    const submitButton = page.getByTestId("movement-create-submit");
    try {
      await expect(submitButton).toBeEnabled({ timeout: 7000 });
      await submitButton.click();
      await expect(page.getByText(name)).toBeVisible({ timeout: 15000 });
      created = true;
      break;
    } catch {
      if (attempt === 2) {
        throw new Error(`Could not create movement "${name}".`);
      }
    }
  }

  expect(created).toBeTruthy();
}

export async function startWorkout(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/current-workout", { waitUntil: "networkidle" });
    const startButton = page.getByTestId("start-workout-button");
    const addSetButton = page.getByTestId("add-set-button");

    if (await addSetButton.isVisible()) {
      await expect(addSetButton).toBeVisible();
      return;
    }

    if (await startButton.isVisible()) {
      await startButton.click();
      try {
        await expect(addSetButton).toBeVisible({ timeout: 15000 });
        return;
      } catch {
        if (attempt === 2) {
          throw new Error("Could not start workout session.");
        }
      }
    }
  }

  throw new Error("Could not reach workout form.");
}

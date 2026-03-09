import { expect, type Page } from "@playwright/test";

async function signInWithCredentials(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible({ timeout: 10000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  const signOutButton = page.getByRole("button", { name: "Sign out" });
  const signInError = page.getByText("Invalid email or password");
  const authResult = await Promise.race([
    page.waitForURL("**/current-workout**", { timeout: 15000 }).then(() => "success"),
    expect(signOutButton).toBeVisible({ timeout: 15000 }).then(() => "success"),
    expect(signInError).toBeVisible({ timeout: 15000 }).then(() => "error"),
  ]).catch(() => "timeout");

  return authResult === "success";
}

export async function createAccountAndSignIn(page: Page) {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = `athlete-${unique}@example.com`;
  const password = `StrongPass!${unique}`;

  await page.goto("/create-account");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible({ timeout: 10000 });
  const signOutButton = page.getByRole("button", { name: "Sign out" });
  const createAccountError = page.locator("div.rounded-xl.border.border-red-200.bg-red-50").first();

  await page.getByLabel("Name").fill("Assessment User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  const createResult = await Promise.race([
    page.waitForURL("**/current-workout**", { timeout: 15000 }).then(() => "success"),
    expect(signOutButton).toBeVisible({ timeout: 15000 }).then(() => "success"),
    page.waitForURL("**/sign-in**", { timeout: 15000 }).then(() => "signin"),
    expect(createAccountError).toBeVisible({ timeout: 15000 }).then(() => "error"),
  ]).catch(() => "timeout");

  if (createResult === "success") {
    return { email, password };
  }

  if ((createResult === "signin" || createResult === "timeout") && (await signInWithCredentials(page, email, password))) {
    return { email, password };
  }

  const errorMessage = await createAccountError.textContent().catch(() => null);
  if (errorMessage?.trim()) {
    throw new Error(`Could not sign in through create-account/sign-in flow: ${errorMessage.trim()}`);
  }
  throw new Error("Could not sign in through create-account/sign-in flow.");
}

export async function createMovement(page: Page, name: string, isBodyweight = false) {
  await page.goto("/movements", { waitUntil: "networkidle" });

  const movementsList = page.getByTestId("movements-list");
  const existingMovement = movementsList.getByText(name);
  if (await existingMovement.isVisible().catch(() => false)) {
    return;
  }

  await page.getByTestId("movement-name-input").fill(name);
  if (isBodyweight) {
    await page.getByTestId("movement-bodyweight-toggle").check();
  }

  const submitButton = page.getByTestId("movement-create-submit");
  await expect(submitButton).toBeEnabled({ timeout: 7000 });
  await submitButton.click();

  const creationResult = await Promise.race([
    expect(movementsList.getByText(name)).toBeVisible({ timeout: 15000 }).then(() => "success"),
    expect(page.getByText("Could not create movement")).toBeVisible({ timeout: 15000 }).then(() => "error"),
  ]).catch(() => "timeout");

  if (creationResult === "success") {
    return;
  }
  if (creationResult === "error" && (await movementsList.getByText(name).isVisible().catch(() => false))) {
    return;
  }
  throw new Error(`Could not create movement "${name}".`);
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

import { chromium } from '@playwright/test';

const log = (msg) => console.log(`[manual-smoke] ${msg}`);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const page = await context.newPage();

  const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = `qa-${unique}@example.com`;
  const password = `StrongPass!${unique}`;

  try {
    log('Open create account page');
    await page.goto('/create-account', { waitUntil: 'networkidle' });

    await page.getByLabel('Name').fill('QA User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL('**/current-workout**', { timeout: 15000 });
    await page.getByRole('heading', { name: 'Current Workout' }).waitFor({ state: 'visible', timeout: 15000 });
    log('Account creation + redirect OK');

    await page.goto('/body-weight', { waitUntil: 'networkidle' });
    await page.getByTestId('bodyweight-input').fill('200');
    await page.getByTestId('bodyweight-submit').click();
    await page.getByText('Latest entry:').waitFor({ state: 'visible', timeout: 10000 });
    log('Body weight save OK');

    await page.goto('/movements', { waitUntil: 'networkidle' });
    await page.getByTestId('movement-name-input').fill('Pull Up');
    await page.getByTestId('movement-bodyweight-toggle').check();
    const disabledWeight = await page.getByTestId('movement-default-weight-input').isDisabled();
    if (!disabledWeight) throw new Error('Bodyweight movement should disable default weight input');
    await page.getByTestId('movement-default-reps-input').fill('10');
    await page.getByTestId('movement-create-submit').click();
    await page.getByText('Pull Up').waitFor({ state: 'visible', timeout: 10000 });
    log('Bodyweight movement create OK');

    await page.getByTestId('movement-name-input').fill('Bench Press');
    await page.getByTestId('movement-default-weight-input').fill('135');
    await page.getByTestId('movement-default-reps-input').fill('8');
    await page.getByTestId('movement-create-submit').click();
    await page.getByText('Bench Press').waitFor({ state: 'visible', timeout: 10000 });
    log('Weighted movement create OK');

    await page.goto('/current-workout', { waitUntil: 'networkidle' });
    const startBtn = page.getByTestId('start-workout-button');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    await page.getByTestId('set-movement-select').selectOption({ label: 'Pull Up' });
    const weightInput = page.getByTestId('set-weight-input');
    const weightValue = await weightInput.inputValue();
    const weightDisabled = await weightInput.isDisabled();
    if (!weightDisabled || weightValue !== '200') {
      throw new Error(`Bodyweight set input invalid. disabled=${weightDisabled}, value=${weightValue}`);
    }
    await page.getByTestId('set-reps-input').fill('12');
    await page.getByTestId('add-set-button').click();
    await page.getByText('12 reps × 200 lbs').waitFor({ state: 'visible', timeout: 10000 });
    log('Current workout bodyweight add-set OK');

    await page.getByTestId('set-movement-select').selectOption({ label: 'Bench Press' });
    await page.getByTestId('set-weight-input').fill('145');
    await page.getByTestId('set-reps-input').fill('8');
    await page.getByTestId('add-set-button').click();
    await page.getByText('8 reps × 145 lbs').waitFor({ state: 'visible', timeout: 10000 });
    log('Current workout weighted add-set OK');

    await page.getByTestId('complete-workout-button').click();
    await page.getByTestId('start-workout-button').waitFor({ state: 'visible', timeout: 10000 });
    log('Complete workout OK');

    await page.goto('/workout-history', { waitUntil: 'networkidle' });
    await page.getByText('Completed Workouts').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('workout-history-table').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('columnheader', { name: 'Pull Up' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('columnheader', { name: 'Bench Press' }).waitFor({ state: 'visible', timeout: 10000 });
    log('Workout history render OK');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    await page.getByRole('heading', { name: 'Sign in to your account' }).waitFor({ state: 'visible', timeout: 10000 });
    log('Sign out flow OK');

    console.log('[manual-smoke] RESULT: PASS');
  } catch (error) {
    console.error('[manual-smoke] RESULT: FAIL');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();

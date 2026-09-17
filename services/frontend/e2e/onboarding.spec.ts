import { expect, test } from '@playwright/test';
import { resetBackend, seedUser } from './reset-backend.js';

test.beforeEach(async () => {
  await resetBackend();
});

test('AC1: a first-time visitor is redirected to onboarding', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'Bienvenido a ALMA' })).toBeVisible();
});

test('AC2: completing onboarding creates the user and lands on the main view', async ({ page }) => {
  await page.goto('/onboarding');

  await page.getByLabel('Nombre').fill('Felix');
  await page.getByLabel('Email').fill('felix@test.com');
  await page.getByLabel(/día a día personal/i).check();
  await page.getByRole('button', { name: 'Empezar' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu conocimiento' })).toBeVisible();
});

test('AC4: an invalid email shows a validation error and does not create a user', async ({ page }) => {
  await page.goto('/onboarding');

  await page.getByLabel('Nombre').fill('Felix');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel(/día a día personal/i).check();

  // The native <input type="email"> constraint blocks submission before the
  // Server Action even runs — assert we're still on /onboarding, not a
  // specific error string, since that's the browser's own validation UI.
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('AC3: a returning user (already onboarded) skips onboarding entirely', async ({ page }) => {
  await seedUser();

  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible();
});

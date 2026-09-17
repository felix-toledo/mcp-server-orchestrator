import { expect, test } from '@playwright/test';
import { resetBackend, seedUser } from './reset-backend.js';

test.beforeEach(async () => {
  await resetBackend();
  await seedUser();
});

test('AC1/AC3: sending a message shows both my message and ALMA\'s reply', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('Escribile a ALMA…').fill('Hola ALMA');
  await page.getByRole('button', { name: 'Enviar' }).click();

  await expect(page.getByText('Hola ALMA')).toBeVisible();
  await expect(page.getByText('Hola, soy ALMA (mock)')).toBeVisible();
});

test('AC3: a message that should be remembered gets confirmed back in the chat', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('Escribile a ALMA…').fill('Acordate que me gusta la milanesa napolitana');
  await page.getByRole('button', { name: 'Enviar' }).click();

  await expect(page.getByText(/guardé la nota/i)).toBeVisible();
});

test('AC5: chat history does not survive a page reload', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('Escribile a ALMA…').fill('Hola ALMA');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Hola, soy ALMA (mock)')).toBeVisible();

  await page.reload();

  await expect(page.getByText('Hola ALMA')).not.toBeVisible();
});

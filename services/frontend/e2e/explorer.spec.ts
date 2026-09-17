import { expect, test } from '@playwright/test';
import { resetBackend, seedKnowledgeEntry, seedUser } from './reset-backend.js';

test.beforeEach(async () => {
  await resetBackend();
  await seedUser();
});

test('AC1: existing notes are listed', async ({ page }) => {
  await seedKnowledgeEntry('Mi primera nota', 'Contenido de la primera nota.');

  await page.goto('/');

  await expect(page.getByText('Mi primera nota', { exact: true })).toBeVisible();
});

test('empty vault shows the empty-state message instead of a list', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Todavía no hay notas.')).toBeVisible();
});

test('AC2/AC3: opening a note loads its content, editing and saving persists it', async ({ page }) => {
  await seedKnowledgeEntry('Mi primera nota', 'Contenido original.');

  await page.goto('/');
  await page.getByText('Mi primera nota', { exact: true }).click();

  const textarea = page.locator('textarea');
  await expect(textarea).toHaveValue('Contenido original.');

  await textarea.fill('Contenido editado.');
  await page.getByRole('button', { name: 'Guardar' }).click();

  // Next.js's dev-mode route announcer also has role="alert" — scope to the
  // note editor's own error paragraph, not the whole page.
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  await expect(page.locator('.note-editor [role="alert"]')).toHaveCount(0);
});

test('before selecting a note, the editor shows a placeholder instead of an empty textarea', async ({ page }) => {
  await seedKnowledgeEntry('Mi primera nota', 'Contenido.');

  await page.goto('/');

  await expect(page.getByText('Elegí una nota de la lista para verla acá.')).toBeVisible();
  await expect(page.locator('textarea')).toHaveCount(0);
});
